const bcrypt = require('bcryptjs');
const { DB_PATH, getDb } = require('./db');

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nama_lengkap TEXT NOT NULL,
      nip TEXT,
      jabatan TEXT DEFAULT 'Staff',
      role TEXT DEFAULT 'user' CHECK(role IN ('admin','kepala','user')),
      email TEXT,
      telepon TEXT,
      foto TEXT,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kategori_surat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kategori TEXT NOT NULL,
      keterangan TEXT,
      tipe TEXT CHECK(tipe IN ('masuk','keluar','semua')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS surat_masuk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_surat TEXT NOT NULL,
      tanggal_surat DATE NOT NULL,
      tanggal_diterima DATE NOT NULL,
      pengirim TEXT NOT NULL,
      perihal TEXT NOT NULL,
      kategori_id INTEGER,
      keterangan TEXT,
      lampiran TEXT,
      file_surat TEXT,
      status TEXT DEFAULT 'Baru' CHECK(status IN ('Baru','Diproses','Selesai','Diteruskan')),
      disposisi TEXT,
      diterima_oleh TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kategori_id) REFERENCES kategori_surat(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS surat_keluar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_surat TEXT NOT NULL,
      tanggal_surat DATE NOT NULL,
      tujuan TEXT NOT NULL,
      perihal TEXT NOT NULL,
      kategori_id INTEGER,
      keterangan TEXT,
      lampiran TEXT,
      file_surat TEXT,
      status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft','Disetujui','Dikirim','Selesai')),
      pengirim TEXT,
      diterima_oleh TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kategori_id) REFERENCES kategori_surat(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS arsip_dokumen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_arsip TEXT UNIQUE NOT NULL,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      kategori TEXT NOT NULL,
      sub_kategori TEXT,
      lokasi_rak TEXT,
      lokasi_box TEXT,
      tahun INTEGER,
      file_dokumen TEXT,
      status TEXT DEFAULT 'Aktif' CHECK(status IN ('Aktif','Arsip','Rusak','Hilang')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sertifikat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_sertifikat TEXT UNIQUE NOT NULL,
      jenis_sertifikat TEXT NOT NULL,
      nama_pemilik TEXT NOT NULL,
      nik_pemilik TEXT,
      alamat_pemilik TEXT,
      luas_tanah REAL,
      satuan_luas TEXT DEFAULT 'm2',
      letak_tanah TEXT NOT NULL,
      kelurahan TEXT,
      kecamatan TEXT,
      kabupaten TEXT,
      provinsi TEXT,
      nomor_petak TEXT,
      letter_c TEXT,
      tanggal_terbit DATE,
      status_sertifikat TEXT DEFAULT 'Aktif',
      keterangan TEXT,
      file_sertifikat TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS disposisi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surat_id INTEGER NOT NULL,
      tipe_surat TEXT NOT NULL CHECK(tipe_surat IN ('masuk','keluar')),
      diteruskan_ke TEXT NOT NULL,
      catatan TEXT,
      prioritas TEXT DEFAULT 'Biasa' CHECK(prioritas IN ('Segera','Penting','Biasa')),
      status TEXT DEFAULT 'Menunggu' CHECK(status IN ('Menunggu','Diproses','Selesai')),
      diteruskan_oleh INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (surat_id) REFERENCES surat_masuk(id) ON DELETE CASCADE,
      FOREIGN KEY (diteruskan_oleh) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS log_aktivitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      aktivitas TEXT NOT NULL,
      modul TEXT,
      detail TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pengaturan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kantor TEXT DEFAULT 'Kantor Pertanahan Kabupaten',
      alamat_kantor TEXT,
      telepon_kantor TEXT,
      email_kantor TEXT,
      website TEXT,
      logo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_surat_masuk_nomor ON surat_masuk(nomor_surat);
    CREATE INDEX IF NOT EXISTS idx_surat_masuk_tanggal ON surat_masuk(tanggal_surat);
    CREATE INDEX IF NOT EXISTS idx_surat_keluar_nomor ON surat_keluar(nomor_surat);
    CREATE INDEX IF NOT EXISTS idx_sertifikat_nomor ON sertifikat(nomor_sertifikat);
    CREATE INDEX IF NOT EXISTS idx_sertifikat_pemilik ON sertifikat(nama_pemilik);
    CREATE INDEX IF NOT EXISTS idx_arsip_kode ON arsip_dokumen(kode_arsip);
  `);

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password, nama_lengkap, nip, jabatan, role, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin', hash, 'Administrator', '198001012005011001', 'Admin Sistem', 'admin', 'admin@bpn.go.id');

    const hash2 = bcrypt.hashSync('kepala123', 10);
    db.prepare(`
      INSERT INTO users (username, password, nama_lengkap, nip, jabatan, role, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('kepala', hash2, 'Kepala Kantor', '197501012000031002', 'Kepala Kantor', 'kepala', 'kepala@bpn.go.id');
  }

  const kategoriExists = db.prepare('SELECT COUNT(*) as count FROM kategori_surat').get();
  if (kategoriExists.count === 0) {
    const insertKategori = db.prepare('INSERT INTO kategori_surat (nama_kategori, keterangan, tipe) VALUES (?, ?, ?)');
    const kategori = [
      ['Umum', 'Surat pengumuman dan pemberitahuan umum', 'semua'],
      ['Kepegawaian', 'Surat terkait kepegawaian dan SDM', 'semua'],
      ['Keuangan', 'Surat terkait keuangan dan anggaran', 'semua'],
      ['Pertanahan', 'Surat terkait urusan pertanahan', 'semua'],
      ['Teknis', 'Surat teknis dan pelaksanaan', 'semua'],
      ['Hukum', 'Surat hukum dan peraturan', 'semua'],
      ['Koordinasi', 'Surat koordinasi antar instansi', 'semua'],
      ['Pimpinan', 'Surat dari/ke pimpinan', 'semua'],
    ];
    for (const k of kategori) {
      insertKategori.run(...k);
    }
  }

  const pengaturanExists = db.prepare('SELECT id FROM pengaturan LIMIT 1').get();
  if (!pengaturanExists) {
    db.prepare(`
      INSERT INTO pengaturan (nama_kantor, alamat_kantor, telepon_kantor, email_kantor)
      VALUES (?, ?, ?, ?)
    `).run(
      'Kantor Pertanahan Kabupaten',
      'Jl. Pertanahan No. 1, Kabupaten',
      '(021) 1234-5678',
      'info@bpn-kab.go.id'
    );
  }

  db.close();

  console.log('Database berhasil diinisialisasi!');
  console.log('Akun default:');
  console.log('  Admin  -> username: admin  | password: admin123');
  console.log('  Kepala -> username: kepala | password: kepala123');
}

if (require.main === module) {
  initDatabase();
}

module.exports = { DB_PATH, initDatabase };