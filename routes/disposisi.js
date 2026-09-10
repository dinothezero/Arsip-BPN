const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const { tipe, status, prioritas, q } = req.query;

  let sql = `
    SELECT d.*, u.nama_lengkap as nama_user,
           CASE WHEN d.tipe_surat = 'masuk' THEN sm.nomor_surat ELSE sk.nomor_surat END as nomor_surat,
           CASE WHEN d.tipe_surat = 'masuk' THEN sm.perihal ELSE sk.perihal END as perihal
    FROM disposisi d
    LEFT JOIN users u ON d.diteruskan_oleh = u.id
    LEFT JOIN surat_masuk sm ON d.tipe_surat = 'masuk' AND d.surat_id = sm.id
    LEFT JOIN surat_keluar sk ON d.tipe_surat = 'keluar' AND d.surat_id = sk.id
    WHERE 1=1
  `;
  const params = [];

  if (tipe && tipe !== '') {
    sql += ' AND d.tipe_surat = ?';
    params.push(tipe);
  }
  if (status && status !== '') {
    sql += ' AND d.status = ?';
    params.push(status);
  }
  if (prioritas && prioritas !== '') {
    sql += ' AND d.prioritas = ?';
    params.push(prioritas);
  }
  if (q && q !== '') {
    sql += ' AND (d.diteruskan_ke LIKE ? OR d.catatan LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY d.created_at DESC';

  const disposisi = db.prepare(sql).all(...params);
  const statusList = ['Menunggu', 'Diproses', 'Selesai'];
  const prioritasList = ['Segera', 'Penting', 'Biasa'];

  res.render('disposisi/index', {
    title: 'Disposisi Surat - Sistem Arsip BPN',
    disposisi,
    statusList,
    prioritasList,
    filters: { tipe, status, prioritas, q }
  });
});

router.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ['Menunggu', 'Diproses', 'Selesai'];
  if (!allowed.includes(status)) {
    return res.status(400).send('Status tidak valid');
  }

  db.prepare('UPDATE disposisi SET status = ? WHERE id = ?').run(status, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Update status disposisi', 'Disposisi', `Status disposisi #${id} menjadi ${status}`, req.ip);

  res.redirect('/disposisi');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM disposisi WHERE id = ?').run(Number(req.params.id));

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Hapus disposisi', 'Disposisi', `Menghapus disposisi #${req.params.id}`, req.ip);

  res.redirect('/disposisi');
});

module.exports = router;