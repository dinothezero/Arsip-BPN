const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database/db');
const { isAuthenticated, isKepala } = require('../middleware/auth');

const db = getDb();

router.use(isAuthenticated);

router.get('/', (req, res) => {
  const { jenis, dari, sampai } = req.query;

  const tanggalDari = dari || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const tanggalSampai = sampai || new Date().toISOString().slice(0, 10);

  const dataLaporan = {};

  if (!jenis || jenis === 'rekap' || jenis === 'surat-masuk') {
    dataLaporan.suratMasuk = db.prepare(`
      SELECT * FROM surat_masuk
      WHERE tanggal_surat BETWEEN ? AND ?
      ORDER BY tanggal_surat
    `).all(tanggalDari, tanggalSampai);
    dataLaporan.totalSuratMasuk = dataLaporan.suratMasuk.length;

    dataLaporan.suratMasukPerKategori = db.prepare(`
      SELECT k.nama_kategori, COUNT(sm.id) as jumlah
      FROM surat_masuk sm
      LEFT JOIN kategori_surat k ON sm.kategori_id = k.id
      WHERE sm.tanggal_surat BETWEEN ? AND ?
      GROUP BY k.nama_kategori
      ORDER BY jumlah DESC
    `).all(tanggalDari, tanggalSampai);
  }

  if (!jenis || jenis === 'rekap' || jenis === 'surat-keluar') {
    dataLaporan.suratKeluar = db.prepare(`
      SELECT * FROM surat_keluar
      WHERE tanggal_surat BETWEEN ? AND ?
      ORDER BY tanggal_surat
    `).all(tanggalDari, tanggalSampai);
    dataLaporan.totalSuratKeluar = dataLaporan.suratKeluar.length;

    dataLaporan.suratKeluarPerKategori = db.prepare(`
      SELECT k.nama_kategori, COUNT(sk.id) as jumlah
      FROM surat_keluar sk
      LEFT JOIN kategori_surat k ON sk.kategori_id = k.id
      WHERE sk.tanggal_surat BETWEEN ? AND ?
      GROUP BY k.nama_kategori
      ORDER BY jumlah DESC
    `).all(tanggalDari, tanggalSampai);
  }

  if (!jenis || jenis === 'rekap' || jenis === 'sertifikat') {
    dataLaporan.sertifikat = db.prepare(`
      SELECT * FROM sertifikat
      WHERE (tanggal_terbit BETWEEN ? AND ?) OR tanggal_terbit IS NULL
      ORDER BY tanggal_terbit DESC
    `).all(tanggalDari, tanggalSampai);
    dataLaporan.totalSertifikat = dataLaporan.sertifikat.length;

    dataLaporan.sertifikatPerJenis = db.prepare(`
      SELECT jenis_sertifikat, COUNT(*) as jumlah
      FROM sertifikat
      GROUP BY jenis_sertifikat
      ORDER BY jumlah DESC
    `).all();

    dataLaporan.sertifikatPerStatus = db.prepare(`
      SELECT status_sertifikat, COUNT(*) as jumlah
      FROM sertifikat
      GROUP BY status_sertifikat
      ORDER BY jumlah DESC
    `).all();

    dataLaporan.totalLuas = db.prepare(`
      SELECT SUM(luas_tanah) as total, COUNT(*) as jumlah
      FROM sertifikat
      WHERE luas_tanah IS NOT NULL
    `).get();
  }

  if (!jenis || jenis === 'rekap' || jenis === 'arsip') {
    dataLaporan.arsip = db.prepare(`
      SELECT * FROM arsip_dokumen
      WHERE (tahun BETWEEN strftime('%Y', ?) AND strftime('%Y', ?)) OR tahun IS NULL
      ORDER BY tahun DESC
    `).all(tanggalDari, tanggalSampai);
    dataLaporan.totalArsip = dataLaporan.arsip.length;

    dataLaporan.arsipPerKategori = db.prepare(`
      SELECT kategori, COUNT(*) as jumlah
      FROM arsip_dokumen
      GROUP BY kategori
      ORDER BY jumlah DESC
    `).all();
  }

  if (!jenis || jenis === 'rekap') {
    const tahun = new Date(tanggalDari).getFullYear();
    const bulan = [];

    for (let i = 0; i < 12; i++) {
      const b = i + 1;
      const label = new Date(tahun, i, 1).toLocaleDateString('id-ID', { month: 'long' });
      const masuk = db.prepare(`
        SELECT COUNT(*) as count FROM surat_masuk
        WHERE strftime('%Y-%m', tanggal_surat) = ?
      `).get(`${tahun}-${String(b).padStart(2, '0')}`).count;
      const keluar = db.prepare(`
        SELECT COUNT(*) as count FROM surat_keluar
        WHERE strftime('%Y-%m', tanggal_surat) = ?
      `).get(`${tahun}-${String(b).padStart(2, '0')}`).count;
      bulan.push({ label, masuk, keluar });
    }

    dataLaporan.rekapBulanan = bulan;
  }

  dataLaporan.jenis = jenis || 'rekap';
  dataLaporan.tanggalDari = tanggalDari;
  dataLaporan.tanggalSampai = tanggalSampai;
  dataLaporan.namaKantor = db.prepare('SELECT * FROM pengaturan LIMIT 1').get();

  res.render('laporan/index', {
    title: 'Laporan - Arsip BPN',
    data: dataLaporan,
    filters: { jenis, dari, sampai }
  });
});

module.exports = router;