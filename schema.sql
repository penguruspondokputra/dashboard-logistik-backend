-- ============================================================
-- Skema Database — Dashboard Pangan
--
-- [Sesi 2 — 14 Agu 2026] Tabel `programs` dibuat & di-seed dengan
-- 2 program yang sudah didukung dashboard sekarang (Kamisan &
-- Dukkan).
--
-- [Sesi 3 — 17 Agu 2026] Perluasan besar setelah diskusi arsitektur
-- panjang (lihat `keputusan_backend.md`, B-1 s/d B-15) yang
-- mencocokkan fitur existing `Dashboard.html` terhadap visi fitur
-- baru di `Fitur Dashboard Expense Trac.md`. Tiap tabel di bawah
-- diberi komentar merujuk ID `B-N` yang relevan supaya "kenapa"-nya
-- selalu bisa ditelusuri balik ke diskusinya.
--
-- Yang SENGAJA belum ada di sini (bukan lupa — lihat B-15 & catatan
-- masing-masing): Menu/Resep, relasi Menu↔Bahan, konversi satuan.
-- Cluster ini belum didiskusikan sedalam bagian lain & levelnya
-- "prioritas belakangan" — menyusul sesi terpisah.
--
-- Semua CREATE TABLE pakai IF NOT EXISTS — aman dieksekusi ulang
-- tiap start server (lihat db.js), tidak pernah menghapus data lama.
-- ============================================================

