'use strict';

// Migrasi dari database lama (v1, struktur surat_masuk/surat_keluar/arsip_dokumen)
// ke struktur baru v2 (tabel arsip tunggal + kategori).
// Cukup jalankan: npm run migrate

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const { db, DATA_DIR } = require('./db');
const { createTables, seedDefaults } = require('./init');

const OLD_DB_PATH = [
  path.join(__dirname, '..', '..', 'database', 'arsip-bpn.db'),
  path.join(DATA_DIR, 'arsip-bpn-old-v1.db'),
].find((p) => fs.existsSync(p));

function migrate() {
  createTables();
  seedDefaults();

  if (!OLD_DB_PATH) {
    console.log('[migrate] Tidak ada database lama yang ditemukan. Tidak ada yang perlu dimigrasi.');
    return;
  }

  console.log('[migrate] Menemukan database lama:', OLD_DB_PATH);
  const old = new DatabaseSync(OLD_DB_PATH, { readOnly: true });
  const newIsEmpty = db.prepare('SELECT COUNT(*) AS n FROM arsip').get().n === 0;

  try {
    // Profil kantor
    try {
      const p = old.prepare('SELECT * FROM pengaturan WHERE id=1').get();
      if (p) {
        db.prepare(`UPDATE pengaturan SET nama_kantor=?, alamat=?, telepon=?, email=?, updated_at=datetime('now','localtime') WHERE id=1`)
          .run(p.nama_kantor || 'KANTOR PERTANAHAN', p.alamat || '', p.telepon || '', p.email || '');
        console.log('[migrate] Profil kantor disalin.');
      }
    } catch (e) { /* tabel mungkin tak ada */ }

    // Pengguna
    try {
      const rows = old.prepare('SELECT * FROM users').all();
      const ins = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, nama_lengkap, nip, jabatan, role, status) VALUES (?,?,?,?,?,?,?)');
      for (const u of rows) {
        const roleMap = { admin: 'admin', kepala: 'kepala', user: 'staf' };
        ins.run(u.username, (u.password && u.password.startsWith('$2')) ? u.password : bcrypt.hashSync(u.password || 'password123', 10),
          u.nama_lengkap || u.username, u.nip || '', u.jabatan || '', roleMap[u.role] || 'staf', u.status ?? 1);
      }
      console.log(`[migrate] ${rows.length} pengguna disalin.`);
    } catch (e) { console.log('[migrate] users: dilewati (' + e.message + ')'); }

    // Kategori
    const katMap = {};
    try {
      const rows = old.prepare('SELECT * FROM kategori_surat').all();
      const ins = db.prepare('INSERT INTO kategori (kode, nama_kategori, keterangan) VALUES (?,?,?)');
      for (const k of rows) {
        const kode = (k.nama_kategori || 'K').replace(/\s+/g, '').toUpperCase().slice(0, 6);
        ins.run(kode, k.nama_kategori, k.keterangan || '');
        katMap[k.id] = db.prepare('SELECT id FROM kategori WHERE kode=?').get(kode).id;
      }
      console.log(`[migrate] ${rows.length} kategori surat disalin.`);
    } catch (e) { console.log('[migrate] kategori: dilewati (' + e.message + ')'); }

    if (newIsEmpty) {
      // Instansi (dari pengirim/tujuan surat lama)
      try {
        const pm = old.prepare('SELECT DISTINCT pengirim FROM surat_masuk WHERE pengirim IS NOT NULL AND pengirim != ""').all()
          .concat(old.prepare('SELECT DISTINCT tujuan AS pengirim FROM surat_keluar WHERE tujuan IS NOT NULL AND tujuan != ""').all())
          .concat(old.prepare('SELECT DISTINCT instansi AS pengirim FROM arsip_dokumen WHERE instansi IS NOT NULL AND instansi != ""').all())
          .filter((r) => r.pengirim);
        const seen = new Set();
        const ins = db.prepare('INSERT OR IGNORE INTO instansi (nama_instansi, jenis) VALUES (?,\'pengirim\')');
        for (const r of pm) { const n = r.pengirim.trim(); if (!seen.has(n)) { seen.add(n); ins.run(n); } }
        console.log(`[migrate] ${seen.size} instansi disalin.`);
      } catch (e) { console.log('[migrate] instansi: dilewati (' + e.message + ')'); }

      const insArsip = db.prepare(`INSERT INTO arsip
        (nomor_arsip, kategori_id, jenis, judul, perihal, tanggal, tahun_arsip, instansi_id, lokasi_id, status, keterangan, file_name, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const kategoriDefault = db.prepare('SELECT id FROM kategori LIMIT 1').get();

      // Surat masuk
      try {
        const rows = old.prepare('SELECT * FROM surat_masuk').all();
        for (const s of rows) {
          const inst = db.prepare('SELECT id FROM instansi WHERE nama_instansi=?').get(s.pengirim);
          insArsip.run(
            s.nomor_surat || `SM-${s.id}`, katMap[s.kategori_id] || kategoriDefault.id, 'surat-masuk',
            `${s.perihal || 'Surat Masuk'}`, s.perihal || '', s.tanggal_surat || s.tanggal_diterima || '',
            (s.tanggal_surat || '').slice(0, 4), inst ? inst.id : null, null,
            'arsip', s.keterangan || '', s.file_surat || '', s.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), s.updated_at || '');
        }
        console.log(`[migrate] ${rows.length} surat masuk disalin.`);
      } catch (e) { console.log('[migrate] surat_masuk: dilewati (' + e.message + ')'); }

      // Surat keluar
      try {
        const rows = old.prepare('SELECT * FROM surat_keluar').all();
        for (const s of rows) {
          const inst = db.prepare('SELECT id FROM instansi WHERE nama_instansi=?').get(s.tujuan);
          insArsip.run(
            s.nomor_surat || `SK-${s.id}`, katMap[s.kategori_id] || kategoriDefault.id, 'surat-keluar',
            `${s.perihal || 'Surat Keluar'}`, s.perihal || '', s.tanggal_surat || '',
            (s.tanggal_surat || '').slice(0, 4), inst ? inst.id : null, null,
            'arsip', s.keterangan || '', s.file_surat || '', s.created_at || '', s.updated_at || '');
        }
        console.log(`[migrate] ${rows.length} surat keluar disalin.`);
      } catch (e) { console.log('[migrate] surat_keluar: dilewati (' + e.message + ')'); }

      // Arsip dokumen apa adanya
      try {
        const rows = old.prepare('SELECT * FROM arsip_dokumen').all();
        for (const s of rows) {
          insArsip.run(
            s.kode_arsip || `ARS-${s.id}`, kategoriDefault.id, 'lainnya',
            s.judul || 'Dokumen', s.deskripsi || '', s.tanggal || s.tahun || '',
            String(s.tahun || (s.tanggal || '').slice(0, 4) || ''), null, null,
            s.status === 'Dipinjam' ? 'dipinjam' : 'arsip',
            s.deskripsi || '', s.file_surat || s.file_dokumen || '', s.created_at || '', s.updated_at || '');
        }
        console.log(`[migrate] ${rows.length} arsip dokumen disalin.`);
      } catch (e) { console.log('[migrate] arsip_dokumen: dilewati (' + e.message + ')'); }
    } else {
      console.log('[migrate] Database baru sudah berisi arsip, lewati penyalinan arsip.');
    }

    console.log('[migrate] Selesai. Database lama TIDAK dihapus otomatis - silakan cek lalu hapus manual jika perlu.');
  } finally {
    try { old.close(); } catch (e) { /* ignore */ }
  }
}

if (require.main === module) migrate();
module.exports = { migrate };