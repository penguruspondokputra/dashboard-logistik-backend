const express = require('express');
const db = require('./db');
const { makeIngredientResolver } = require('./ingredients');

const app = express();
const PORT = process.env.PORT || 3000;

// [Sesi 3] Body JSON — dibutuhkan endpoint POST /api/expense-items.
// Limit dinaikkan dari default 100kb: satu unggahan Excel rekap vendor
// bisa berisi ratusan baris sekaligus.
app.use(express.json({ limit: '10mb' }));

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// [Sesi 2] Daftar program (Kamisan, Dukkan, dst.) — dipakai Sesi 3
// (expense_items) & Sesi 4 (targets) untuk relasi program_id, dan
// nanti oleh dashboard utk mengganti tebakan tipe file manual.
app.get('/api/programs', (req, res) => {
  const programs = db.prepare(
    'SELECT id, slug, name, file_type, created_at FROM programs ORDER BY id'
  ).all();
  res.json(programs);
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validasi tanggal YYYY-MM-DD yang BENAR-BENAR kalender valid (bukan
// cuma cocok regex) — new Date(y,m-1,d) diam-diam "rollover" tanggal
// yang tidak ada (mis. 2026-02-30 → 2 Maret), jadi komponen hasil
// konstruksi dicocokkan balik ke input; kalau beda, tanggal aslinya
// tidak valid.
function isValidDateStr(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Validasi & normalisasi satu baris item. Mengumpulkan error ke `errors`
// (indeks disertakan) alih-alih throw, supaya SELURUH baris dicek dulu
// sebelum satu pun baris disentuh DB — lihat handler POST di bawah utk
// alasan "semua-atau-tidak-sama-sekali" per unggahan.
function normalizeExpenseItem(it, idx, errors) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) {
    errors.push(`items[${idx}]: harus berupa objek.`);
    return null;
  }

  const raw_name = typeof it.raw_name === 'string' ? it.raw_name.trim() : '';
  if (!raw_name) errors.push(`items[${idx}]: "raw_name" wajib diisi.`);

  if (!isValidDateStr(it.transaction_date)) {
    errors.push(`items[${idx}]: "transaction_date" wajib format YYYY-MM-DD dan tanggal kalender yang valid.`);
  }

  let quantity = it.quantity === undefined ? null : it.quantity;
  if (quantity !== null && (typeof quantity !== 'number' || !isFinite(quantity))) {
    errors.push(`items[${idx}]: "quantity" harus angka atau null.`);
    quantity = null;
  }

  let unit = it.unit === undefined ? null : it.unit;
  if (unit !== null && typeof unit !== 'string') {
    errors.push(`items[${idx}]: "unit" harus string atau null.`);
    unit = null;
  } else if (typeof unit === 'string') {
    unit = unit.trim() || null;
  }

  let unit_price = it.unit_price === undefined ? null : it.unit_price;
  if (unit_price !== null && (typeof unit_price !== 'number' || !isFinite(unit_price))) {
    errors.push(`items[${idx}]: "unit_price" harus angka atau null.`);
    unit_price = null;
  }

  // total: dipakai apa adanya kalau dikirim; kalau kosong/null TAPI
  // quantity & unit_price berdua tersedia, dihitung otomatis — pola yg
  // sama dgn fallback total===null && jumlah!==null && harga!==null di
  // extractItems() (Dashboard.html lama).
  let total = it.total === undefined ? null : it.total;
  if (total === null && typeof quantity === 'number' && typeof unit_price === 'number') {
    total = quantity * unit_price;
  }
  if (typeof total !== 'number' || !isFinite(total)) {
    errors.push(`items[${idx}]: "total" wajib angka (atau isi "quantity" + "unit_price" berdua supaya dihitung otomatis).`);
  }

  return { raw_name, transaction_date: it.transaction_date, quantity, unit, unit_price, total };
}

// [Sesi 3] Simpan baris transaksi (expense_items) — satu panggilan bisa
// berisi banyak baris sekaligus (satu unggahan Excel). "program" memakai
// slug (bukan program_id) supaya sisi pemanggil tidak perlu tahu id
// internal. Resolusi raw_name → ingredient_id terjadi DI SINI, sekali,
// per [B-7] — bukan lazy tiap query spt applyLibrary() lama. Validasi
// SELURUH baris dulu; kalau ada satu saja yang invalid, TIDAK ADA baris
// yang disimpan (semua-atau-tidak-sama-sekali per unggahan) — dipilih
// supaya tidak ada state "separuh tersimpan" yang harus dibersihkan
// manual, dan supaya baris bermasalah tidak pernah didiamkan/dilewati
// tanpa sinyal error yang jelas ke pemanggil.
app.post('/api/expense-items', (req, res) => {
  const body = req.body || {};
  const { program, items } = body;

  if (typeof program !== 'string' || !program.trim()) {
    return res.status(400).json({ error: 'Field "program" (slug) wajib diisi.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Field "items" wajib berupa array dan tidak boleh kosong.' });
  }

  const programRow = db.prepare('SELECT id FROM programs WHERE slug = ?').get(program.trim());
  if (!programRow) {
    return res.status(404).json({ error: `Program dengan slug "${program}" tidak ditemukan.` });
  }

  const errors = [];
  const normalized = items.map((it, idx) => normalizeExpenseItem(it, idx, errors));
  if (errors.length) {
    return res.status(400).json({ error: 'Validasi gagal — tidak ada baris yang disimpan.', details: errors });
  }

  const resolveIngredientId = makeIngredientResolver(db);
  const insertItem = db.prepare(`
    INSERT INTO expense_items (program_id, ingredient_id, raw_name, transaction_date, quantity, unit, unit_price, total)
    VALUES (@program_id, @ingredient_id, @raw_name, @transaction_date, @quantity, @unit, @unit_price, @total)
  `);

  const insertAll = db.transaction((rows) => {
    const ids = [];
    for (const it of rows) {
      const ingredient_id = resolveIngredientId(it.raw_name);
      const info = insertItem.run({
        program_id: programRow.id,
        ingredient_id,
        raw_name: it.raw_name,
        transaction_date: it.transaction_date,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total: it.total,
      });
      ids.push(info.lastInsertRowid);
    }
    return ids;
  });

  try {
    const ids = insertAll(normalized);
    res.status(201).json({
      program_id: programRow.id,
      inserted: ids.length,
      ids,
      new_ingredients: resolveIngredientId.createdIds.size,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan data.', detail: err.message });
  }
});

// [Sesi 3] Ambil expense_items per program & periode. Periode bisa
// dinyatakan lewat rentang Masehi langsung (?from=&to=, YYYY-MM-DD), ATAU
// lewat bulan Hijriah (?hijri_year=&hijri_month=, 1-12) yang diresolve ke
// rentang Masehi via tabel hijri_months [B-6] — SATU sumber kebenaran
// yang sama dipakai baik utk menyimpan (seed, lihat db.js) maupun
// membaca di sini, jadi tidak ada lagi 2 jalur baca kalender yang bisa
// tidak sinkron seperti bug lama di Dashboard.html. Kalau tidak ada
// parameter periode sama sekali, mengembalikan seluruh transaksi
// program tsb.
app.get('/api/expense-items', (req, res) => {
  const { program, from, to, hijri_year, hijri_month } = req.query;

  if (typeof program !== 'string' || !program.trim()) {
    return res.status(400).json({ error: 'Query "program" (slug) wajib diisi.' });
  }
  const programRow = db.prepare('SELECT id FROM programs WHERE slug = ?').get(program.trim());
  if (!programRow) {
    return res.status(404).json({ error: `Program dengan slug "${program}" tidak ditemukan.` });
  }

  let rangeFrom = null;
  let rangeTo = null;

  if (hijri_year !== undefined || hijri_month !== undefined) {
    const y = parseInt(hijri_year, 10);
    const m = parseInt(hijri_month, 10);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Query "hijri_year" & "hijri_month" (1-12) wajib diisi berdua & valid.' });
    }
    const monthRow = db.prepare(
      'SELECT gregorian_start, gregorian_end FROM hijri_months WHERE hijri_year = ? AND hijri_month = ?'
    ).get(y, m);
    if (!monthRow) {
      const bounds = db.prepare('SELECT MIN(hijri_year) AS minY, MAX(hijri_year) AS maxY FROM hijri_months').get();
      return res.status(404).json({
        error: `Data kalender Hijriah utk ${y}-${m} belum tersedia (di luar rentang ${bounds.minY}-${bounds.maxY} H yang sudah di-generate).`,
      });
    }
    rangeFrom = monthRow.gregorian_start;
    rangeTo = monthRow.gregorian_end;
  } else {
    if (from !== undefined) {
      if (!isValidDateStr(from)) return res.status(400).json({ error: 'Query "from" wajib format YYYY-MM-DD.' });
      rangeFrom = from;
    }
    if (to !== undefined) {
      if (!isValidDateStr(to)) return res.status(400).json({ error: 'Query "to" wajib format YYYY-MM-DD.' });
      rangeTo = to;
    }
  }

  let sql = `
    SELECT ei.id, ei.program_id, ei.ingredient_id, ing.canonical_name AS ingredient_name,
           ei.raw_name, ei.transaction_date, ei.quantity, ei.unit, ei.unit_price, ei.total, ei.created_at
    FROM expense_items ei
    JOIN ingredients ing ON ing.id = ei.ingredient_id
    WHERE ei.program_id = ?
  `;
  const params = [programRow.id];
  if (rangeFrom) { sql += ' AND ei.transaction_date >= ?'; params.push(rangeFrom); }
  if (rangeTo)   { sql += ' AND ei.transaction_date <= ?'; params.push(rangeTo); }
  sql += ' ORDER BY ei.transaction_date ASC, ei.id ASC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// [Sesi 3] Body JSON tidak valid (mis. koma nyasar) → balas 400 JSON yang
// jelas, bukan halaman error HTML default Express.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body request bukan JSON yang valid.' });
  }
  next(err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT}`);
});