-- ── PROGRAMS (Sesi 2, tidak berubah) ──────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,    -- pengenal stabil (dipakai relasi/URL), mis. 'kamisan'
  name        TEXT NOT NULL,           -- nama tampil di UI, mis. 'Kamisan'
  file_type   TEXT NOT NULL,           -- strategi parsing Excel: 'mingguan' (form per-minggu,
                                        -- 1 sheet = 1 periode) | 'vendor' (rekap multi-nota per sheet).
                                        -- Sama persis dgn nilai file.type di Dashboard.html supaya
                                        -- pemetaan klien↔server tidak perlu tabel terjemahan.
                                        -- TIDAK diberi CHECK constraint: Fase 4 (roadmap_checklist.md)
                                        -- berencana menambah 9 program lain dengan format yang belum
                                        -- tentu 'mingguan'/'vendor' — dibiarkan longgar agar tidak
                                        -- perlu migrasi skema saat format baru itu ditentukan nanti.
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── PENGATURAN APLIKASI (key-value generik) ───────────────────
-- Menggantikan ACADEMIC_CONFIG.yearStartMonth dkk dari localStorage.
-- Key-value generik (bukan kolom khusus per setting) supaya setting
-- baru nanti tidak perlu ALTER TABLE. Diseed 'academic_year_start_month'
-- = '8' (Sya'ban) di db.js, sama dgn default Dashboard.html.
CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ── KALENDER HIJRIAH — [B-6] perbaikan bug override ru'yah ────
-- Dashboard.html lama punya DUA jalur baca kalender yang tidak sinkron:
-- hijriMonthStartJD() (tampilan rentang tanggal, SADAR override) vs
-- jdToHijri() (pengelompokan transaksi→periode, TIDAK SADAR override,
-- murni tabular). Dibuktikan empiris saat diskusi: transaksi tepat di
-- tanggal batas bisa ke-grouping ke bulan yang salah menurut override
-- resmi yang berlaku. Fix: SATU tabel jadi sumber kebenaran tunggal,
-- dipakai utk KEDUA arah (bulan→rentang tanggal, DAN tanggal→bulan).
--
-- gregorian_end disimpan eksplisit (bukan computed column) karena
-- SQLite tidak bisa merujuk "baris berikutnya" di generated column.
-- Konsistensi antar-bulan (end bulan N = start bulan N+1 − 1 hari)
-- WAJIB dijaga oleh proses aplikasi saat override disimpan (update
-- dua baris sekaligus dalam satu transaction), BUKAN oleh trigger DB
-- — lebih mudah diaudit & tidak rawan edge-case pergantian tahun.
--
-- Diisi lewat script terpisah (bukan hardcoded di sini): hitung
-- tabular utk rentang tahun yang cukup lebar (mis. 30-50 tahun Hijriah
-- ke depan), is_override tetap 0 sampai staf memasukkan override
-- sungguhan lewat UI Konfigurasi Kalender.
CREATE TABLE IF NOT EXISTS hijri_months (
  hijri_year      INTEGER NOT NULL,
  hijri_month     INTEGER NOT NULL,           -- 1–12
  gregorian_start TEXT NOT NULL,               -- YYYY-MM-DD, tanggal 1 bulan ini
  gregorian_end   TEXT NOT NULL,               -- YYYY-MM-DD, hari terakhir bulan ini
  is_override     INTEGER NOT NULL DEFAULT 0,  -- 1 = hasil ru'yah manual, 0 = tabular
  PRIMARY KEY (hijri_year, hijri_month)
);
-- Index utk arah "tanggal transaksi → bulan Hijriah apa" (query paling sering:
-- WHERE gregorian_start <= ? AND gregorian_end >= ?)
CREATE INDEX IF NOT EXISTS idx_hijri_months_range ON hijri_months(gregorian_start, gregorian_end);

-- Catatan [B-8]: nomor "minggu ke-N" (baik anchor Muharram yang sudah
-- ada di Dashboard.html, maupun anchor Sya'ban utk YoY) TIDAK disimpan
-- sbg tabel tersendiri — keduanya diturunkan lewat aritmetika dari
-- hijri_months (cari baris hijri_month=1 atau =8 utk tahun terkait,
-- lalu hitung selisih hari). Anchor-Sya'ban murni kunci internal utk
-- penyelarasan YoY, TIDAK PERNAH jadi label yang ditampilkan ke user.

-- ── KATEGORI BAHAN — [B-14] ────────────────────────────────────
-- Starter set, BUKAN keputusan final/mengunci — bebas diubah/ditambah
-- kapan saja lewat UI nanti. Diseed di db.js.
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── BAHAN (master) — [B-7] ─────────────────────────────────────
-- Menggantikan libraryData (localStorage) dari Dashboard.html lama.
-- category_id NULLABLE dengan sengaja: bahan yang belum sempat
-- dikategorikan staf tetap sah masuk sistem ("kategori kosong" per
-- B-7), bukan diblokir/ditolak.
-- reference_unit murni utk TAMPILAN/rujukan (mis. label default di
-- form), BUKAN dipaksakan ke tiap transaksi — satuan aktual tiap
-- transaksi tetap dicatat sendiri di expense_items.unit, karena bahan
-- yang sama bisa dibeli dgn satuan berbeda antar nota.
CREATE TABLE IF NOT EXISTS ingredients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name  TEXT NOT NULL UNIQUE,
  category_id     INTEGER REFERENCES categories(id),
  reference_unit  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── VARIAN NAMA BAHAN — [B-7] ──────────────────────────────────
-- Menggantikan libraryData[].variants. COLLATE NOCASE supaya matching
-- case-insensitive sama persis spt applyLibrary() lama.
-- Resolusi nama mentah → ingredient_id: cek ingredients.canonical_name
-- DULU, baru ingredient_variants.variant_text (persis urutan cek
-- applyLibrary() lama) — logic ini hidup di kode aplikasi (Sesi
-- berikutnya), bukan di schema.
CREATE TABLE IF NOT EXISTS ingredient_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  variant_text  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── TRANSAKSI/BELANJA (item per baris) — inti Sesi 3 asli ──────
-- [Prinsip lintas-fitur] transaction_date adalah SATU sumber kebenaran
-- tanggal (Masehi, tidak ambigu). Semua pengelompokan periode lain
-- (minggu/bulan Hijriah, kuartal akademik, bulan Masehi utk BPS)
-- diturunkan dari kolom ini + hijri_months — TIDAK disimpan sbg kolom
-- terpisah yg bisa tidak sinkron.
--
-- raw_name WAJIB diisi persis spt tertulis di sumber (nota/Excel) —
-- audit trail yg sama semangatnya dgn badge 📚 di Dashboard.html lama.
--
-- ingredient_id NOT NULL: per [B-7], resolusi nama terjadi SEKALI saat
-- data masuk (bukan lazy/tiap query) — nama tak dikenal otomatis jadi
-- ingredient baru (kategori kosong) SEBELUM baris ini disimpan, jadi
-- setiap baris transaksi harus sudah py ingredient_id yang valid.
-- (Termasuk item "jasa" dkk — mereka tetap "ingredient" dgn quantity/
-- unit_price kosong, idealnya masuk kategori "Jasa & Non-Bahan".)
--
-- quantity & unit_price NULLABLE, total NOT NULL: item tanpa data
-- satuan (jasa) tetap dihitung penuh ke total belanja, tapi keluar
-- dari analisis harga per unit — sama spt hasUnitInfo di kode lama.
CREATE TABLE IF NOT EXISTS expense_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id        INTEGER NOT NULL REFERENCES programs(id),
  ingredient_id     INTEGER NOT NULL REFERENCES ingredients(id),
  raw_name          TEXT NOT NULL,
  transaction_date  TEXT NOT NULL,   -- YYYY-MM-DD (Masehi)
  quantity          REAL,
  unit              TEXT,
  unit_price        REAL,
  total             REAL NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expense_items_date       ON expense_items(transaction_date);
CREATE INDEX IF NOT EXISTS idx_expense_items_ingredient ON expense_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_program    ON expense_items(program_id);

-- ── TARGET BELANJA PER PROGRAM — pola effective_from [B-13] ────
-- Menggantikan targetsHistory (localStorage). Kontrak: nilai BERLAKU
-- pada tanggal tertentu = entri dgn effective_from terbaru yg <=
-- tanggal itu (persis logic targetValueAt() lama).
-- set_by NULLABLE & TEXT (bukan FK) dengan sengaja: Fase 3 (login)
-- belum ada, jadi belum ada tabel users utk dirujuk. Kemungkinan besar
-- jadi FK ke tabel users begitu Fase 3 jalan — kolom ini disiapkan
-- dari sekarang supaya Fase 3/5 (RAPB) tidak perlu migrasi ulang
-- utk MULAI mencatat siapa yang menetapkan tiap perubahan target.
CREATE TABLE IF NOT EXISTS program_targets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id      INTEGER NOT NULL REFERENCES programs(id),
  value           REAL NOT NULL,
  effective_from  TEXT NOT NULL,   -- YYYY-MM-DD
  set_by          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_program_targets_lookup ON program_targets(program_id, effective_from);

-- ── ALERT ANOMALI HARGA — [B-1], [B-2] ─────────────────────────
-- Deteksi anomali itu sendiri TETAP live/dihitung ulang tiap load
-- (sama spt logic threshold di renderInsights() lama) — TIDAK
-- disimpan di sini. Tabel ini HANYA mencatat "sudah pernah dilihat"
-- per (bahan, periode), sesuai B-1: tampil sampai pertama kali dibaca,
-- lalu hilang. TIDAK ada riwayat siapa/kapan penuh (sesuai B-1) —
-- UNIQUE constraint sendiri yang bikin idempotent (insert kedua utk
-- kombinasi sama akan gagal/diabaikan, bukan menumpuk baris).
-- period_key format sama dgn hijriPeriodKey() lama, mis. '1447-W23'.
CREATE TABLE IF NOT EXISTS flagged_alerts_seen (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  period_key    TEXT NOT NULL,
  seen_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ingredient_id, period_key)
);

-- ── IHK EKSTERNAL (BPS) — [B-10] ────────────────────────────────
-- Struktur disiapkan sekarang, SENGAJA kosong (tidak ada seed data) —
-- diisi manual kapan pun datanya siap dipakai (Fase 1 checklist:
-- input manual berkala). period_month pakai siklus Masehi/bulanan
-- BPS, BUKAN periode Hijriah internal — penyelarasan lintas-kalender
-- (Masehi bulanan ↔ Hijriah mingguan/10-harian) jadi urusan QUERY
-- saat fitur inflasi eksternal benar-benar dibangun, bukan schema.
CREATE TABLE IF NOT EXISTS external_cpi_readings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  region       TEXT NOT NULL DEFAULT 'Kudus',
  category     TEXT NOT NULL DEFAULT 'makanan_minuman',  -- kelompok pengeluaran BPS, bukan angka headline
  period_month TEXT NOT NULL,    -- YYYY-MM (Masehi)
  value        REAL NOT NULL,
  input_at     TEXT NOT NULL DEFAULT (datetime('now')),
  notes        TEXT
);

