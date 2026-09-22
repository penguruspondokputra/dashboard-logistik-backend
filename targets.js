// ============================================================
// Target belanja per program — Sesi 4.
//
// Menggantikan targetsHistory/targets (localStorage, key
// 'dashboardBelanja_targets') dari Dashboard.html lama. Kontrak
// dipertahankan PERSIS dgn targetValueAt()/computeCurrentTargets() lama:
//   "nilai berlaku pd tanggal X" = entri dgn effective_from TERBARU yg
//   <= X; kalau ada beberapa entri dgn effective_from SAMA, yang PALING
//   BARU DIMASUKKAN menang (di JS: array selalu terurut waktu-dimasukkan,
//   reduce((a,b)=>b.effective_from>=a.effective_from?b:a) makan `>=`
//   sehingga entri belakangan menang saat seri). Di SQL disini disamakan
//   lewat ORDER BY effective_from DESC, id DESC — id AUTOINCREMENT
//   selalu naik sesuai urutan INSERT, jadi "id lebih tinggi" ≡ "dimasukkan
//   lebih belakangan".
//
// SENGAJA TIDAK mengarang nilai default (mis. Rp 2.800.000/Rp 17.000.000
// dari TARGET_DEFAULTS lama) — kalau belum ada satu pun baris utk sebuah
// program, getCurrentValue() mengembalikan null apa adanya. Keputusan ini
// masih terbuka utk didiskusikan ulang (lihat catatan di changelog).
// ============================================================
const db = require('./db');

// Pemetaan key lama (properti literal di localStorage) ke slug program
// yg SUDAH ADA sejak Sesi 2. DI-HARDCODE (bukan ditebak dari
// programs.file_type) krn 'mingguan'/'vendor' adalah nama properti yang
// dipakai TARGET_DEFAULTS/saveTargets() di Dashboard.html — hubungannya
// ke 'kamisan'/'dukkan' sudah final sejak Sesi 2 (lihat db.js
// DEFAULT_PROGRAMS). Tidak aman diturunkan dari file_type: Fase 4 akan
// menambah program lain yg kemungkinan juga file_type='mingguan'.
const LEGACY_KEY_TO_SLUG = { mingguan: 'kamisan', vendor: 'dukkan' };

