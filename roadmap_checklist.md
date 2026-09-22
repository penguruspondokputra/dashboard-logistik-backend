# Roadmap Migrasi Full-Stack — Dashboard Pangan

Dibuat 12 Agustus 2026. Checklist ini yang di-update tiap kali ada progres.

## Fase 1 — Fondasi Backend
- [x] Sesi 1: Setup proyek Node.js kosong + endpoint health-check
- [x] Sesi 2: Database dari schema.sql + endpoint `programs` (seed Kamisan & Dukkan)
      — SQLite via `better-sqlite3` (prebuilt binary, tidak perlu build tool di
      komputer institusi — sudah dicoba `npm install` bersih). File `dashboard.db`
      dibuat otomatis di `data/` saat server start (folder ini di luar git, sama
      seperti pola `*.db` yang sudah ada di .gitignore). `schema.sql` & `db.js`
      di root proyek (sejajar `server.js`), bukan di subfolder — skema akan
      bertambah tiap sesi (expense_items Sesi 3, targets Sesi 4), dieksekusi
      ulang tiap start lewat `CREATE TABLE IF NOT EXISTS` (aman, tidak menghapus
      data). Kolom `programs.file_type` sengaja tidak diberi CHECK constraint —
      Fase 4 mungkin bawa format baru utk 9 program lain yang belum ditentukan.
- [x] Sesi 3: Endpoint `expense_items` (simpan & ambil per program/periode)
- [x] Sesi 4: Endpoint `targets` + migrasi `targetsHistory` lama dari localStorage
- [ ] Sesi 5: Deploy ke komputer institusi, tes akses local network

## Fase 2 — Sambungkan Dashboard
- [ ] Ganti upload Excel manual → fetch dari API (baca)
      — Parsing TETAP di Dashboard.html (browser); parser yang ada
      (detectHeaderRow, extractItems, parseRekapMultiNota,
      parseDateFromLabel, dkk.) sudah disesuaikan persis dgn bentuk file
      Excel institusi dan TIDAK disentuh/ditulis ulang. Pekerjaan sesi
      ini murni jembatan: map item hasil parsing → payload
      POST /api/expense-items yang sudah dibangun & diverifikasi di
      Sesi 3 (lihat changelog_backend.md 2026-08-21):
        program        ← file.type ('mingguan'→'kamisan', 'vendor'→'dukkan')
        raw_name       ← item.nama DARI state.files LANGSUNG (SEBELUM
                          applyLibrary()/Data Library diterapkan —
                          mapping itu baru terjadi di getScopeSheets(),
                          bukan di parseSheet()/parseRekapMultiNota())
        quantity/unit/unit_price/total ← langsung dari item
        transaction_date ← itemEffectiveDate(sheet,item), diformat YYYY-MM-DD

      PENTING: transaction_date WAJIB pakai getter tanggal LOKAL
      (getFullYear/getMonth/getDate — pola sama dgn dateToISO()/
      todayISODate() yg sudah ada di file ini & toISODate() di hijri.js
      backend), BUKAN toISOString() (UTC) — kelas bug yg sudah pernah
      kejadian di bagian lain file ini.

      BELUM DIPUTUSKAN (didiskusikan terpisah saat sesi ini mulai, bukan
      diasumsikan di sini): apakah Data Library (modal + localStorage,
      applyLibrary()) tetap dipakai berdampingan dgn resolusi ingredient
      di backend [B-7], atau pelan-pelan digantikan.
- [ ] Ganti target & library normalisasi dari localStorage → API
- [ ] Logika rendering, forecast, dan kalender Hijriah tetap dipakai apa adanya

## Fase 3 — Akses & Peran
- [ ] Login sederhana: editor (kamu) vs viewer (staf lain)

## Fase 4 — Perluas ke 11 Program
- [ ] Tambah 9 program lain ke tabel `programs`
- [ ] Tentukan format Excel & alur unggah masing-masing (belum tentu sama seperti Kamisan/Dukkan)

## Fase 5 — Fitur Lanjutan
- [ ] Modul UI untuk target/RAPB (di atas tabel `targets` yang sudah ada)
- [ ] Fitur lain yang belum dirinci
