# Changelog Backend — Migrasi Dashboard Pangan

Catatan perubahan pada backend baru (`server.js`, `db.js`, `schema.sql`,
endpoint API, dst.) — terpisah dari `changelog.md` yang khusus mencatat
perubahan pada `Dashboard.html` (vanilla JS lama). Terbaru di paling atas.
Setiap entri merujuk ID `B-N` dari `keputusan_backend.md` kalau relevan.

**Catatan pembuatan file ini (2026-08-19):** file ini baru dibuat hari ini,
menyusul pekerjaan Sesi 1, Sesi 2, dan sesi arsitektur/skema yang sudah
berlangsung sebelumnya. Tiga entri paling bawah direkonstruksi dari
`roadmap_checklist.md`, `keputusan_backend.md`, dan isi `schema.sql`/`db.js`/
`server.js` saat ini — bukan dari transkrip sesi aslinya. Sebagai gantinya,
hari ini kode yang ADA SEKARANG diverifikasi ulang secara langsung (bukan
cuma dikutip dari catatan lama) di sandbox terpisah — detailnya ada di entri
2026-08-17. Mulai Sesi 3 dan seterusnya, entri ditulis di sesi yang sama saat
pekerjaan berlangsung, mengikuti aturan baku (tidak menulis "sudah diuji"
untuk sesuatu yang tidak sungguh dijalankan).

## Format satu entri

```
## YYYY-MM-DD — Fase N, Sesi M
- [ID] Deskripsi singkat apa yang diubah
- File/fungsi yang disentuh: ...
- Cara diuji: ...
- (opsional) Catatan/kendala
```

---

## 2026-08-17 — Fase 1 (arsitektur & skema — BUKAN Sesi 3)

