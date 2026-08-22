// ============================================================
// Kalender Hijriah — port dari Dashboard.html (algoritma tabular)
// ke modul backend murni (tanpa DOM/browser). [Sesi 3 — B-6]
//
// SATU sumber kebenaran dipakai utk KEDUA arah (bulan Hijriah→rentang
// tanggal Masehi, DAN tanggal Masehi→bulan Hijriah) — lihat tabel
// hijri_months di schema.sql & seedHijriMonths() di db.js. Ini
// menutup bug lama di Dashboard.html: hijriMonthStartJD() (dipakai
// utk TAMPILAN rentang tanggal) sadar override ru'yah, sedangkan
// jdToHijri() (dipakai utk MENGELOMPOKKAN transaksi ke periode) murni
// tabular & tidak sadar override — dua jalur baca yang bisa
// menghasilkan bulan berbeda utk tanggal yang sama persis di sekitar
// batas bulan yang di-override. Karena backend menyimpan HASIL
// resolusi ke satu tabel (bukan menghitung ulang lewat 2 fungsi
// terpisah tiap kali dibutuhkan), bug ini tidak mungkin terjadi lagi
// by construction — lihat keputusan_backend.md B-6.
//
// Fungsi & rumus di bawah SENGAJA identik dgn Dashboard.html (sama
// epoch, sama urutan operasi) — bukan implementasi ulang dari nol —
// supaya periode yang dihasilkan backend selaras dgn histori
// perhitungan yang sudah dipakai & diverifikasi di sana (lihat
// changelog.md 2026-07-22 [6.4] & 2026-07-23 [6.2]/[6.3] utk riwayat
// perbaikan algoritma ini). HIJRI_ANCHOR (konstanta dekoratif di
// Dashboard.html yg TIDAK pernah dipakai kalkulasi apa pun di sana —
// dikonfirmasi lewat pencarian pemakaian di file) sengaja tidak
// diikutkan ke sini.
// ============================================================

// Epoch kalender Hijriah tabular: 1 Muharram 1 H = JDN 1948439,
// dikalibrasi agar 1 Muharram 1447 H = 27 Juni 2025 M (penetapan
// Kemenag RI) — sama persis dgn Dashboard.html.
const HIJRI_EPOCH_JD = 1948439;

function hijriToJD(year, month, day) {
  return day
    + Math.ceil(29.5 * (month - 1))
    + (year - 1) * 354
    + Math.floor((3 + 11 * year) / 30)
    + HIJRI_EPOCH_JD;
}

function gregorianToJD(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return 367 * y
    - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4)
    + Math.floor(275 * m / 9)
    + d + 1721013.5;
}

// z = JDN hari-penuh (integer). year ditaksir dulu dari rata-rata
// panjang tahun Hijriah, lalu dikoreksi looping — pola yg sudah
// diperbaiki & diverifikasi di Dashboard.html (komentar aslinya:
// "menebak tahun lalu mengoreksinya, kemudian mencari bulan dengan
// mencocokkan langsung ke hijriToJD — sehingga hasilnya selalu
// konsisten dan akurat").
function jdToHijri(jd) {
  const z = Math.floor(jd + 0.5);
  let year = Math.floor((30 * (z - HIJRI_EPOCH_JD) + 10646) / 10631);
  while (z >= hijriToJD(year + 1, 1, 1)) year++;
  while (z < hijriToJD(year, 1, 1)) year--;
  let month = 1;
  while (month < 12 && z >= hijriToJD(year, month + 1, 1)) month++;
  const day = z - hijriToJD(year, month, 1) + 1;
  return { year, month, day };
}

function jdToGregorian(jd) {
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return new Date(year, month - 1, day);
}

function gregorianToHijri(date) {
  return jdToHijri(gregorianToJD(date));
}

// Batas JD (hari-penuh) awal & akhir suatu bulan Hijriah. month HARUS
// 1..12. Akhir bulan 12 dihitung lewat hijriToJD(year+1,1,1)-1, BUKAN
// hijriToJD(year,13,1)-1 — keduanya TIDAK selalu sama krn suku
// floor((3+11*year)/30) beda antara year vs year+1. Pola yang sama
// dipakai hijriPeriodGregorianRange()/hijriMonthStartJD() di
// Dashboard.html.
function hijriMonthRangeJD(year, month) {
  const startJD = hijriToJD(year, month, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endJD = hijriToJD(nextYear, nextMonth, 1) - 1;
  return { startJD, endJD };
}

function pad2(n) { return String(n).padStart(2, '0'); }

// SENGAJA pakai getter LOKAL (bukan toISOString(), yang UTC) — pola
// yang sama dgn dateToISO() di Dashboard.html (komentar aslinya di
// sana: "toISOString() memakai UTC, sedangkan effective_from ditulis
// dari komponen LOKAL... kalau dicampur, tanggal grup bisa kebaca
// mundur/maju 1 hari di sekitar tengah malam, tergantung zona
// waktu"). jdToGregorian() di atas membuat Date lewat konstruktor
// lokal (new Date(year,month-1,day)), jadi pembacaan baliknya juga
// wajib lokal supaya konsisten — tidak masalah zona waktu apa pun
// yang dipakai server, selama konstruksi & pembacaan sama-sama lokal.
function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

module.exports = {
  HIJRI_EPOCH_JD,
  hijriToJD,
  gregorianToJD,
  jdToHijri,
  jdToGregorian,
  gregorianToHijri,
  hijriMonthRangeJD,
  toISODate,
};
