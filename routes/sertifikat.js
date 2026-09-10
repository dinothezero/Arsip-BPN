const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const { uploadSertifikat } = require('../middleware/upload');
const fs = require('fs');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const { status, jenis, q, kecamatan } = req.query;

  let sql = `
    SELECT s.*, u.nama_lengkap as nama_operator
    FROM sertifikat s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== '') {
    sql += ' AND s.status_sertifikat = ?';
    params.push(status);
  }
  if (jenis && jenis !== '') {
    sql += ' AND s.jenis_sertifikat = ?';
    params.push(jenis);
  }
  if (kecamatan && kecamatan !== '') {
    sql += ' AND s.kecamatan = ?';
    params.push(kecamatan);
  }
  if (q && q !== '') {
    sql += ' AND (s.nomor_sertifikat LIKE ? OR s.nama_pemilik LIKE ? OR s.nik_pemilik LIKE ? OR s.letak_tanah LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY s.created_at DESC';

  const sertifikat = db.prepare(sql).all(...params);
  const jenisList = ['Hak Milik', 'Hak Guna Bangunan', 'Hak Pakai', 'Tanah Negara', 'Tanah Wakaf', 'Lainnya'];
  const statusList = ['Aktif', 'Blokir', 'Sengketa', 'Batal', 'Expired'];
  const kecamatanList = db.prepare('SELECT DISTINCT kecamatan FROM sertifikat WHERE kecamatan IS NOT NULL ORDER BY kecamatan').all();

  res.render('sertifikat/index', {
    title: 'Sertifikat Tanah - Sistem Arsip BPN',
    sertifikat,
    jenisList,
    statusList,
    kecamatanList,
    filters: { status, jenis, q, kecamatan }
  });
});

router.get('/create', (req, res) => {
  res.render('sertifikat/create', {
    title: 'Tambah Sertifikat - Sistem Arsip BPN'
  });
});

router.post('/create', uploadSertifikat.single('file_sertifikat'), (req, res) => {
  const {
    nomor_sertifikat, jenis_sertifikat, nama_pemilik, nik_pemilik, alamat_pemilik,
    luas_tanah, satuan_luas, letak_tanah, kelurahan, kecamatan, kabupaten, provinsi,
    nomor_petak, letter_c, tanggal_terbit, status_sertifikat, keterangan
  } = req.body;

  if (!nomor_sertifikat || !nama_pemilik || !letak_tanah || !jenis_sertifikat) {
    return res.status(400).send('<h3 style="margin:100px;text-align:center">Data tidak lengkap! <a href="/sertifikat/create">Kembali</a></h3>');
  }

  const file = req.file ? req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO sertifikat
    (nomor_sertifikat, jenis_sertifikat, nama_pemilik, nik_pemilik, alamat_pemilik,
     luas_tanah, satuan_luas, letak_tanah, kelurahan, kecamatan, kabupaten, provinsi,
     nomor_petak, letter_c, tanggal_terbit, status_sertifikat, keterangan, file_sertifikat, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nomor_sertifikat, jenis_sertifikat, nama_pemilik, nik_pemilik || null, alamat_pemilik || null,
    luas_tanah ? Number(luas_tanah) : null, satuan_luas || 'm2', letak_tanah,
    kelurahan || null, kecamatan || null, kabupaten || null, provinsi || null,
    nomor_petak || null, letter_c || null, tanggal_terbit || null,
    status_sertifikat || 'Aktif', keterangan || null, file, req.session.user.id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Tambah sertifikat', 'Sertifikat', `Menambahkan sertifikat ${nomor_sertifikat}`, req.ip);

  res.redirect(`/sertifikat/${Number(result.lastInsertRowid)}`);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const sertifikat = db.prepare(`
    SELECT s.*, u.nama_lengkap as nama_operator
    FROM sertifikat s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = ?
  `).get(id);

  if (!sertifikat) {
    return res.status(404).render('errors/404', { title: 'Tidak Ditemukan', user: req.session.user });
  }

  res.render('sertifikat/detail', {
    title: `Detail Sertifikat: ${sertifikat.nomor_sertifikat}`,
    sertifikat
  });
});

router.get('/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const sertifikat = db.prepare('SELECT * FROM sertifikat WHERE id = ?').get(id);
  if (!sertifikat) return res.status(404).send('Not found');

  res.render('sertifikat/edit', {
    title: 'Edit Sertifikat',
    sertifikat
  });
});

router.post('/:id/edit', uploadSertifikat.single('file_sertifikat'), (req, res) => {
  const id = Number(req.params.id);
  const {
    nomor_sertifikat, jenis_sertifikat, nama_pemilik, nik_pemilik, alamat_pemilik,
    luas_tanah, satuan_luas, letak_tanah, kelurahan, kecamatan, kabupaten, provinsi,
    nomor_petak, letter_c, tanggal_terbit, status_sertifikat, keterangan
  } = req.body;

  let file = req.body.existing_file || null;
  if (req.file) {
    file = req.file.filename;
    if (req.body.existing_file) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'sertifikat', req.body.existing_file);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  db.prepare(`
    UPDATE sertifikat SET
      nomor_sertifikat = ?, jenis_sertifikat = ?, nama_pemilik = ?, nik_pemilik = ?,
      alamat_pemilik = ?, luas_tanah = ?, satuan_luas = ?, letak_tanah = ?,
      kelurahan = ?, kecamatan = ?, kabupaten = ?, provinsi = ?, nomor_petak = ?,
      letter_c = ?, tanggal_terbit = ?, status_sertifikat = ?, keterangan = ?,
      file_sertifikat = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nomor_sertifikat, jenis_sertifikat, nama_pemilik, nik_pemilik || null,
    alamat_pemilik || null, luas_tanah ? Number(luas_tanah) : null, satuan_luas || 'm2',
    letak_tanah, kelurahan || null, kecamatan || null, kabupaten || null, provinsi || null,
    nomor_petak || null, letter_c || null, tanggal_terbit || null,
    status_sertifikat || 'Aktif', keterangan || null, file, id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Edit sertifikat', 'Sertifikat', `Mengubah sertifikat ${nomor_sertifikat}`, req.ip);

  res.redirect(`/sertifikat/${id}`);
});

router.post('/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  const sertifikat = db.prepare('SELECT * FROM sertifikat WHERE id = ?').get(id);

  if (sertifikat && sertifikat.file_sertifikat) {
    const filePath = path.join(__dirname, '..', 'uploads', 'sertifikat', sertifikat.file_sertifikat);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM sertifikat WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Hapus sertifikat', 'Sertifikat', `Menghapus sertifikat ${sertifikat.nomor_sertifikat}`, req.ip);

  res.redirect('/sertifikat');
});

module.exports = router;