// Getter tanggal LOKAL (bukan toISOString()/UTC) — pola yang sama dgn
// dateToISO()/todayISODate() di Dashboard.html & toISODate() di hijri.js,
// supaya "hari ini" di sisi server tidak bergeser dekat tengah malam
// akibat konversi UTC.
function todayLocalISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Validasi format YYYY-MM-DD + tanggal sungguh valid (menolak mis.
// "2026-02-30" yg kalau dibaca lewat `new Date(string)` bisa diam-diam
// "menggelinding" jadi 2 Maret alih-alih ditolak). Dibangun dari
// komponen numerik (bukan parsing string) baru dicocokkan balik.
function isValidDateStr(s) {
  if (typeof s !== 'string') return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function getProgramBySlug(slug) {
  return db.prepare('SELECT id, slug, name FROM programs WHERE slug = ?').get(slug);
}

function getAllPrograms() {
  return db.prepare('SELECT id, slug, name FROM programs ORDER BY id').all();
}

// Nilai target yg BERLAKU utk satu program pd tanggal tertentu (default:
// hari ini). null jika belum ada satu pun entri yg effective_from-nya
// <= tanggal itu (lihat catatan "sengaja tidak mengarang default" di atas).
function getCurrentValue(programId, asOfDate) {
  const row = db
    .prepare(
      `SELECT value, effective_from, set_by
       FROM program_targets
       WHERE program_id = ? AND effective_from <= ?
       ORDER BY effective_from DESC, id DESC
       LIMIT 1`
    )
    .get(programId, asOfDate);
  return row || null;
}

// Seluruh riwayat satu program, terurut kronologis (effective_from ASC,
// id ASC) — persis urutan array targetsHistory[key] lama.
function getHistory(programId) {
  return db
    .prepare(
      `SELECT value, effective_from, set_by, created_at
       FROM program_targets
       WHERE program_id = ?
       ORDER BY effective_from ASC, id ASC`
    )
    .all(programId);
}

// Tambah satu entri baru utk satu program. Meniru saveTargets() lama:
// entri BARU tidak ditambahkan kalau nilainya sama dgn entri yg PALING
// BARU DIMASUKKAN (id tertinggi, BUKAN "yang sedang berlaku hari ini")
// utk program itu — supaya klik simpan berulang tanpa perubahan tidak
// menumpuk baris duplikat. Dipakai endpoint POST /api/targets (input
// langsung dari pengguna) — TIDAK dipakai importHistory() (data historis
// dari localStorage diimpor apa adanya, lihat komentar di sana).
function addEntry({ programId, value, effectiveFrom, setBy }) {
  const last = db
    .prepare(`SELECT value FROM program_targets WHERE program_id = ? ORDER BY id DESC LIMIT 1`)
    .get(programId);
  if (last && last.value === value) {
    return { inserted: false, reason: 'unchanged', entry: last };
  }
  const info = db
    .prepare(
      `INSERT INTO program_targets (program_id, value, effective_from, set_by) VALUES (?, ?, ?, ?)`
    )
    .run(programId, value, effectiveFrom, setBy || null);
  return {
    inserted: true,
    entry: { id: info.lastInsertRowid, value, effective_from: effectiveFrom, set_by: setBy || null },
  };
}

// ---- Migrasi dari localStorage lama ----
//
// Menerima PERSIS bentuk JSON.parse(localStorage.getItem('dashboardBelanja_targets')):
//   { mingguan: [{value, effective_from}, ...] | number, vendor: [...] | number }
// (array = format sejak [6.1]/2026-07-29; number tunggal = format lebih
// lama sebelum itu — ditangani sama seperti loadTargets() lama menangani
// keduanya).
//
// Validasi SELURUH body dulu (all-or-nothing, konsisten dgn desain
// POST /api/expense-items di Sesi 3) SEBELUM menulis satu baris pun —
// satu entri tidak valid di mana pun membatalkan seluruh impor, bukan
// cuma bagian yang salah.
function validateImportPayload(raw) {
  // localStorage kosong (belum pernah disimpan sama sekali) → JSON.parse
  // menghasilkan null. Ini keadaan valid & wajar, bukan error — cukup
  // "tidak ada apa pun utk diimpor".
  if (raw === null || raw === undefined) {
    return { valid: true, normalized: {} };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Body harus berupa objek dengan key "mingguan"/"vendor" (persis isi localStorage lama), atau null.' };
  }
  const unknownKeys = Object.keys(raw).filter((k) => !(k in LEGACY_KEY_TO_SLUG));
  if (unknownKeys.length) {
    return {
      valid: false,
      error: `Key tidak dikenal: ${unknownKeys.join(', ')}. Hanya "mingguan"/"vendor" yang didukung.`,
    };
  }
  const normalized = {}; // slug -> { programId, entries: [{value, effective_from}] }
  for (const legacyKey of Object.keys(raw)) {
    const slug = LEGACY_KEY_TO_SLUG[legacyKey];
    const program = getProgramBySlug(slug);
    if (!program) {
      return { valid: false, error: `Program "${slug}" (dari key "${legacyKey}") tidak ditemukan di tabel programs.` };
    }
    const v = raw[legacyKey];
    let entries;
    if (typeof v === 'number') {
      // Format lama sebelum [6.1]: nilai tunggal, bukan riwayat — sama
      // persis dgn fallback di loadTargets(): [{value:v, effective_from:TARGET_HISTORY_EPOCH}]
      entries = [{ value: v, effective_from: '1970-01-01' }];
    } else if (Array.isArray(v)) {
      entries = v;
    } else {
      return { valid: false, error: `Nilai untuk key "${legacyKey}" harus angka atau array riwayat.` };
    }
    if (!entries.length) {
      return { valid: false, error: `Riwayat untuk key "${legacyKey}" kosong.` };
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        return { valid: false, error: `Entri ke-${i} pada "${legacyKey}" bukan objek {value, effective_from}.` };
      }
      if (typeof e.value !== 'number' || !isFinite(e.value) || e.value < 0) {
        return { valid: false, error: `Entri ke-${i} pada "${legacyKey}": value harus angka >= 0.` };
      }
      if (!isValidDateStr(e.effective_from)) {
        return { valid: false, error: `Entri ke-${i} pada "${legacyKey}": effective_from harus format YYYY-MM-DD yang valid.` };
      }
    }
    normalized[slug] = { programId: program.id, entries };
  }
  return { valid: true, normalized };
}

// Import transaksional: SEMUA baris tersimpan, atau TIDAK SATU PUN kalau
// validasi gagal (lempar Error dgn statusCode=400 SEBELUM transaction
// dibuka — belum ada satu INSERT pun yang sempat jalan).
//
// SENGAJA TIDAK deduplikasi/idempotency check terhadap data yang sudah
// ada di program_targets — mengikuti preseden POST /api/expense-items
// Sesi 3 ("Endpoint ini TIDAK mendeteksi/mencegah unggahan duplikat...
// kandidat item terpisah"). Konsekuensi praktis: menjalankan import yang
// SAMA dua kali akan menggandakan baris riwayatnya. Ini tidak merusak
// KEBENARAN nilai "yang berlaku sekarang" selama isi baris yang
// terduplikasi identik (tie-break tetap jatuh ke nilai yang sama), tapi
// membuat tabel riwayat lebih berantakan. Import ini dimaksudkan
// dijalankan SEKALI per data localStorage — bukan proses sinkronisasi
// berulang.
function importHistory(raw) {
  const check = validateImportPayload(raw);
  if (!check.valid) {
    const err = new Error(check.error);
    err.statusCode = 400;
    throw err;
  }
  const insertOne = db.prepare(
    `INSERT INTO program_targets (program_id, value, effective_from, set_by) VALUES (?, ?, ?, NULL)`
  );
  const summary = {};
  const runAll = db.transaction((normalized) => {
    for (const slug of Object.keys(normalized)) {
      const { programId, entries } = normalized[slug];
      let count = 0;
      for (const e of entries) {
        insertOne.run(programId, e.value, e.effective_from);
        count++;
      }
      summary[slug] = count;
    }
  });
  runAll(check.normalized);
  return summary;
}

module.exports = {
  LEGACY_KEY_TO_SLUG,
  todayLocalISODate,
  isValidDateStr,
  getProgramBySlug,
  getAllPrograms,
  getCurrentValue,
  getHistory,
  addEntry,
  importHistory,
};