- [B-1 s/d B-15] Diskusi arsitektur backend menyeluruh (mencocokkan fitur
  existing `Dashboard.html` terhadap visi fitur baru di
  `Fitur Dashboard Expense Trac.md`) menghasilkan 15 keputusan (B-1 s/d
  B-15) di `keputusan_backend.md` (dibuat 2026-08-16). Skema database
  diperluas dari 1 tabel (`programs`, Sesi 2) menjadi 13 tabel sekaligus —
  mencakup kebutuhan Sesi 3 (`expense_items`) & Sesi 4 (`program_targets`)
  yang tadinya direncanakan bertahap (lihat catatan Sesi 2 di
  `roadmap_checklist.md`), DITAMBAH tabel untuk fitur Fase 5 (alert
  anomali, pola musiman, IHK eksternal BPS) yang sekalian dirancang
  skemanya di muka. **Sesi ini murni desain skema & keputusan arsitektur —
  BUKAN sesi endpoint `expense_items` (Sesi 3 di `roadmap_checklist.md`,
  belum dikerjakan).**

  - File/fungsi yang disentuh:
    - BARU: `keputusan_backend.md` — 15 keputusan (B-1 s/d B-15); B-14
      (kategori bahan) & B-15 (cakupan konversi satuan) baru ditutup
      belakangan, saat `schema.sql` sungguh ditulis.
    - Diubah: `schema.sql` — dari 1 tabel (`programs`) menjadi 13 tabel:
      `programs` (tetap), `app_settings`, `hijri_months`, `categories`,
      `ingredients`, `ingredient_variants`, `expense_items`,
      `program_targets`, `flagged_alerts_seen`, `external_cpi_readings`,
      `seasonal_events`, `seasonal_event_occurrences`, `seasonal_factors`.
      Sengaja belum ada (lihat B-15): `menus`, `menu_ingredients`,
      `unit_conversions`.
    - Diubah: `db.js` — tambah `db.pragma('foreign_keys = ON')`; tambah
      `seedDefaultCategories()` (8 kategori starter, B-14) dan
      `seedDefaultAppSettings()` (`academic_year_start_month` default
      `'8'`, setara `ACADEMIC_CONFIG.yearStartMonth` lama di
      `Dashboard.html`); keduanya dipanggil di akhir file bareng
      `seedDefaultPrograms()` yang sudah ada sejak Sesi 2.
    - Dikonfirmasi TIDAK berubah: `server.js` (masih persis `/api/ping` +
      `/api/programs`; belum ada endpoint baru untuk 11 tabel baru).

  - Cara diuji:
    - Diklaim di `keputusan_backend.md` (bagian Status): *"`schema.sql`
      mulai ditulis 17 Agustus 2026, diuji jalan langsung di SQLite...
      bukan cuma ditulis di atas kertas"* — lewat skrip validasi terpisah
      yang disebut menguji constraint & FK enforcement, fix kalender
      Hijriah, deduplikasi, dan pola `effective_from`. Klaim ini dicatat
      apa adanya; transkrip skrip validasi itu sendiri tidak tersedia
      untuk diperiksa ulang di sesi ini.
    - Verifikasi TAMBAHAN yang sungguh dijalankan hari ini (2026-08-19) —
      di sandbox terpisah (salinan `package.json`/`server.js`/`db.js`/
      `schema.sql`, database sementara, BUKAN `data/dashboard.db`
      institusi):
      1. `npm install` lolos bersih (69 paket, 0 kerentanan). Catatan
         khusus sandbox ini: `better-sqlite3` perlu di-compile dari
         source (`--nodedir=/usr`) karena sandbox verifikasi tidak
         diizinkan mengakses `nodejs.org` untuk unduh header Node secara
         normal — ini keterbatasan sandbox, BUKAN masalah proyek; Sesi 2
         sudah mencatat `npm install` bersih di komputer institusi yang
         sesungguhnya.
      2. `require('./db.js')` dijalankan langsung → persis 13 tabel +
         `sqlite_sequence` terbentuk (`sqlite_master WHERE type='table'`),
         7 index kustom sesuai definisi di `schema.sql`.
      3. Seed terverifikasi tepat: 2 `programs` (kamisan/mingguan,
         dukkan/vendor), 8 `categories`, 1 `app_settings`
         (`academic_year_start_month`='8'). 10 tabel lain
         (`hijri_months`, `ingredients`, `ingredient_variants`,
         `expense_items`, `program_targets`, `flagged_alerts_seen`,
         `external_cpi_readings`, `seasonal_events`,
         `seasonal_event_occurrences`, `seasonal_factors`) dikonfirmasi
         0 baris — sesuai desain (belum ada data historis utk
         di-backfill, lihat B-5).
      4. `PRAGMA foreign_keys` = `1` (ON), `PRAGMA journal_mode` =
         `'wal'`. FK enforcement diuji langsung (bukan cuma asumsi dari
         pragma): `INSERT INTO expense_items` dgn `program_id`/
         `ingredient_id` yang tidak eksis → ditolak dgn "FOREIGN KEY
         constraint failed".
      5. Constraint dicek dua arah: `programs.file_type` menerima nilai
         bebas (`'format_belum_ditentukan'`) — tanpa CHECK, sesuai
         dokumentasi; `seasonal_events.calendar_basis` MENOLAK nilai di
         luar `'hijri'/'gregorian'` — CHECK-nya jalan.
      6. Idempotensi lintas-proses: 2 baris manual ditambahkan ke
         `programs` di satu proses Node, lalu `db.js` di-require ULANG
         di proses Node yang benar-benar baru (bukan cache modul)
         terhadap file database yang sama → kedua baris manual tetap
         ada (tidak terhapus), jumlah `categories`/`app_settings` tetap
         8/1 (tidak dobel akibat re-seed).
      7. `server.js` di-boot sungguhan (`node server.js`) →
         `GET /api/ping` mengembalikan `{"ok":true,"time":...}`;
         `GET /api/programs` mengembalikan seluruh 4 baris `programs`
         (termasuk 2 baris manual dari uji poin 6) dgn field lengkap.
         Proses server dikonfirmasi mati bersih sesudahnya (port 3000
         sudah bebas).

  - Catatan/kendala:
    - `hijri_months` sengaja kosong (dikonfirmasi 0 baris) — endpoint
      yang butuh pengelompokan periode Hijriah (`expense_items` per
      minggu/bulan) baru bisa jalan setelah data ini digenerate lewat
      script terpisah (porting `hijriToJD`/`jdToHijri` dari
      `Dashboard.html` ke modul JS backend). Bagian dari lingkup Sesi 3
      lanjutan, bukan sesi ini — sama persis dgn catatan di `db.js`.
    - `external_cpi_readings` sengaja kosong tanpa seed (B-10) — diisi
      manual kapan pun data BPS siap.
    - Efek samping positif (dicatat di `keputusan_backend.md`): begitu
      target/library/kalender pindah ke tabel-tabel di atas, temuan
      `keputusan.md` 9.2a (config tidak portable antar perangkat karena
      `localStorage`) otomatis selesai — tidak perlu pekerjaan tambahan
      terpisah.
    - Verifikasi hari ini memakai database sandbox kosong (baru seed
      `programs`/`categories`/`app_settings`), bukan database institusi
      yang sudah berjalan sejak Sesi 2 — jadi belum menguji skenario
      "migrasi database Sesi 2 yang sudah dipakai sungguhan". Risiko
      dianggap rendah karena `CREATE TABLE IF NOT EXISTS` per definisi
      tidak menyentuh tabel yang sudah ada, tapi tetap dicatat sebagai
      selisih cakupan.

