const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// [Sesi 2] Daftar program (Kamisan, Dukkan, dst.) — dipakai Sesi 3
// (expense_items) & Sesi 4 (targets) untuk relasi program_id, dan
// nanti oleh dashboard utk mengganti tebakan tipe file manual.
app.get('/api/programs', (req, res) => {
  const programs = db.prepare(
    'SELECT id, slug, name, file_type, created_at FROM programs ORDER BY id'
  ).all();
  res.json(programs);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT}`);
});
