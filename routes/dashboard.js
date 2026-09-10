const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const totalSuratMasuk = db.prepare('SELECT COUNT(*) as count FROM surat_masuk').get().count;
  const totalSuratKeluar = db.prepare('SELECT COUNT(*) as count FROM surat_keluar').get().count;
  const totalArsip = db.prepare('SELECT COUNT(*) as count FROM arsip_dokumen').get().count;
  const totalSertifikat = db.prepare('SELECT COUNT(*) as count FROM sertifikat').get().count;
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = 1').get().count;

  const suratMasukBulanIni = db.prepare(`
    SELECT COUNT(*) as count FROM surat_masuk
    WHERE strftime('%Y-%m', tanggal_diterima) = strftime('%Y-%m', 'now')
  `).get().count;

  const suratKeluarBulanIni = db.prepare(`
    SELECT COUNT(*) as count FROM surat_keluar
    WHERE strftime('%Y-%m', tanggal_surat) = strftime('%Y-%m', 'now')
  `).get().count;

  const suratMasukPerBulan = db.prepare(`
    SELECT strftime('%Y-%m', tanggal_diterima) as bulan,
           COUNT(*) as jumlah
    FROM surat_masuk
    WHERE tanggal_diterima >= date('now', '-6 months')
    GROUP BY bulan
    ORDER BY bulan
  `).all();

  const suratKeluarPerBulan = db.prepare(`
    SELECT strftime('%Y-%m', tanggal_surat) as bulan,
           COUNT(*) as jumlah
    FROM surat_keluar
    WHERE tanggal_surat >= date('now', '-6 months')
    GROUP BY bulan
    ORDER BY bulan
  `).all();

  const statusMasuk = db.prepare('SELECT status, COUNT(*) as jumlah FROM surat_masuk GROUP BY status').all();
  const statusKeluar = db.prepare('SELECT status, COUNT(*) as jumlah FROM surat_keluar GROUP BY status').all();
  const jenisSertifikat = db.prepare('SELECT jenis_sertifikat, COUNT(*) as jumlah FROM sertifikat GROUP BY jenis_sertifikat').all();

  const suratMasukTerbaru = db.prepare(`
    SELECT sm.*, k.nama_kategori
    FROM surat_masuk sm
    LEFT JOIN kategori_surat k ON sm.kategori_id = k.id
    ORDER BY sm.tanggal_diterima DESC
    LIMIT 5
  `).all();

  const suratKeluarTerbaru = db.prepare(`
    SELECT sk.*, k.nama_kategori
    FROM surat_keluar sk
    LEFT JOIN kategori_surat k ON sk.kategori_id = k.id
    ORDER BY sk.tanggal_surat DESC
    LIMIT 5
  `).all();

  const aktifitasTerbaru = db.prepare(`
    SELECT la.*, u.nama_lengkap, u.username
    FROM log_aktivitas la
    LEFT JOIN users u ON la.user_id = u.id
    ORDER BY la.created_at DESC
    LIMIT 8
  `).all();

  res.render('dashboard/index', {
    title: 'Dashboard - Sistem Arsip BPN',
    stats: {
      totalSuratMasuk,
      totalSuratKeluar,
      totalArsip,
      totalSertifikat,
      totalUsers,
      suratMasukBulanIni,
      suratKeluarBulanIni
    },
    chartData: {
      suratMasukPerBulan,
      suratKeluarPerBulan,
      statusMasuk,
      statusKeluar,
      jenisSertifikat
    },
    suratMasukTerbaru,
    suratKeluarTerbaru,
    aktifitasTerbaru
  });
});

module.exports = router;