const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { uploadArsip } = require('../middleware/upload');
const fs = require('fs');

const db = getDb();

router.use(isAuthenticated);

// Kategori arsip statis berdasarkan klasifikasi BPN
const KATEGORI_ARSIP = [
  'Sertifikat & Buku Tanah',
  'Surat Ukur & Peta',
  'Warkah & Risalah',
  'Roya & Hapus Sertifikat',
  'Hak Tanggungan',
  'Ganti Rugi',
  'Tata Usaha',
  'Kepegawaian',
  'Keuangan',
  'Perencanaan',
  'Lainnya'
];

router.get('/', (req, res) => {
  const { status, kategori, q, tahun } = req.query;

  let sql = `
    SELECT ad.*, u.nama_lengkap as nama_operator
    FROM arsip_dokumen ad
    LEFT JOIN users u ON ad.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== '') {
    sql += ' AND ad.status = ?';
    params.push(status);
  }
  if (kategori && kategori !== '') {
    sql += ' AND ad.kategori = ?';
    params.push(kategori);
  }
  if (tahun && tahun !== '') {
    sql += ' AND ad.tahun = ?';
    params.push(Number(tahun));
  }
  if (q && q !== '') {
    sql += ' AND (ad.kode_arsip LIKE ? OR ad.judul LIKE ? OR ad.deskripsi LIKE ? OR ad.lokasi_rak LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY ad.created_at DESC';

  const arsip = db.prepare(sql).all(...params);
  const statusList = ['Aktif', 'Arsip', 'Rusak', 'Hilang'];
  const tahunList = db.prepare('SELECT DISTINCT tahun FROM arsip_dokumen WHERE tahun IS NOT NULL ORDER BY tahun DESC').all();

  res.render('arsip/index', {
    title: 'Arsip Dokumen - Arsip BPN',
    arsip,
    statusList,
    kategoriList: KATEGORI_ARSIP,
    tahunList,
    filters: { status, kategori, q, tahun }
  });
});

router.get('/create', (req, res) => {
  const lastKode = db.prepare('SELECT kode_arsip FROM arsip_dokumen ORDER BY id DESC LIMIT 1').get();
  let nextNumber = 1;
  if (lastKode) {
    const match = lastKode.kode_arsip.match(/(\d+)$/);
    if (match) nextNumber = Number(match[1]) + 1;
  }
  const kodeSaran = `ARS-${String(nextNumber).padStart(4, '0')}-${new Date().getFullYear()}`;

  res.render('arsip/create', {
    title: 'Tambah Arsip - Arsip BPN',
    kategoriList: KATEGORI_ARSIP,
    kodeSaran
  });
});

router.post('/create', uploadArsip.single('file_dokumen'), (req, res) => {
  const {
    kode_arsip, judul, deskripsi, kategori, sub_kategori,
    lokasi_rak, lokasi_box, tahun, status
  } = req.body;

  if (!kode_arsip || !judul || !kategori) {
    return res.status(400).send('<h3 style="margin:100px;text-align:center">Data tidak lengkap! <a href="/arsip/create">Kembali</a></h3>');
  }

  const file = req.file ? req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO arsip_dokumen
    (kode_arsip, judul, deskripsi, kategori, sub_kategori, lokasi_rak, lokasi_box,
     tahun, file_dokumen, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    kode_arsip, judul, deskripsi || null, kategori, sub_kategori || null,
    lokasi_rak || null, lokasi_box || null, tahun || null, file,
    status || 'Aktif', req.session.user.id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Tambah arsip', 'Arsip', `Menambahkan arsip ${kode_arsip}`, req.ip);

  res.redirect(`/arsip/${Number(result.lastInsertRowid)}`);
});

router.get('/generate-kode', (req, res) => {
  const kategoriMap = {
    'Sertifikat & Buku Tanah': 'SBT',
    'Surat Ukur & Peta': 'SUP',
    'Warkah & Risalah': 'WKR',
    'Roya & Hapus Sertifikat': 'RHS',
    'Hak Tanggungan': 'HT',
    'Ganti Rugi': 'GR',
    'Tata Usaha': 'TU',
    'Kepegawaian': 'KPG',
    'Keuangan': 'KNG',
    'Perencanaan': 'PRC',
    'Lainnya': 'LNY'
  };
  const kategori = req.query.kategori || 'Lainnya';
  const prefix = kategoriMap[kategori] || 'LNY';
  const year = new Date().getFullYear();

  const lastKode = db.prepare(`
    SELECT kode_arsip FROM arsip_dokumen
    WHERE kode_arsip LIKE ? ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextNumber = 1;
  if (lastKode) {
    const match = lastKode.kode_arsip.match(/(\d+)$/);
    if (match) nextNumber = Number(match[1]) + 1;
  }

  const kode = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
  res.json({ kode });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const arsip = db.prepare(`
    SELECT ad.*, u.nama_lengkap as nama_operator
    FROM arsip_dokumen ad
    LEFT JOIN users u ON ad.created_by = u.id
    WHERE ad.id = ?
  `).get(id);

  if (!arsip) {
    return res.status(404).render('errors/404', { title: 'Tidak Ditemukan', user: req.session.user });
  }

  res.render('arsip/detail', {
    title: `Detail Arsip: ${arsip.kode_arsip}`,
    arsip
  });
});

router.get('/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const arsip = db.prepare('SELECT * FROM arsip_dokumen WHERE id = ?').get(id);
  if (!arsip) return res.status(404).send('Not found');

  res.render('arsip/edit', {
    title: 'Edit Arsip',
    arsip,
    kategoriList: KATEGORI_ARSIP
  });
});

router.post('/:id/edit', uploadArsip.single('file_dokumen'), (req, res) => {
  const id = Number(req.params.id);
  const {
    kode_arsip, judul, deskripsi, kategori, sub_kategori,
    lokasi_rak, lokasi_box, tahun, status
  } = req.body;

  let file = req.body.existing_file || null;
  if (req.file) {
    file = req.file.filename;
    if (req.body.existing_file) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'arsip', req.body.existing_file);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  db.prepare(`
    UPDATE arsip_dokumen SET
      kode_arsip = ?, judul = ?, deskripsi = ?, kategori = ?, sub_kategori = ?,
      lokasi_rak = ?, lokasi_box = ?, tahun = ?, file_dokumen = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    kode_arsip, judul, deskripsi || null, kategori, sub_kategori || null,
    lokasi_rak || null, lokasi_box || null, tahun || null, file, status || 'Aktif', id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Edit arsip', 'Arsip', `Mengubah arsip ${kode_arsip}`, req.ip);

  res.redirect(`/arsip/${id}`);
});

router.post('/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  const arsip = db.prepare('SELECT * FROM arsip_dokumen WHERE id = ?').get(id);

  if (arsip && arsip.file_dokumen) {
    const filePath = path.join(__dirname, '..', 'uploads', 'arsip', arsip.file_dokumen);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM arsip_dokumen WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Hapus arsip', 'Arsip', `Menghapus arsip ${arsip.kode_arsip}`, req.ip);

  res.redirect('/arsip');
});

module.exports = router;