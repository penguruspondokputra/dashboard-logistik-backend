// ============================================================
// Resolusi nama bahan mentah → ingredient_id. [Sesi 3 — B-7]
//
// Menggantikan applyLibrary() (Dashboard.html, localStorage, resolve
// LAZY setiap kali dashboard dirender). Di backend, resolusi terjadi
// SEKALI saat data disimpan (lihat POST /api/expense-items di
// server.js) — hasilnya (ingredient_id) yang disimpan permanen ke
// expense_items, bukan nama mentahnya yang di-resolve ulang tiap
// query.
//
// Urutan pencocokan SAMA PERSIS dgn applyLibrary() lama: cek
// ingredients.canonical_name dulu, baru ingredient_variants.variant_text,
// keduanya case-insensitive + trimmed (lihat komentar di schema.sql
// pada tabel ingredient_variants utk alasan urutan ini). BEDA dari
// applyLibrary(): nama yang tidak dikenal di sini OTOMATIS jadi
// ingredient baru (category_id NULL, per B-7) — bukan silent
// passthrough (nama mentah dipakai apa adanya tanpa pernah tercatat
// sbg entri baru) seperti applyLibrary().
// ============================================================

function makeIngredientResolver(db) {
  const findByCanonical = db.prepare(
    'SELECT id FROM ingredients WHERE canonical_name = ? COLLATE NOCASE'
  );
  // ingredient_variants.variant_text sudah dideklarasikan COLLATE NOCASE
  // di schema.sql, jadi '=' otomatis case-insensitive di kolom ini —
  // COLLATE NOCASE tetap ditulis eksplisit di sini supaya query ini bisa
  // dipahami sendiri tanpa perlu buka schema.sql.
  const findByVariant = db.prepare(
    'SELECT ingredient_id AS id FROM ingredient_variants WHERE variant_text = ? COLLATE NOCASE'
  );
  const insertIngredient = db.prepare(
    'INSERT INTO ingredients (canonical_name) VALUES (?)'
  );

  // Cache milik SATU resolver saja (dibuat baru per panggilan
  // makeIngredientResolver — lihat pemanggilnya di server.js: satu
  // resolver baru per request POST /api/expense-items). Mempercepat
  // unggahan besar yang menyebut bahan sama berkali-kali, TANPA
  // menyimpan state basi lintas request/pengguna lain.
  const cache = new Map();
  const createdIds = new Set(); // ingredient_id yang BARU dibuat oleh resolver ini

  function resolveIngredientId(rawName) {
    const trimmed = String(rawName).trim();
    const key = trimmed.toLowerCase();
    if (cache.has(key)) return cache.get(key);

    let row = findByCanonical.get(trimmed);
    if (!row) row = findByVariant.get(trimmed);

    let id;
    if (row) {
      id = row.id;
    } else {
      id = insertIngredient.run(trimmed).lastInsertRowid;
      createdIds.add(id);
    }
    cache.set(key, id);
    return id;
  }

  resolveIngredientId.createdIds = createdIds;
  return resolveIngredientId;
}

module.exports = { makeIngredientResolver };
