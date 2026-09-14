'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { getSessionSecret, DATA_DIR } = require('./db/db');
const { createTables, seedDefaults, rebuildFts } = require('./db/init');

// Pastikan skema ada sebelum modul lain menyiapkan pernyataan SQL
createTables();
seedDefaults();
try { rebuildFts(); } catch (e) { console.warn('[init] FTS:', e.message); }

const api = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.set('trust proxy', 1);
app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, secure: false },
}));

// Keamanan dasar
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// API
app.use('/api', api);

// Halaman depan (SPA)
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/api-docs', (req, res) => res.redirect('/'));

// 404 JSON untuk api, fallback SPA untuk lainnya
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (req.path.startsWith('/api')) {
    if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Berkas terlalu besar (maks 50MB).' });
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan.' });
  }
  next(err);
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log('===============================================');
  console.log('  SISTEM ARSIP - KANTOR PERTANAHAN (Lokal) v3');
  console.log('  Berjalan 100% di komputer ini, tanpa internet.');
  console.log('  Multi-akun, OCR dokumen, & pengelola database.');
  console.log(`  Buka:  http://localhost:${PORT}`);
  console.log('  Data lokal: ' + DATA_DIR);
  console.log('  Tekan Ctrl+C untuk berhenti.');
  console.log('===============================================');
});

// Cadangan otomatis: saat boot + tiap 24 jam (dipangkas jadi 10 file terakhir)
const { db: _db } = require('./db/db');
const { backupNow, listBackups } = require('./db/dbmgmt');
function autoBackup(reason) {
  try {
    const file = backupNow('auto');
    console.log(`[backup] Cadangan ${reason}: ${file}`);
  } catch (e) {
    console.warn('[backup] Gagal:', e.message);
  }
}
setTimeout(() => autoBackup('boot'), 3000);
setInterval(() => autoBackup('jadwal'), 24 * 60 * 60 * 1000);
try {
  const b = listBackups();
  if (b.length) console.log(`[backup] ${b.length} cadangan tersedia di data/backups/`);
} catch (e) { /* */ }

module.exports = { app, server };