## 2026-08-14 — Fase 1, Sesi 2

- Database dari `schema.sql` (tabel `programs`) + endpoint
  `GET /api/programs`, seed 2 program yang sudah didukung dashboard
  (Kamisan → `mingguan`, Dukkan → `vendor`).

  - File/fungsi yang disentuh:
    - BARU: `db.js` — koneksi `better-sqlite3` ke `data/dashboard.db`,
      `applySchema()` (`db.exec` isi `schema.sql`), `seedDefaultPrograms()`
      (`INSERT OR IGNORE` berbasis `UNIQUE(slug)`, idempotent).
    - BARU: `schema.sql` — tabel `programs` (kolom `file_type` sengaja
      tanpa CHECK constraint — Fase 4 mungkin bawa format baru untuk 9
      program lain yang belum ditentukan).
    - Diubah: `server.js` — tambah `GET /api/programs`.
    - BARU: `.gitignore` — pola `*.db`/`*.db-shm`/`*.db-wal`.

  - Cara diuji:
    - Dicatat di `roadmap_checklist.md` (saat itu): `npm install` bersih
      dengan `better-sqlite3` (prebuilt binary, tidak perlu build tool di
      komputer institusi).
    - Re-konfirmasi tidak langsung hari ini (2026-08-19): tabel
      `programs` + endpoint `/api/programs` adalah bagian dari skema
      13-tabel & server yang sama-sama diverifikasi ulang secara langsung
      di entri 2026-08-17 di atas (seed persis Kamisan/Dukkan
      terkonfirmasi lewat `GET /api/programs` sungguhan, poin 7) —
      detail lengkap tidak diulang di sini.

  - Catatan/kendala:
    - Rencana awal saat itu (dicatat di `roadmap_checklist.md`): skema
      akan bertambah bertahap tiap sesi (`expense_items` Sesi 3,
      `targets` Sesi 4). Rencana ini berubah — lihat entri 2026-08-17 di
      atas: skema diperluas sekaligus jadi 13 tabel dalam satu sesi
      arsitektur, sebelum endpoint Sesi 3 sendiri mulai dikerjakan.

## 2026-08-12 — Fase 1, Sesi 1

- Setup proyek Node.js kosong + endpoint health-check.

  - File/fungsi yang disentuh:
    - BARU: `package.json` — dependensi `express`, `better-sqlite3`;
      `main: server.js`; skrip `start: node server.js`.
    - BARU: `server.js` — `GET /api/ping` (`{ ok: true, time: ... }`),
      listen di `PORT` env var (default 3000), bind `0.0.0.0`.

  - Cara diuji:
    - Tidak ada catatan verifikasi eksplisit dari sesi aslinya di file
      manapun. Tanggal 2026-08-12 sendiri memakai tanggal pembuatan
      `roadmap_checklist.md` sebagai acuan (dokumen itu sudah menandai
      Sesi 1 selesai `[x]` sejak dibuat) — bukan tanggal yang tercatat
      eksplisit di tempat lain.
    - Re-konfirmasi hari ini (2026-08-19): `GET /api/ping` diuji ulang
      sungguhan (lihat poin 7 di entri 2026-08-17) dan mengembalikan
      `{"ok":true,"time":...}` sesuai kode saat ini.

  - Catatan/kendala: tidak ada.
