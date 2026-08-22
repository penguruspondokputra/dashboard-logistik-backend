# Target Environment

Dokumen ini mencatat environment komputer institusi yang menjadi target utama aplikasi.

Informasi di sini menjadi acuan untuk:
- instruksi instalasi;
- perintah terminal;
- pengujian manual;
- debugging;
- validasi kompatibilitas;
- perbandingan antara sandbox AI dan environment target.

## 1. Operating System

- OS: Windows 11 Pro
- Windows Version: 10.0.26100
- Architecture: 64-bit

## 2. Terminal / Shell

- Terminal: VS Code Integrated Terminal
- Shell: PowerShell
- PowerShell Version: 5.1.26100.7462
- PowerShell Edition: Desktop

## 3. Development Runtime

- Node.js: v24.19.0
- npm: 11.17.0
- VS Code: 1.134.0
- VS Code Architecture: x64

## 4. Project

- Project: dashboard-logistik-backend
- Backend runtime: Node.js
- Framework: Express 5.2.1
- Entry point: server.js
- Start command: npm start
- Database: SQLite
- SQLite driver: better-sqlite3 13.0.3
- Database/schema files: db.js, schema.sql
- Data directory: data
- Dependency manifest: package.json
- Dependency lock file: package-lock.json

## 5. Network / Server

- Server host: 0.0.0.0
- Default server port: 3000
- Start command: npm start
- Local access: http://localhost:3000

## 6. Environment Notes

- Windows/PowerShell merupakan environment target utama.
- Perintah yang diberikan untuk komputer institusi harus kompatibel dengan PowerShell 5.1.
- Perintah Linux/macOS tidak boleh diberikan sebagai instruksi langsung kepada pengguna tanpa padanan PowerShell yang sesuai.
- Versi Node.js dan npm harus dipertimbangkan ketika memvalidasi dependency atau runtime.
- better-sqlite3 merupakan dependency native sehingga kompatibilitas OS, arsitektur, dan versi Node.js harus diperhatikan.
- Jika environment sandbox AI menggunakan versi Node.js, npm, OS, shell, atau arsitektur yang berbeda, keberhasilan pengujian sandbox tidak boleh dianggap sebagai bukti kompatibilitas environment target.
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

## 7. Last Verified

- Tanggal: 2026-08-21
- Diverifikasi oleh: pengguna
- Perubahan sejak verifikasi sebelumnya: Dokumen environment dibuat dan baseline backend diverifikasi dari package.json serta server.js.