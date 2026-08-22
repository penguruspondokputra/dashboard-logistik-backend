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
const { hijriMonthRangeJD, jdToGregorian, toISODate } = require('./hijri');

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

// [Sesi 3 — B-6] Populate `hijri_months`: SATU sumber kebenaran dipakai
// utk kedua arah (bulan→rentang tanggal & tanggal→bulan) — lihat komentar
// panjang di hijri.js & schema.sql. Rentang ~50 tahun (bukan 1 baris spt
// seed lain di atas): institusi ini diharapkan berjalan bertahun-tahun,
// dan hitungannya murah (612 baris, sekali per start, INSERT OR IGNORE).
// is_override selalu 0 dari seed ini — override ru'yah sungguhan (lewat
// UI Konfigurasi Kalender, belum disambungkan ke backend di sesi ini)
// akan jadi baris yang SUDAH ADA saat seed berikutnya jalan, sehingga
// tidak pernah tertimpa balik ke tabular (PRIMARY KEY (hijri_year,
// hijri_month) + INSERT OR IGNORE menjamin ini).
const HIJRI_SEED_YEAR_FROM = 1440; // ≈ 2018-2019 M — buffer secukupnya ke belakang
const HIJRI_SEED_YEAR_TO = 1490;   // ≈ 2067-2068 M — puluhan tahun ke depan

function seedHijriMonths() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO hijri_months (hijri_year, hijri_month, gregorian_start, gregorian_end, is_override)
    VALUES (@hijri_year, @hijri_month, @gregorian_start, @gregorian_end, 0)
  `);
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  const rows = [];
  for (let y = HIJRI_SEED_YEAR_FROM; y <= HIJRI_SEED_YEAR_TO; y++) {
    for (let m = 1; m <= 12; m++) {
      const { startJD, endJD } = hijriMonthRangeJD(y, m);
      rows.push({
        hijri_year: y,
        hijri_month: m,
        gregorian_start: toISODate(jdToGregorian(startJD)),
        gregorian_end: toISODate(jdToGregorian(endJD)),
      });
    }
  }
  insertAll(rows);
}

applySchema();
seedDefaultPrograms();
seedDefaultCategories();
seedDefaultAppSettings();
seedHijriMonths();

module.exports = db;
