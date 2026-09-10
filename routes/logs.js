const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const db = getDb();

router.use(isAuthenticated);

router.get('/', isAdmin, (req, res) => {
  const { user, modul, q } = req.query;

  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = 20;

  let sql = `
    SELECT la.*, u.nama_lengkap, u.username
    FROM log_aktivitas la
    LEFT JOIN users u ON la.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  const countParams = [];

  if (user && user !== '') {
    sql += ' AND la.user_id = ?';
    params.push(Number(user));
  }
  if (modul && modul !== '') {
    sql += ' AND la.modul = ?';
    params.push(modul);
  }
  if (q && q !== '') {
    sql += ' AND la.aktivitas LIKE ?';
    params.push(`%${q}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM log_aktivitas la WHERE 1=1 ${sql.split('WHERE 1=1')[1].split('ORDER BY')[0]}`).all(...params)[0].count;
  const totalPages = Math.ceil(total / perPage);
  const offset = (page - 1) * perPage;

  sql += ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?';
  params.push(perPage, offset);

  const logs = db.prepare(sql).all(...params);
  const users = db.prepare('SELECT id, username, nama_lengkap FROM users ORDER BY nama_lengkap').all();
  const moduls = db.prepare('SELECT DISTINCT modul FROM log_aktivitas WHERE modul IS NOT NULL ORDER BY modul').all();

  res.render('logs/index', {
    title: 'Log Aktivitas - Sistem Arsip BPN',
    logs,
    users,
    moduls,
    filters: { user, modul, q },
    page,
    totalPages,
    total
  });
});

router.get('/clear', isAdmin, (req, res) => {
  db.prepare('DELETE FROM log_aktivitas').run();
  res.redirect('/logs');
});

module.exports = router;