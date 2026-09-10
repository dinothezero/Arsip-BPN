'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('./db');

function createTables() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS pengaturan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nama_kantor TEXT NOT NULL DEFAULT 'KANTOR PERTANAHAN',
    singkatan TEXT NOT NULL DEFAULT 'KANWIL BPN',
    alamat TEXT DEFAULT '',
    telepon TEXT DEFAULT '',
    email TEXT DEFAULT '',
    website TEXT DEFAULT '',
    kode_kantor TEXT DEFAULT '',
    kota TEXT DEFAULT '',
    nama_kepala TEXT DEFAULT '',
    nip_kepala TEXT DEFAULT '',
    jabatan_kepala TEXT NOT NULL DEFAULT 'KEPALA KANTOR PERTANAHAN',
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nama_lengkap TEXT NOT NULL,
    nip TEXT DEFAULT '',
    jabatan TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'staf' CHECK (role IN ('admin','staf','kepala')),
    status INTEGER NOT NULL DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS kategori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL UNIQUE,
    nama_kategori TEXT NOT NULL,
    keterangan TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS lokasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_lokasi TEXT NOT NULL,
    keterangan TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS unit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_unit TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS instansi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_instansi TEXT NOT NULL,
    jenis TEXT NOT NULL DEFAULT 'pengirim' CHECK (jenis IN ('pengirim','penerima','keduanya')),
    alamat TEXT DEFAULT '',
    keterangan TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS arsip (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomor_arsip TEXT NOT NULL,
    kategori_id INTEGER,
    jenis TEXT NOT NULL DEFAULT 'surat-masuk'
      CHECK (jenis IN ('surat-masuk','surat-keluar','sertifikat','sk','laporan','lainnya')),
    judul TEXT NOT NULL,
    perihal TEXT DEFAULT '',
    tanggal TEXT DEFAULT '',
    tahun_arsip INTEGER,
    instansi_id INTEGER,
    unit_id INTEGER,
    lokasi_id INTEGER,
    status TEXT NOT NULL DEFAULT 'aktif'
      CHECK (status IN ('aktif','arsip','dipinjam','hilang','rusak')),
    file_name TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    keterangan TEXT DEFAULT '',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE SET NULL,
    FOREIGN KEY (instansi_id) REFERENCES instansi(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_id) REFERENCES unit(id) ON DELETE SET NULL,
    FOREIGN KEY (lokasi_id) REFERENCES lokasi(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS arsip_counter (
    tahun INTEGER NOT NULL,
    kategori_id INTEGER NOT NULL,
    urut INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tahun, kategori_id)
  );

  CREATE TABLE IF NOT EXISTS disposisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arsip_id INTEGER NOT NULL,
    dari_user_id INTEGER NOT NULL,
    ke_user_id INTEGER NOT NULL,
    instruksi TEXT DEFAULT '',
    catatan TEXT DEFAULT '',
    tanggal TEXT DEFAULT (date('now','localtime')),
    status TEXT NOT NULL DEFAULT 'proses' CHECK (status IN ('proses','selesai','ditolak')),
    dibaca INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (arsip_id) REFERENCES arsip(id) ON DELETE CASCADE,
    FOREIGN KEY (dari_user_id) REFERENCES users(id),
    FOREIGN KEY (ke_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS peminjaman (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arsip_id INTEGER NOT NULL,
    peminjam TEXT NOT NULL,
    unit_peminjam TEXT DEFAULT '',
    tanggal_pinjam TEXT DEFAULT (date('now','localtime')),
    jatuh_tempo TEXT NOT NULL,
    tanggal_kembali TEXT,
    status TEXT NOT NULL DEFAULT 'dipinjam' CHECK (status IN ('dipinjam','dikembalikan','terlambat')),
    keterangan TEXT DEFAULT '',
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (arsip_id) REFERENCES arsip(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tahun INTEGER NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('masuk','keluar')),
    nomor_urut INTEGER NOT NULL,
    arsip_id INTEGER,
    tanggal TEXT DEFAULT (date('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE (tahun, jenis, nomor_urut)
  );

  CREATE TABLE IF NOT EXISTS kegiatan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,
    jam_mulai TEXT DEFAULT '',
    jam_selesai TEXT DEFAULT '',
    judul TEXT NOT NULL,
    jenis TEXT NOT NULL DEFAULT 'rapat'
      CHECK (jenis IN ('rapat','verifikasi','pelayanan','sosialisasi','lainnya')),
    lokasi TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    selesai INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS notifikasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    jenis TEXT NOT NULL DEFAULT 'sistem',
    pesan TEXT NOT NULL,
    link TEXT DEFAULT '#',
    dibaca INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT DEFAULT '',
    aksi TEXT NOT NULL,
    modul TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    ip TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_arsip_jenis ON arsip(jenis);
  CREATE INDEX IF NOT EXISTS idx_arsip_status ON arsip(status);
  CREATE INDEX IF NOT EXISTS idx_arsip_tanggal ON arsip(tanggal);
  CREATE INDEX IF NOT EXISTS idx_arsip_kategori ON arsip(kategori_id);
  CREATE INDEX IF NOT EXISTS idx_arsip_nomor ON arsip(nomor_arsip);
  CREATE INDEX IF NOT EXISTS idx_disposisi_arsip ON disposisi(arsip_id);
  CREATE INDEX IF NOT EXISTS idx_peminjaman_arsip ON peminjaman(arsip_id);
  CREATE INDEX IF NOT EXISTS idx_kegiatan_tanggal ON kegiatan(tanggal);
  `);
}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    const ins = db.prepare(`INSERT INTO users (username, password_hash, nama_lengkap, nip, jabatan, role) VALUES (?,?,?,?,?,?)`);
    ins.run('admin', bcrypt.hashSync('admin123', 10), 'Administrator Sistem', '00000000', 'Pengelola Arsip', 'admin');
    ins.run('staff1', bcrypt.hashSync('password123', 10), 'Staf Arsiparis', '10000001', 'Arsiparis', 'staf');
    ins.run('kepala1', bcrypt.hashSync('password123', 10), 'Kepala Kantor', '20000001', 'Kepala Kantor', 'kepala');
    console.log('[init] Pengguna bawaan dibuat: admin/admin123, staff1 & kepala1 / password123');
  }

  const k = db.prepare('SELECT COUNT(*) AS n FROM kategori').get().n;
  if (k === 0) {
    const kats = [
      ['SKM', 'Surat Keputusan Mutasi', 'Keputusan mutasi pegawai'],
      ['SKG', 'Surat Keputusan Gaji', 'Keputusan penggajian'],
      ['SKB', 'Surat Keputusan Bersama', 'Keputusan bersama lintas instansi'],
      ['SM', 'Surat Masuk', 'Surat dari instansi lain'],
      ['SKL', 'Surat Keterangan Lunas', 'Keterangan pelunasan'],
      ['SHM', 'Sertifikat Hak Milik', ''],
      ['HGB', 'Hak Guna Bangunan', ''],
      ['HGU', 'Hak Guna Usaha', ''],
      ['LPJ', 'Laporan Pertanggungjawaban', ''],
      ['WA', 'Warkah', 'Dokumen legalitas pertanahan'],
      ['SO', 'Surat Masuk Umum', ''],
      ['SP', 'Surat Perintah', ''],
      ['SK', 'Surat Keputusan', ''],
    ];
    const ins = db.prepare('INSERT INTO kategori (kode, nama_kategori, keterangan) VALUES (?,?,?)');
    for (const x of kats) ins.run(...x);
    console.log('[init] Kategori bawaan dibuat');
  }

  const p = db.prepare('SELECT COUNT(*) AS n FROM pengaturan').get().n;
  if (p === 0) {
    db.prepare(`INSERT INTO pengaturan (id, nama_kantor, singkatan) VALUES (1,'KANTOR PERTANAHAN','KANTOR PERTANAHAN')`).run();
    console.log('[init] Profil kantor dibuat');
  }
}

if (require.main === module) {
  createTables();
  seedDefaults();
  const t = db.prepare('SELECT COUNT(*) AS n FROM arsip').get().n;
  console.log(`[init] Database siap. ${db.prepare('SELECT COUNT(*) AS n FROM users').get().n} pengguna, ${t} arsip.`);
}

module.exports = { createTables, seedDefaults };