-- ── POLA MUSIMAN HARGA PASAR — [B-11] ───────────────────────────
-- HANYA sisi "musim harga pasar" (Ramadhan-Lebaran, Idul Adha, panen,
-- Nataru) — pengaruh ke HARGA per bahan. Sisi "aktivitas kampus"
-- (pengaruh ke VOLUME, existing FORECAST_SEASON_GROUP di Dashboard.html)
-- SENGAJA belum dipindah ke tabel [B-3: "tetap placeholder kasar apa
-- adanya"] — tetap konstanta di kode aplikasi utk saat ini, beda dari
-- cluster ini yang memang sudah matang utk jadi data (B-4: dua konsep
-- musiman terpisah, bukan digabung).
--
-- Kedua basis kalender (Hijriah & Masehi) disimpan SERAGAM sbg
-- rentang tanggal Masehi konkret per kemunculan tahunan — occurrence
-- Hijriah dihitung dari hijri_months, occurrence Masehi diketik
-- langsung — supaya query pemakainya (dekomposisi YoY/inflasi) tidak
-- perlu tahu/peduli basis kalender aslinya.
CREATE TABLE IF NOT EXISTS seasonal_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,     -- mis. 'Ramadhan-Lebaran', 'Idul Adha', 'Musim Panen', 'Nataru'
  calendar_basis  TEXT NOT NULL CHECK (calendar_basis IN ('hijri','gregorian')),  -- informasional saja
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS seasonal_event_occurrences (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  seasonal_event_id INTEGER NOT NULL REFERENCES seasonal_events(id),
  gregorian_year    INTEGER NOT NULL,
  start_date        TEXT NOT NULL,
  end_date          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasonal_occ_event ON seasonal_event_occurrences(seasonal_event_id);

-- factor_value = pengali (mis. 1.15 → perkiraan +15%). ingredient_id
-- NULLABLE = faktor umum berlaku semua bahan; diisi utk faktor
-- spesifik-bahan. source membedakan prior nasional (cold-start,
-- sesuai checklist: "pakai pola umum yg sudah diketahui... divalidasi
-- ulang setelah beberapa siklus") vs hasil belajar dari data sendiri
-- — dua sumber angka TIDAK saling menimpa, keduanya tersimpan.
CREATE TABLE IF NOT EXISTS seasonal_factors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  seasonal_event_id INTEGER NOT NULL REFERENCES seasonal_events(id),
  ingredient_id     INTEGER REFERENCES ingredients(id),
  factor_type       TEXT NOT NULL CHECK (factor_type IN ('price','volume')),
  factor_value      REAL NOT NULL,
  source            TEXT NOT NULL CHECK (source IN ('default','learned')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seasonal_factors_event ON seasonal_factors(seasonal_event_id);

-- ============================================================
-- SENGAJA BELUM ADA — lihat B-15 & keputusan_backend.md:
--   menus, menu_ingredients, unit_conversions
-- (cluster Cost per Menu — prioritas belakangan, belum didiskusikan
-- sedalam bagian lain; termasuk target biaya per porsi dari B-12,
-- yang akan hidup sbg kolom di tabel `menus` nanti, pola effective_from
-- yang sama dgn program_targets)
-- ============================================================