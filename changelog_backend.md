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

## Perubahan untuk `environment.md`

Penambahan baris berikut ke bagian 6:
```
- Untuk uji endpoint API dari PowerShell 5.1 yang mengirim body JSON
  (POST/PATCH), prioritaskan `Invoke-RestMethod` dengan body yang
  dibangun menggunakan `ConvertTo-Json`.
- Untuk body JSON yang kompleks, boleh gunakan file JSON sementara lalu
  kirim dengan `curl.exe --data-binary "@file.json"`.
- Hindari memberikan JSON kompleks langsung sebagai string argument
  `-d`/`--data` pada `curl.exe`, karena aturan quoting PowerShell dan
  proses eksternal dapat menyebabkan body yang diterima server berbeda
  dari JSON yang dimaksud.
- Jangan menerjemahkan contoh command Linux ke PowerShell secara literal;
  pilih metode pengujian yang sesuai dengan shell pada `environment.md`.
```

- Tanggal: 2026-08-21
- Diverifikasi oleh: pengguna
- Perubahan sejak verifikasi sebelumnya: Server sungguhan di-boot (bukan cuma baseline dari package.json/server.js), endpoint POST/GET /api/expense-items diuji langsung, migrasi db.js di atas data/dashboard.db yang sudah ada dikonfirmasi aman, dan akses LAN dari perangkat lain dikonfirmasi jalan.
## 2026-08-21 — Fase 1, Sesi 3

- [B-6] Port algoritma kalender Hijriah tabular (hijriToJD/gregorianToJD/
  jdToHijri/jdToGregorian) dari Dashboard.html ke modul backend baru
  (hijri.js), lalu populate tabel `hijri_months` (612 baris, 1440–1490 H)
  sbg SATU sumber kebenaran dua arah (bulan→rentang tanggal DAN
  tanggal→bulan) — prasyarat yg sebelumnya diblokir eksplisit di
  db.js/keputusan_backend.md sblm endpoint expense_items bisa mendukung
  filter periode Hijriah.
- [B-7] Modul resolusi nama bahan (ingredients.js): raw_name →
  ingredient_id, urutan cek sama dgn applyLibrary() lama (canonical_name
  dulu, baru ingredient_variants, case-insensitive+trimmed), tapi nama
  tak dikenal OTOMATIS jadi ingredient baru (bukan silent passthrough).
- Endpoint baru: `POST /api/expense-items` (simpan, bulk, semua-atau-
  tidak-sama-sekali per unggahan) & `GET /api/expense-items` (ambil per
  program + periode — rentang Masehi from/to ATAU bulan Hijriah
  hijri_year/hijri_month).

- File/fungsi yang disentuh:
  - BARU: `hijri.js` — HIJRI_EPOCH_JD, hijriToJD(), gregorianToJD(),
    jdToHijri(), jdToGregorian(), gregorianToHijri(), hijriMonthRangeJD(),
    toISODate()
  - BARU: `ingredients.js` — makeIngredientResolver()
  - Diubah: `db.js` — require('./hijri'); tambah HIJRI_SEED_YEAR_FROM/TO,
    seedHijriMonths(); dipanggil di akhir file (menggantikan komentar
    placeholder "[Sesi 3] SENGAJA belum ada di sini...")
  - Diubah: `server.js` — require('./ingredients'); middleware
    express.json({limit:'10mb'}); isValidDateStr(),
    normalizeExpenseItem(); endpoint POST /api/expense-items; endpoint
    GET /api/expense-items; middleware error-handler utk body JSON tak
    valid
  - Dikonfirmasi TIDAK berubah: `schema.sql` (tidak ada perubahan skema
    sama sekali — seluruh tabel yg dipakai sudah didesain di sesi
    arsitektur 2026-08-17)

