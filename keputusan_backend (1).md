# Keputusan — Migrasi Backend & Fitur Baru

Dibuat 16 Agustus 2026. Berbeda scope dari `keputusan.md` (khusus temuan review
kode `Dashboard.html` yang sudah ada) — file ini utk keputusan arsitektur
BACKEND BARU dan FITUR BARU (forward-looking), hasil diskusi ttg
`Fitur Dashboard Expense Trac.md`. Format ID: `B-N`, terpisah dari penomoran
`keputusan.md` supaya tidak tabrakan.

Rujukan terkait: `Fitur Dashboard Expense Trac.md` (checklist fitur), `keputusan.md`
(temuan kode lama, termasuk 19.1 — bug kalender, ditemukan lewat diskusi ini),
`roadmap_checklist.md` (Sesi 1-2 backend sudah jalan: `programs` table + endpoint).

## Ringkasan

| ID | Topik | Keputusan | Status |
|---|---|---|---|
| B-1 | Alert/notifikasi anomali harga | Tidak ada push eksternal (WA/email/SMS) — sistem ini pusat data (pull), bukan aplikasi (push). Tampil live tiap dashboard dibuka; perlu status "sudah dibaca" ringan per item (hilang setelah pertama dilihat), BUKAN riwayat siapa/kapan penuh | Final |
| B-2 | Chart utk bahan yang di-flag anomali | Kaitan `keputusan.md` 8.4 (% dari baseline sudah dicoba, staf kesulitan baca tanpa nominal). Utk kasus alert: hindari masalahnya sepenuhnya — bahan yg di-flag dapat chart TERSENDIRI (1 seri, skala sendiri sendiri), tidak digabung ke chart multi-bahan yg sudah ada. Tidak mengubah/menggantikan 8.4 utk fitur pembanding manual (combobox), yang tetap terbuka terpisah kalau mau direvisit | Final (utk alert) |
| B-3 | Musim "aktif kampus" (existing, kosmetik di forecast) | Tetap placeholder kasar apa adanya; validasi ulang setelah data beberapa periode terkumpul | Final |
| B-4 | Dua konsep "musiman" | Dipertahankan berdampingan, sesuai niat awal: kalender aktivitas kampus (pengaruh ke VOLUME belanja) vs musim harga pasar (pengaruh ke HARGA per bahan) — dua entitas data terpisah, bukan digabung | Final |
| B-5 | Sumber histori utk migrasi | Tidak ada data tersimpan di app vanilla JS (session-only, hilang tiap refresh) MAUPUN pembukuan sebelumnya (cuma total per pengeluaran, tanpa rincian bahan) — tidak ada yang bisa di-backfill sama sekali. Backend mulai KOSONG. Konsekuensi linimasa (dihitung, bukan estimasi kasar): YoY sebagian mulai berguna ~10 Jan 2027, YoY satu tahun ajaran penuh pertama ~akhir Des 2027. Pengujian fitur baru pakai data dummy | Final |
| B-6 | Bug kalender: override ru'yah tidak konsisten | Lihat `keputusan.md` ID 19.1 (baru ditambahkan). Ringkas: fungsi tampilan rentang tanggal sadar override, fungsi pengelompokan transaksi→periode tidak — dibuktikan empiris. Backend baru: satu tabel resolusi batas bulan Hijriah dipakai utk kedua arah, menutup bug ini by construction | Final |
| B-7 | Resolusi nama bahan → `ingredient_id` | Resolve SEKALI saat data masuk (bukan tiap query, beda dari `applyLibrary()` sekarang). Nama tak dikenal di library → otomatis jadi ingredient baru, kategori kosong — bukan silent passthrough spt sekarang | Final |
| B-8 | YoY — penomoran periode & tampilan | Anchor-Muharram (existing) TETAP dipakai apa adanya di semua tempat yang sudah ada (pil periode, dst) — tidak berubah tampilan sama sekali. Anchor-Sya'ban ("minggu ke-N tahun ajaran") HANYA jadi kunci join internal utk penyelarasan YoY — TIDAK PERNAH ditampilkan ke user, apalagi berdampingan dgn label yang sudah ada | Final |
| B-9 | Inflasi — baseline item baru | Ingredient baru dikecualikan dari index sampai muncul lagi di PERIODE MANAPUN berikutnya (≥2 titik data) — tidak harus posisi yang sama tahun ajaran lalu | Final |
| B-10 | Inflasi — cakupan BPS eksternal | Tabel disiapkan kosong sekarang (struktur ada, data manual menyusul kapan pun siap) | Final |
| B-14 *(kelewat dari sesi pertama, baru ditutup saat schema.sql ditulis)* | Taksonomi kategori bahan | Tabel `categories` + `ingredients.category_id` (nullable, konsisten dgn B-7). Diisi starter set yang wajar, BUKAN keputusan final/mengunci — bebas diubah kapan saja | Final |
| B-15 *(kelewat dari sesi pertama, baru ditutup saat schema.sql ditulis)* | Kedalaman konversi satuan (cost-per-menu) | Beda dari B-10: TIDAK disiapkan strukturnya sama sekali di `schema.sql` ini. Bagian dari cluster Menu/Resep yang lebih besar & belum didiskusikan sedalam fitur lain, konsisten dgn B-12 ("prioritas belakangan") — didiskusikan terpisah nanti saat cluster ini digarap | Final |
| B-11 | Pola musiman per bahan | Dua basis kalender didukung sekaligus: Hijriah (Ramadhan–Lebaran, Idul Adha) & Masehi (panen, Nataru) — disimpan seragam sbg rentang tanggal Masehi konkret per kemunculan tahunan, apa pun basis kalender aslinya. Dua sumber angka dibedakan: prior nasional (default/cold-start) vs hasil belajar dari data sendiri (learned, setelah cukup siklus) | Final |
| B-12 | Cost per menu — target biaya per porsi | Entitas independen dari target belanja (TIDAK direkonsiliasi ke total belanja aktual) — karena tidak ada pencatatan "berapa porsi disajikan" di mana pun. Murni cek referensi "resep ini wajar biayanya atau tidak". Pola `effective_from` dipakai ulang utk versi nilai target ini | Final |
| B-13 | Pola `effective_from` & keterkaitan Fase 5 (RAPB) | Proses PENENTUAN target (siapa mengusulkan/menyetujui) ditunda ke Fase 5 sesuai `roadmap_checklist.md`. Schema disiapkan sekarang: nilai + `effective_from` + `set_by` (nullable, aktif setelah Fase 3/login jalan). RAPB kemungkinan besar hanya menambah lapisan DI ATAS primitif ini (mis. entitas "usulan anggaran" + status approval) — primitif yang dibangun sekarang tidak perlu dibongkar, tapi tambahan tabel kecil di Fase 5 belum bisa dijamin nol | Final (dgn catatan risiko kecil) |

## Efek samping positif dari migrasi (dicatat, bukan keputusan baru)

- `keputusan.md` 9.2a ("config tidak portable antar perangkat, tersimpan lokal per browser") otomatis selesai — target/library/kalender pindah ke server, bukan `localStorage` lagi.

## Status

Seluruh B-1 s/d B-15 final. `schema.sql` mulai ditulis 17 Agustus 2026, diuji jalan
langsung di SQLite (lihat catatan di `schema.sql` & pesan sesi terkait) — bukan
cuma ditulis di atas kertas.
