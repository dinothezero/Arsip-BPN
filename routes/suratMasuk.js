const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const { uploadSuratMasuk } = require('../middleware/upload');
const fs = require('fs');

const db = getDb();

router.use(isAuthenticated);

function generateNomorAgenda() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const row = db.prepare('SELECT COUNT(*) as count FROM surat_masuk').get();
  const count = row.count + 1;
  return `${String(month).padStart(2, '0')}/${count.toString().padStart(3, '0')}/BPN/${year}`;
}

router.get('/', (req, res) => {
  const { status, kategori, q, dari, sampai, bulan } = req.query;

  let sql = `
    SELECT sm.*, k.nama_kategori, u.nama_lengkap as nama_operator
    FROM surat_masuk sm
    LEFT JOIN kategori_surat k ON sm.kategori_id = k.id
    LEFT JOIN users u ON sm.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== '') {
    sql += ' AND sm.status = ?';
    params.push(status);
  }
  if (kategori && kategori !== '') {
    sql += ' AND sm.kategori_id = ?';
    params.push(Number(kategori));
  }
  if (q && q !== '') {
    sql += ' AND (sm.nomor_surat LIKE ? OR sm.perihal LIKE ? OR sm.pengirim LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (dari && dari !== '') {
    sql += ' AND sm.tanggal_surat >= ?';
    params.push(dari);
  }
  if (sampai && sampai !== '') {
    sql += ' AND sm.tanggal_surat <= ?';
    params.push(sampai);
  }
  if (bulan && bulan !== '') {
    sql += " AND strftime('%Y-%m', sm.tanggal_surat) = ?";
    params.push(bulan);
  }

  sql += ' ORDER BY sm.created_at DESC';

  const surat = db.prepare(sql).all(...params);
  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('masuk','semua') ORDER BY nama_kategori`).all();
  const statusList = ['Baru', 'Diproses', 'Selesai', 'Diteruskan'];

  res.render('surat-masuk/index', {
    title: 'Surat Masuk - Sistem Arsip BPN',
    surat,
    kategoriList,
    statusList,
    filters: { status, kategori, q, dari, sampai, bulan }
  });
});