- Cara diuji:

  - Sandbox AI (Node.js terpisah — salinan package.json/schema.sql +
    db.js/server.js/hijri.js/ingredients.js versi baru, database
    sementara, BUKAN data/dashboard.db institusi):
    1. `npm install` lolos bersih (69 paket, 0 kerentanan).
    2. hijri.js diuji berdiri sendiri: kalibrasi anchor
       (hijriToJD(1447,1,1)→jdToGregorian = PERSIS 2025-06-27, cocok
       dokumentasi epoch Dashboard.html); round-trip Gregorian↔Hijri;
       kontinuitas SELURUH 612 bulan rentang seed (1440–1490H, 0 celah/
       tumpang-tindih); panjang tiap bulan selalu 29/30 hari;
       konsistensi 2-arah di 1224 titik (awal & akhir tiap bulan),
       0 mismatch — properti yg langsung menutup bug [B-6].
    3. db.js diuji lewat require sungguhan: fresh seed → 13 tabel +
       612 baris hijri_months (rentang persis 1440–1490); idempotensi
       lintas-proses (require ulang di proses Node BARU thd file DB
       sama) → row count tetap, tidak dobel.
    4. server.js diuji dgn server yg SUNGGUH di-boot (curl thd port
       sungguhan): resolusi ingredient (nama baru/nama sama beda
       kapital/varian manual/batch 50 baris 10 nama unik → tepat 10
       ingredient); item tanpa info satuan tersimpan quantity/unit/
       unit_price=null tapi total penuh; total auto-hitung dari
       quantity×unit_price; quantity=0 tersimpan sbg 0 bukan null;
       filter Masehi (from/to) & filter Hijriah (hijri_year/month) thd
       2 bulan Hijriah bertetangga sungguhan menghasilkan SET ITEM
       PERSIS SAMA; isolasi antar program dua arah; 7 skenario
       validasi/error (program tak dikenal, items kosong, tanggal
       invalid, total tak terhitung, raw_name kosong, batch campuran
       DITOLAK SEMUA — dikonfirmasi via query DB langsung, JSON rusak);
       FK enforcement langsung bypass API; regresi /api/ping &
       /api/programs; persistensi lintas-restart proses; server.log
       bersih dari stack trace sepanjang sesi.

  - Environment institusi (Windows 11 Pro, PowerShell 5.1, Node v24.19.0
    — lihat environment.md; dijalankan LANGSUNG oleh pengguna thd
    data/dashboard.db yang SUDAH ADA & dipakai sejak Sesi 2, BUKAN
    database kosong):
    1. Patch diterapkan (`git apply`), `npm install`, `node server.js`
       → server boot normal ("Server jalan di port 3000").
    2. Regresi: `GET /api/ping` & `GET /api/programs` → 200 OK, isi
       `programs` PERSIS SAMA dgn sebelum patch (created_at kedua baris
       tidak berubah: 2026-08-18 00:40:51) — mengonfirmasi upgrade
       skema tidak menyentuh/menduplikasi data yg sudah ada.
    3. `hijri_months` setelah dijalankan di atas DB lama → 612 baris
       tepat, sama seperti hasil sandbox.
    4. `POST /api/expense-items` (program kamisan, 2 baris: 1 item
       biasa + 1 item jasa/"Ongkos Kirim" hanya total) → berhasil,
       `new_ingredients:2` (keduanya memang bahan pertama kali di DB
       institusi). Percobaan pertama pakai `curl.exe` dgn JSON inline
       gagal ("Body request bukan JSON yang valid") — BUKAN bug
       server: root cause dikonfirmasi masalah PowerShell 5.1 merusak
       tanda kutip ganda bersarang saat meneruskan argumen ke proses
       eksternal. Diperbaiki pakai `Invoke-RestMethod` (native
       PowerShell, body via `ConvertTo-Json`) → sukses. Lihat catatan
       baru di environment.md.
    5. `GET /api/expense-items?program=kamisan` → mengembalikan PERSIS
       2 item yg baru disimpan, field lengkap & benar (item jasa:
       quantity/unit/unit_price null, total tetap 25000).
    6. Akses dari perangkat LAIN di LAN (browser HP/laptop lain via IP
       lokal) → `{"ok":true,...}` tampil.

  - Sengaja TIDAK diuji sesi ini (bukan kekurangan, tapi cakupan Fase 2
    per roadmap_checklist.md, bukan Sesi 3): jalur "Excel diparse di
    Dashboard.html lalu di-POST ke API ini" — jalur itu sendiri belum
    ada, karena integrasi Dashboard.html↔API baru mulai di Fase 2
    ("Ganti upload Excel manual → fetch dari API").

