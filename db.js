// ============================================================
// Koneksi & inisialisasi database SQLite.
// [Sesi 2] File baru. Dipanggil dari server.js lewat require('./db').
//
// - Skema (schema.sql) diterapkan setiap kali proses ini di-load —
//   aman diulang karena semua statement pakai "IF NOT EXISTS", jadi
//   tidak pernah menghapus tabel/data yang sudah ada.
// - Seed program default juga idempotent (INSERT OR IGNORE berbasis
//   UNIQUE(slug)), jadi aman terpanggil di setiap start tanpa membuat
//   baris duplikat.
// - File database sungguhan (data/dashboard.db) TIDAK ikut di-commit
//   — sudah tercakup pola "*.db" di .gitignore.
// ============================================================
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'dashboard.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // baca+tulis bersamaan lebih tahan (viewer baca saat editor unggah)
db.pragma('foreign_keys = ON'); // [Sesi 3] aktif dipakai: expense_items → programs/ingredients, dst.

function applySchema() {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

// [Sesi 2] Dua program yang sudah didukung dashboard saat ini.
// 9 program lain menyusul Fase 4 — lihat roadmap_checklist.md.
const DEFAULT_PROGRAMS = [
  { slug: 'kamisan', name: 'Kamisan', file_type: 'mingguan' },
  { slug: 'dukkan', name: 'Dukkan', file_type: 'vendor' },
];

function seedDefaultPrograms() {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO programs (slug, name, file_type) VALUES (@slug, @name, @file_type)'
  );
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(DEFAULT_PROGRAMS);
}

// [Sesi 3 — B-14] Starter set kategori bahan. BUKAN daftar final/mengunci —
// bebas diubah/ditambah lewat UI nanti tanpa migrasi (tabel `categories`
// murni id+name).
const DEFAULT_CATEGORIES = [
  'Bumbu & Rempah',
  'Sayuran',
  'Protein Hewani',
  'Protein Nabati',
  'Sembako/Bahan Pokok',
  'Buah',
  'Jasa & Non-Bahan',
  'Lain-lain',
];

function seedDefaultCategories() {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  const insertAll = db.transaction((names) => {
    for (const name of names) insert.run(name);
  });
  insertAll(DEFAULT_CATEGORIES);
}

// [Sesi 3] Setara ACADEMIC_CONFIG.yearStartMonth di Dashboard.html lama
// (default 8 = Sya'ban). key-value generik (app_settings) supaya setting
// baru nanti tidak perlu ALTER TABLE — lihat schema.sql.
const DEFAULT_APP_SETTINGS = {
  academic_year_start_month: '8',
};

function seedDefaultAppSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (@key, @value)');
  const insertAll = db.transaction((entries) => {
    for (const [key, value] of entries) insert.run({ key, value });
  });
  insertAll(Object.entries(DEFAULT_APP_SETTINGS));
}

// [Sesi 3] SENGAJA belum ada di sini: seed/populate `hijri_months`.
// Butuh porting algoritma tabular Hijriah (hijriToJD dkk dari Dashboard.html)
// jadi modul JS tersendiri, dan rentang tahun yg wajar (~30-50 tahun) —
// pekerjaan sesi berikutnya, bukan seed 1-baris spt tabel lain di atas.
// Tanpa data ini, endpoint yang butuh pengelompokan periode (expense_items
// per minggu/bulan Hijriah) belum bisa jalan — itu memang lingkup Sesi 3
// LANJUTAN (endpoint expense_items), bukan sesi skema ini.

applySchema();
seedDefaultPrograms();
seedDefaultCategories();
seedDefaultAppSettings();

module.exports = db;