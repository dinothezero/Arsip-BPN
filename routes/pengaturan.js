const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const db = getDb();

router.use(isAuthenticated);

router.get('/', isAdmin, (req, res) => {
  const pengaturan = db.prepare('SELECT * FROM pengaturan LIMIT 1').get();
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const kategori = db.prepare('SELECT * FROM kategori_surat ORDER BY nama_kategori').all();

  res.render('pengaturan/index', {
    title: 'Pengaturan - Sistem Arsip BPN',
    pengaturan,
    users,
    kategori,
    flash: req.flash
  });
});

router.post('/kantor', isAdmin, (req, res) => {
  const { nama_kantor, alamat_kantor, telepon_kantor, email_kantor, website } = req.body;

  db.prepare(`
    UPDATE pengaturan SET
      nama_kantor = ?, alamat_kantor = ?, telepon_kantor = ?, email_kantor = ?, website = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(nama_kantor, alamat_kantor, telepon_kantor, email_kantor, website);

  req.flash = { type: 'success', message: 'Pengaturan kantor berhasil disimpan' };
  res.redirect('/pengaturan');
});

router.post('/user/add', isAdmin, (req, res) => {
  const { username, password, nama_lengkap, nip, jabatan, role, email, telepon } = req.body;

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    req.flash = { type: 'error', message: 'Username sudah digunakan!' };
    return res.redirect('/pengaturan');
  }

  const hash = bcrypt.hashSync(password || '123456', 10);
  db.prepare(`
    INSERT INTO users (username, password, nama_lengkap, nip, jabatan, role, email, telepon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(username, hash, nama_lengkap, nip || null, jabatan || 'Staff', role || 'user', email || null, telepon || null);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Tambah user', 'Pengaturan', `Menambahkan user ${username}`, req.ip);

  req.flash = { type: 'success', message: 'User berhasil ditambahkan' };
  res.redirect('/pengaturan');
});

router.post('/user/:id/edit', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { nama_lengkap, nip, jabatan, role, email, telepon, status } = req.body;

  db.prepare(`
    UPDATE users SET
      nama_lengkap = ?, nip = ?, jabatan = ?, role = ?, email = ?, telepon = ?, status = ?
    WHERE id = ?
  `).run(nama_lengkap, nip || null, jabatan || 'Staff', role || 'user', email || null, telepon || null, status ? 1 : 0, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Edit user', 'Pengaturan', `Mengubah user #${id}`, req.ip);

  res.redirect('/pengaturan');
});

router.post('/user/:id/reset-password', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  const hash = bcrypt.hashSync('123456', 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Reset password', 'Pengaturan', `Reset password user #${id}`, req.ip);

  res.redirect('/pengaturan');
});

router.post('/user/:id/delete', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.user.id) {
    req.flash = { type: 'error', message: 'Tidak dapat menghapus akun sendiri!' };
    return res.redirect('/pengaturan');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.redirect('/pengaturan');
});

router.post('/kategori/add', isAdmin, (req, res) => {
  const { nama_kategori, keterangan, tipe } = req.body;
  db.prepare('INSERT INTO kategori_surat (nama_kategori, keterangan, tipe) VALUES (?, ?, ?)')
    .run(nama_kategori, keterangan || null, tipe || 'semua');
  res.redirect('/pengaturan');
});

router.post('/kategori/:id/delete', isAdmin, (req, res) => {
  db.prepare('DELETE FROM kategori_surat WHERE id = ?').run(Number(req.params.id));
  res.redirect('/pengaturan');
});

router.post('/backup', isAdmin, (req, res) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

  const dbPath = path.join(__dirname, '..', 'database', 'bpn-arsip.db');
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
  }

  req.flash = { type: 'success', message: 'Backup database berhasil dibuat' };
  res.redirect('/pengaturan');
});

module.exports = router;