- Catatan/kendala:
  - Ditemukan (KONFIRMASI, bukan bug): konstanta HIJRI_ANCHOR di
    Dashboard.html (komentar "1 Sya'ban 1447H = 25 Jan 2026") TIDAK
    PERNAH dipakai kalkulasi apa pun di sana (dikonfirmasi lewat
    pencarian pemakaian — hanya muncul di baris deklarasinya sendiri).
    Port backend (pakai epoch HIJRI_EPOCH_JD yang SUNGGUH dipakai
    Dashboard.html) menghasilkan 1 Sya'ban 1447H = 20 Jan 2026, selisih
    5 hari dari komentar mati itu. Backend sengaja mengikuti epoch yang
    aktif dipakai (sudah dikonfirmasi cocok persis dgn anchor Muharram:
    27 Juni 2025) — bukan komentar HIJRI_ANCHOR yang tidak pernah
    dieksekusi.
  - Ditemukan selama pengujian institusi: `curl`/`curl.exe` di
    PowerShell 5.1 tidak bisa diandalkan utk body JSON yang diketik
    inline (tanda kutip ganda bersarang rusak saat diteruskan
    PowerShell) — `Invoke-RestMethod` yang bekerja. Ditambahkan sbg
    catatan di environment.md supaya sesi pengujian berikutnya tidak
    mengulang troubleshooting yang sama.
  - Rentang hijri_months (1440–1490 H, ≈2018–2068 M) — bisa diperluas
    kapan saja tanpa migrasi (ubah HIJRI_SEED_YEAR_FROM/TO di db.js,
    restart; INSERT OR IGNORE aman dijalankan ulang berkali-kali).
  - Desain "semua-atau-tidak-sama-sekali" per unggahan POST (menolak
    SELURUH batch kalau ada 1 baris invalid) — beda dari parser
    client-side lama yang MELEWATI baris bermasalah secara diam-diam.
    Keputusan baru yang diambil sesi ini krn belum ada keputusan
    eksplisit sebelumnya; kandidat didiskusikan ulang kalau perilaku
    "lewati baris bermasalah" ternyata lebih diinginkan.
  - Belum ada pengecekan konsistensi kalau quantity/unit_price/total
    dikirim BERSAMAAN tapi angkanya tidak nyambung (mis. quantity×
    unit_price ≠ total) — saat ini total dipakai apa adanya selama
    berupa angka valid, tidak dicocokkan silang. Dibahas di percakapan
    sesi ini, belum diputuskan apakah perlu ditambah toleransi/validasi.
  - Endpoint ini TIDAK mendeteksi/mencegah unggahan duplikat — sengaja
    tidak diputuskan sepihak, blm ada keputusan eksplisit di
    keputusan_backend.md; kandidat item terpisah.
  - `program` diidentifikasi lewat slug (bukan program_id) di kedua
    endpoint, konsisten dgn programs.slug sejak Sesi 2. Belum ada
    konfirmasi ini cocok dgn rencana integrasi Fase 2 yang sesungguhnya.
  - DELETE/PATCH utk expense_items (mis. koreksi salah unggah) sengaja
    di luar cakupan — item roadmap hanya minta "simpan & ambil".

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
