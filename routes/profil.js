const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

  res.render('profil/index', {
    title: 'Profil Saya - Arsip BPN',
    user,
    flash: req.flash,
    error: null,
    success: null
  });
});

router.post('/update', (req, res) => {
  const { nama_lengkap, email, telepon, nip, jabatan } = req.body;
  const id = req.session.user.id;

  db.prepare(`
    UPDATE users SET
      nama_lengkap = ?, email = ?, telepon = ?, nip = ?, jabatan = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nama_lengkap || '', email || '', telepon || '', nip || '', jabatan || '', id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, 'Ubah profil', 'Profil', 'Memperbarui data profil sendiri', req.ip);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  req.session.user = {
    ...req.session.user,
    nama_lengkap: user.nama_lengkap,
    nip: user.nip,
    jabatan: user.jabatan,
    email: user.email,
    telepon: user.telepon
  };

  req.flash = { type: 'success', message: 'Profil berhasil diperbarui' };
  res.redirect('/profil');
});

router.post('/password', (req, res) => {
  const { old_password, new_password, confirm_password } = req.body;
  const id = req.session.user.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  let error = null;

  if (!bcrypt.compareSync(old_password || '', user.password)) {
    error = 'Password lama salah!';
  } else if (!new_password || new_password.length < 6) {
    error = 'Password baru minimal 6 karakter!';
  } else if (new_password !== confirm_password) {
    error = 'Konfirmasi password tidak cocok!';
  }

  if (error) {
    req.flash = { type: 'error', message: error };
    return res.redirect('/profil');
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, 'Ubah password', 'Profil', 'Mengganti password akun sendiri', req.ip);

  req.flash = { type: 'success', message: 'Password berhasil diganti' };
  res.redirect('/profil');
});

module.exports = router;