router.get('/create', (req, res) => {
  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('masuk','semua') ORDER BY nama_kategori`).all();
  const users = db.prepare('SELECT id, nama_lengkap, jabatan FROM users WHERE status = 1 ORDER BY nama_lengkap').all();
  const nomorAgenda = generateNomorAgenda();

  res.render('surat-masuk/create', {
    title: 'Tambah Surat Masuk - Sistem Arsip BPN',
    kategoriList,
    users,
    nomorAgenda
  });
});

router.post('/create', uploadSuratMasuk.single('file_surat'), (req, res) => {
  const {
    nomor_surat, tanggal_surat, tanggal_diterima, pengirim,
    perihal, kategori_id, keterangan, lampiran, status, disposisi, diterima_oleh
  } = req.body;

  if (!nomor_surat || !tanggal_surat || !pengirim || !perihal) {
    return res.status(400).send('<h3 style="margin:100px;text-align:center">Data tidak lengkap! <a href="/surat-masuk/create">Kembali</a></h3>');
  }

  const file = req.file ? req.file.filename : null;

  const result = db.prepare(`
    INSERT INTO surat_masuk
    (nomor_surat, tanggal_surat, tanggal_diterima, pengirim, perihal, kategori_id,
     keterangan, lampiran, file_surat, status, disposisi, diterima_oleh, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nomor_surat, tanggal_surat, tanggal_diterima || new Date().toISOString().slice(0, 10),
    pengirim, perihal, kategori_id || null, keterangan || null, lampiran || null,
    file, status || 'Baru', disposisi || null, diterima_oleh || null, req.session.user.id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Tambah surat masuk', 'Surat Masuk', `Menambahkan surat ${nomor_surat}`, req.ip);

  res.redirect(`/surat-masuk/${Number(result.lastInsertRowid)}`);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare(`
    SELECT sm.*, k.nama_kategori, u.nama_lengkap as nama_operator
    FROM surat_masuk sm
    LEFT JOIN kategori_surat k ON sm.kategori_id = k.id
    LEFT JOIN users u ON sm.created_by = u.id
    WHERE sm.id = ?
  `).get(id);

  if (!surat) {
    return res.status(404).render('errors/404', { title: 'Tidak Ditemukan', user: req.session.user });
  }

  const disposisiList = db.prepare(`
    SELECT d.*, u.nama_lengkap as nama_user
    FROM disposisi d
    LEFT JOIN users u ON d.diteruskan_oleh = u.id
    WHERE d.surat_id = ? AND d.tipe_surat = 'masuk'
    ORDER BY d.created_at DESC
  `).all(id);

  const users = db.prepare('SELECT id, nama_lengkap, jabatan FROM users WHERE status = 1 ORDER BY nama_lengkap').all();

  res.render('surat-masuk/detail', {
    title: `Detail Surat: ${surat.nomor_surat}`,
    surat,
    disposisiList,
    users,
    formatTanggal: (date) => new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  });
});

router.post('/:id/disposisi', (req, res) => {
  const id = Number(req.params.id);
  const { diteruskan_ke, catatan, prioritas } = req.body;

  db.prepare(`
    INSERT INTO disposisi (surat_id, tipe_surat, diteruskan_ke, catatan, prioritas, diteruskan_oleh)
    VALUES (?, 'masuk', ?, ?, ?, ?)
  `).run(id, diteruskan_ke, catatan || null, prioritas || 'Biasa', req.session.user.id);

  db.prepare(`UPDATE surat_masuk SET status = 'Diteruskan', disposisi = ? WHERE id = ?`).run(diteruskan_ke, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Disposisi surat', 'Surat Masuk', `Disposisi surat #${id} ke ${diteruskan_ke}`, req.ip);

  res.redirect(`/surat-masuk/${id}`);
});

router.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowed = ['Baru', 'Diproses', 'Selesai', 'Diteruskan'];
  if (!allowed.includes(status)) {
    return res.status(400).send('Status tidak valid');
  }

  db.prepare('UPDATE surat_masuk SET status = ? WHERE id = ?').run(status, id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Update status surat', 'Surat Masuk', `Status surat #${id} menjadi ${status}`, req.ip);

  res.redirect(`/surat-masuk/${id}`);
});

router.get('/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare('SELECT * FROM surat_masuk WHERE id = ?').get(id);
  if (!surat) return res.status(404).send('Not found');

  const kategoriList = db.prepare(`SELECT * FROM kategori_surat WHERE tipe IN ('masuk','semua') ORDER BY nama_kategori`).all();
  const users = db.prepare('SELECT id, nama_lengkap, jabatan FROM users WHERE status = 1 ORDER BY nama_lengkap').all();

  res.render('surat-masuk/edit', {
    title: 'Edit Surat Masuk',
    surat,
    kategoriList,
    users
  });
});

router.post('/:id/edit', uploadSuratMasuk.single('file_surat'), (req, res) => {
  const id = Number(req.params.id);
  const {
    nomor_surat, tanggal_surat, tanggal_diterima, pengirim,
    perihal, kategori_id, keterangan, lampiran, status, disposisi, diterima_oleh
  } = req.body;

  let file = req.body.existing_file || null;
  if (req.file) {
    file = req.file.filename;
    if (req.body.existing_file) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'surat-masuk', req.body.existing_file);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  db.prepare(`
    UPDATE surat_masuk SET
      nomor_surat = ?, tanggal_surat = ?, tanggal_diterima = ?, pengirim = ?,
      perihal = ?, kategori_id = ?, keterangan = ?, lampiran = ?, file_surat = ?,
      status = ?, disposisi = ?, diterima_oleh = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nomor_surat, tanggal_surat, tanggal_diterima, pengirim, perihal,
    kategori_id || null, keterangan || null, lampiran || null, file,
    status || 'Baru', disposisi || null, diterima_oleh || null, id
  );

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Edit surat masuk', 'Surat Masuk', `Mengubah surat ${nomor_surat}`, req.ip);

  res.redirect(`/surat-masuk/${id}`);
});

router.post('/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  const surat = db.prepare('SELECT * FROM surat_masuk WHERE id = ?').get(id);

  if (surat && surat.file_surat) {
    const filePath = path.join(__dirname, '..', 'uploads', 'surat-masuk', surat.file_surat);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM surat_masuk WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO log_aktivitas (user_id, aktivitas, modul, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, 'Hapus surat masuk', 'Surat Masuk', `Menghapus surat #${id}`, req.ip);

  res.redirect('/surat-masuk');
});

module.exports = router;