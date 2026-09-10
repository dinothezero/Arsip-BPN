const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated, isKepala } = require('../middleware/auth');
const { uploadSuratKeluar } = require('../middleware/upload');
const fs = require('fs');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const { status, kategori, q, dari, sampai } = req.query;

  let sql = `
    SELECT sk.*, k.nama_kategori, u.nama_lengkap as nama_operator
    FROM surat_keluar sk
    LEFT JOIN kategori_surat k ON sk.kategori_id = k.id
    LEFT JOIN users u ON sk.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== '') {
    sql += ' AND sk.status = ?';
    params.push(status);
  }
  if (kategori && kategori !== '') {
    sql += ' AND sk.kategori_id = ?';
    params.push(Number(kategori));
  }
  if (q && q !== '') {
    sql += ' AND (sk.nomor_surat LIKE ? OR sk.perihal LIKE ? OR sk.tujuan LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (dari && dari !== '') {
    sql += ' AND sk.tanggal_surat >= ?';
    params.push(dari);
  }
  if (sampai && sampai !== '') {
    sql += ' AND sk.tanggal_surat <= ?';
    params.push(sampai);
  }

  sql += ' ORDER BY sk.created_at DESC';

  const surat = db.prepare(sql).all(...params);
  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('keluar','semua') ORDER BY nama_kategori`).all();
  const statusList = ['Draft', 'Disetujui', 'Dikirim', 'Selesai'];

  res.render('surat-keluar/index', {
    title: 'Surat Keluar - Arsip BPN',
    surat,
    kategoriList,
    statusList,
    filters: { status, kategori, q, dari, sampai }
  });
});

router.get('/create', (req, res) => {
  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('keluar','semua') ORDER BY nama_kategori`).all();
  const pengaturan = db.prepare('SELECT * FROM pengaturan LIMIT 1').get();

  res.render('surat-keluar/create', {
    title: 'Tambah Surat Keluar - Arsip BPN',
    kategoriList,
    pengaturan
  });
});

router.post('/create', uploadSuratKeluar.single('file_surat'), (req, res) => {
  const {
    nomor_surat, tanggal_surat, tujuan, perihal,
    kategori_id, keterangan, lampiran, status, pengirim, diterima_oleh
  } = req.body;

  if (!nomor_surat || !tanggal_surat || !tujuan || !perihal) {
    return res.status(400).send('<h3 style="margin:100px;text-align:center">Data tidak lengkap! <a href="/surat-keluar/create">Kembali</a></h3>');
  }

  const file = req.file ? req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO surat_keluar
    (nomor_surat, tanggal_surat, tujuan, perihal, kategori_id,
     keterangan, lampiran, file_surat, status, pengirim, diterima_oleh, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nomor_surat, tanggal_surat, tujuan, perihal, kategori_id || null,
    keterangan || null, lampiran || null, file, status || 'Draft', pengirim || null,
    diterima_oleh || null, req.session.user.id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Tambah surat keluar', 'Surat Keluar', `Menambahkan surat ${nomor_surat}`, req.ip);

  res.redirect(`/surat-keluar/${Number(result.lastInsertRowid)}`);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare(`
    SELECT sk.*, k.nama_kategori, u.nama_lengkap as nama_operator
    FROM surat_keluar sk
    LEFT JOIN kategori_surat k ON sk.kategori_id = k.id
    LEFT JOIN users u ON sk.created_by = u.id
    WHERE sk.id = ?
  `).get(id);

  if (!surat) {
    return res.status(404).render('errors/404', { title: 'Tidak Ditemukan', user: req.session.user });
  }

  const pengaturan = db.prepare('SELECT * FROM pengaturan LIMIT 1').get();

  res.render('surat-keluar/detail', {
    title: `Detail Surat: ${surat.nomor_surat}`,
    surat,
    pengaturan,
    formatTanggal: (date) => new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  });
});

router.post('/:id/status', isKepala, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ['Draft', 'Disetujui', 'Dikirim', 'Selesai'];
  if (!allowed.includes(status)) {
    return res.status(400).send('Status tidak valid');
  }

  db.prepare('UPDATE surat_keluar SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Update status surat', 'Surat Keluar', `Status surat #${id} menjadi ${status}`, req.ip);

  res.redirect(`/surat-keluar/${id}`);
});

router.get('/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare('SELECT * FROM surat_keluar WHERE id = ?').get(id);
  if (!surat) return res.status(404).send('Not found');

  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('keluar','semua') ORDER BY nama_kategori`).all();

  res.render('surat-keluar/edit', {
    title: 'Edit Surat Keluar',
    surat,
    kategoriList
  });
});

router.post('/:id/edit', uploadSuratKeluar.single('file_surat'), (req, res) => {
  const id = Number(req.params.id);
  const {
    nomor_surat, tanggal_surat, tujuan, perihal,
    kategori_id, keterangan, lampiran, status, pengirim, diterima_oleh
  } = req.body;

  let file = req.body.existing_file || null;
  if (req.file) {
    file = req.file.filename;
    if (req.body.existing_file) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'surat-keluar', req.body.existing_file);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  db.prepare(`
    UPDATE surat_keluar SET
      nomor_surat = ?, tanggal_surat = ?, tujuan = ?, perihal = ?,
      kategori_id = ?, keterangan = ?, lampiran = ?, file_surat = ?,
      status = ?, pengirim = ?, diterima_oleh = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nomor_surat, tanggal_surat, tujuan, perihal, kategori_id || null,
    keterangan || null, lampiran || null, file, status || 'Draft',
    pengirim || null, diterima_oleh || null, id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Edit surat keluar', 'Surat Keluar', `Mengubah surat ${nomor_surat}`, req.ip);

  res.redirect(`/surat-keluar/${id}`);
});

router.post('/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare('SELECT * FROM surat_keluar WHERE id = ?').get(id);

  if (surat && surat.file_surat) {
    const filePath = path.join(__dirname, '..', 'uploads', 'surat-keluar', surat.file_surat);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM surat_keluar WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Hapus surat keluar', 'Surat Keluar', `Menghapus surat #${id}`, req.ip);

  res.redirect('/surat-keluar');
});

module.exports = router;