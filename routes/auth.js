const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const { getDb } = require('../database/db');

const db = getDb();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', {
    layout: false,
    title: 'Login - Arsip BPN',
    error: null
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).render('auth/login', {
      layout: false,
      title: 'Login - Arsip BPN',
      error: 'Username dan password wajib diisi!'
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = 1').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).render('auth/login', {
      layout: false,
      title: 'Login - Arsip BPN',
      error: 'Username atau password salah!'
    });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render('auth/login', {
        layout: false,
        title: 'Login - Arsip BPN',
        error: 'Terjadi kesalahan pada server'
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      nip: user.nip,
      jabatan: user.jabatan,
      role: user.role,
      email: user.email
    };

    db.prepare(`
      INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, 'Login ke sistem', 'Auth', `User ${user.username} berhasil login`, req.ip);

    res.redirect('/dashboard');
  });
});

router.get('/logout', (req, res) => {
  if (req.session.user) {
    db.prepare(`
      INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.session.user.id, 'Logout dari sistem', 'Auth', 'User logout', req.ip);
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;