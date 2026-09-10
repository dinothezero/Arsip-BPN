'use strict';

const { db } = require('./db');

// ---------- Auth / users ----------
const qUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qListUsers = db.prepare('SELECT id, username, nama_lengkap, nip, jabatan, role, status, last_login, created_at FROM users ORDER BY role, username');
const qInsertUser = db.prepare('INSERT INTO users (username, password_hash, nama_lengkap, nip, jabatan, role, status) VALUES (?,?,?,?,?,?,?)');
const qUpdateUser = db.prepare('UPDATE users SET nama_lengkap=?, nip=?, jabatan=?, role=?, status=? WHERE id=?');
const qUpdatePassword = db.prepare('UPDATE users SET password_hash=? WHERE id=?');
const qSetLastLogin = db.prepare('UPDATE users SET last_login = datetime(\'now\',\'localtime\') WHERE id=?');
const qDeleteUser = db.prepare('DELETE FROM users WHERE id=?');

function findUserByUsername(u) { return qUserByUsername.get(u); }
function findUserById(id) { return qUserById.get(id); }
function listUsers() { return qListUsers.all(); }
function createUser(u) {
  qInsertUser.run(u.username, u.hash, u.nama_lengkap, u.nip || '', u.jabatan || '', u.role, u.status === undefined ? 1 : u.status);
  return db.prepare('SELECT * FROM users WHERE username=?').get(u.username);
}
function updateUser(id, u) { qUpdateUser.run(u.nama_lengkap, u.nip || '', u.jabatan || '', u.role, u.status, id); }
function setPassword(id, hash) { qUpdatePassword.run(hash, id); }
function setLastLogin(id) { qSetLastLogin.run(id); }
function deleteUser(id) { qDeleteUser.run(id); }

// delete user's references cleanup
function removeUserDisposisiKe(id) { db.prepare('UPDATE disposisi SET ke_user_id = (SELECT id FROM users WHERE role=? LIMIT 1) WHERE ke_user_id=?').run('admin', id); }

// ---------- Pengaturan ----------
const qGetPengaturan = db.prepare('SELECT * FROM pengaturan WHERE id=1');
const qUpdatePengaturan = db.prepare(`UPDATE pengaturan SET
  nama_kantor=?, singkatan=?, alamat=?, telepon=?, email=?, website=?, kode_kantor=?, kota=?,
  nama_kepala=?, nip_kepala=?, jabatan_kepala=?, updated_at=datetime('now','localtime') WHERE id=1`);

function getPengaturan() { return qGetPengaturan.get(); }
function updatePengaturan(p) {
  qUpdatePengaturan.run(p.nama_kantor, p.singkatan, p.alamat, p.telepon, p.email, p.website, p.kode_kantor, p.kota, p.nama_kepala, p.nip_kepala, p.jabatan_kepala);
}

// ---------- Kategori ----------
const qListKategori = db.prepare('SELECT k.*, (SELECT COUNT(*) FROM arsip a WHERE a.kategori_id=k.id AND a.is_deleted=0) AS jumlah FROM kategori k ORDER BY k.kode');
const qGetKategori = db.prepare('SELECT * FROM kategori WHERE id=?');
const qInsertKategori = db.prepare('INSERT INTO kategori (kode, nama_kategori, keterangan) VALUES (?,?,?)');
const qUpdateKategori = db.prepare('UPDATE kategori SET kode=?, nama_kategori=?, keterangan=? WHERE id=?');
const qDeleteKategori = db.prepare('DELETE FROM kategori WHERE id=?');

function listKategori() { return qListKategori.all(); }
function getKategori(id) { return qGetKategori.get(id); }
function createKategori(x) { qInsertKategori.run(x.kode, x.nama_kategori, x.keterangan || ''); return qGetKategori.get(db.prepare('SELECT last_insert_rowid() AS id').get().id); }
function updateKategori(id, x) { qUpdateKategori.run(x.kode, x.nama_kategori, x.keterangan || '', id); }
function deleteKategori(id) { qDeleteKategori.run(id); }

// ---------- Lokasi ----------
const qListLokasi = db.prepare('SELECT l.*, (SELECT COUNT(*) FROM arsip a WHERE a.lokasi_id=l.id AND a.is_deleted=0) AS jumlah FROM lokasi l ORDER BY l.nama_lokasi');
const qInsertLokasi = db.prepare('INSERT INTO lokasi (nama_lokasi, keterangan) VALUES (?,?)');
const qUpdateLokasi = db.prepare('UPDATE lokasi SET nama_lokasi=?, keterangan=? WHERE id=?');
const qDeleteLokasi = db.prepare('DELETE FROM lokasi WHERE id=?');

function listLokasi() { return qListLokasi.all(); }
function createLokasi(x) { qInsertLokasi.run(x.nama_lokasi, x.keterangan || ''); }
function updateLokasi(id, x) { qUpdateLokasi.run(x.nama_lokasi, x.keterangan || '', id); }
function deleteLokasi(id) { qDeleteLokasi.run(id); }

// ---------- Unit ----------
const qListUnit = db.prepare('SELECT u.*, (SELECT COUNT(*) FROM arsip a WHERE a.unit_id=u.id AND a.is_deleted=0) AS jumlah FROM unit u ORDER BY u.nama_unit');
const qInsertUnit = db.prepare('INSERT INTO unit (nama_unit) VALUES (?)');
const qUpdateUnit = db.prepare('UPDATE unit SET nama_unit=? WHERE id=?');
const qDeleteUnit = db.prepare('DELETE FROM unit WHERE id=?');

function listUnit() { return qListUnit.all(); }
function createUnit(x) { qInsertUnit.run(x.nama_unit); }
function updateUnit(id, x) { qUpdateUnit.run(x.nama_unit, id); }
function deleteUnit(id) { qDeleteUnit.run(id); }

// ---------- Instansi ----------
const qListInstansi = db.prepare('SELECT i.*, (SELECT COUNT(*) FROM arsip a WHERE a.instansi_id=i.id AND a.is_deleted=0) AS jumlah FROM instansi i ORDER BY i.nama_instansi');
const qInsertInstansi = db.prepare('INSERT INTO instansi (nama_instansi, jenis, alamat, keterangan) VALUES (?,?,?,?)');
const qUpdateInstansi = db.prepare('UPDATE instansi SET nama_instansi=?, jenis=?, alamat=?, keterangan=? WHERE id=?');
const qDeleteInstansi = db.prepare('DELETE FROM instansi WHERE id=?');

function listInstansi() { return qListInstansi.all(); }
function createInstansi(x) { qInsertInstansi.run(x.nama_instansi, x.jenis || 'pengirim', x.alamat || '', x.keterangan || ''); }
function updateInstansi(id, x) { qUpdateInstansi.run(x.nama_instansi, x.jenis, x.alamat || '', x.keterangan || '', id); }
function deleteInstansi(id) { qDeleteInstansi.run(id); }

// ---------- Arsip ----------
function listArsip({ q, kategori_id, jenis, status, instansi_id, lokasi_id, unit_id, dari, sampai, tahun, sort, order, limit, offset }) {
  const w = ['a.is_deleted = 0'];
  const p = [];
  if (q) {
    w.push('(a.nomor_arsip LIKE ? OR a.judul LIKE ? OR a.perihal LIKE ? OR a.keterangan LIKE ?)');
    const like = `%${q}%`;
    p.push(like, like, like, like);
  }
  if (kategori_id) { w.push('a.kategori_id = ?'); p.push(kategori_id); }
  if (jenis) { w.push('a.jenis = ?'); p.push(jenis); }
  if (status) { w.push('a.status = ?'); p.push(status); }
  if (instansi_id) { w.push('a.instansi_id = ?'); p.push(instansi_id); }
  if (lokasi_id) { w.push('a.lokasi_id = ?'); p.push(lokasi_id); }
  if (unit_id) { w.push('a.unit_id = ?'); p.push(unit_id); }
  if (dari && sampai) { w.push('a.tanggal BETWEEN ? AND ?'); p.push(dari, sampai); }
  if (tahun) { w.push('a.tahun_arsip = ?'); p.push(tahun); }

  const orderBy = (sort || 'created_at') + ' ' + (order === 'asc' ? 'ASC' : 'DESC');
  const lim = limit ? parseInt(limit, 10) : 50;
  const off = offset ? parseInt(offset, 10) : 0;

  const where = w.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM arsip a WHERE ${where}`).get(...p).n;
  const rows = db.prepare(`
    SELECT a.*, k.kode AS kode_kategori, k.nama_kategori,
           l.nama_lokasi, u.nama_unit, i.nama_instansi, cr.nama_lengkap AS creator
    FROM arsip a
    LEFT JOIN kategori k ON k.id = a.kategori_id
    LEFT JOIN lokasi l ON l.id = a.lokasi_id
    LEFT JOIN unit u ON u.id = a.unit_id
    LEFT JOIN instansi i ON i.id = a.instansi_id
    LEFT JOIN users cr ON cr.id = a.created_by
    WHERE ${where}
    ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...p, lim, off);
  return { total, rows };
}

const qGetArsip = db.prepare(`
  SELECT a.*, k.kode AS kode_kategori, k.nama_kategori,
         l.nama_lokasi, u.nama_unit, i.nama_instansi, i.jenis AS instansi_jenis,
         cr.nama_lengkap AS creator
  FROM arsip a
  LEFT JOIN kategori k ON k.id = a.kategori_id
  LEFT JOIN lokasi l ON l.id = a.lokasi_id
  LEFT JOIN unit u ON u.id = a.unit_id
  LEFT JOIN instansi i ON i.id = a.instansi_id
  LEFT JOIN users cr ON cr.id = a.created_by
  WHERE a.id = ?`);
const qInsertArsip = db.prepare(`
  INSERT INTO arsip (nomor_arsip, kategori_id, jenis, judul, perihal, tanggal, tahun_arsip,
    instansi_id, unit_id, lokasi_id, status, file_name, file_path, file_size, keterangan, created_by)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const qUpdateArsip = db.prepare(`
  UPDATE arsip SET kategori_id=?, jenis=?, judul=?, perihal=?, tanggal=?, tahun_arsip=?,
    instansi_id=?, unit_id=?, lokasi_id=?, status=?, file_name=?, file_path=?, file_size=?,
    keterangan=?, updated_at=datetime('now','localtime') WHERE id=?`);
const qSoftDelete = db.prepare('UPDATE arsip SET is_deleted=1, deleted_at=datetime(\'now\',\'localtime\') WHERE id=?');
const qRestore = db.prepare('UPDATE arsip SET is_deleted=0, deleted_at=NULL WHERE id=?');
const qHardDelete = db.prepare('DELETE FROM arsip WHERE id=?');
const qListTrash = db.prepare(`
  SELECT a.*, k.kode AS kode_kategori, k.nama_kategori,
         l.nama_lokasi, u.nama_unit, i.nama_instansi
  FROM arsip a
  LEFT JOIN kategori k ON k.id = a.kategori_id
  LEFT JOIN lokasi l ON l.id = a.lokasi_id
  LEFT JOIN unit u ON u.id = a.unit_id
  LEFT JOIN instansi i ON i.id = a.instansi_id
  WHERE a.is_deleted=1 ORDER BY a.deleted_at DESC`);
const qSetStatus = db.prepare('UPDATE arsip SET status=? WHERE id=?');
const qCountArsip = db.prepare('SELECT COUNT(*) AS n FROM arsip WHERE is_deleted=0');
const qSetArsipStatusDipinjam = db.prepare("UPDATE arsip SET status='dipinjam' WHERE id=?");

function getArsip(id) { return qGetArsip.get(id); }
function createArsip(a) {
  qInsertArsip.run(a.nomor_arsip, a.kategori_id, a.jenis, a.judul, a.perihal || '', a.tanggal || '', a.tahun_arsip,
    a.instansi_id || null, a.unit_id || null, a.lokasi_id || null, a.status || 'aktif',
    a.file_name || '', a.file_path || '', a.file_size || 0, a.keterangan || '', a.created_by);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}
function updateArsip(id, a) {
  qUpdateArsip.run(a.kategori_id, a.jenis, a.judul, a.perihal || '', a.tanggal || '', a.tahun_arsip,
    a.instansi_id || null, a.unit_id || null, a.lokasi_id || null, a.status || 'aktif',
    a.file_name || '', a.file_path || '', a.file_size || 0, a.keterangan || '', id);
}
function softDeleteArsip(id) { qSoftDelete.run(id); }
function restoreArsip(id) { qRestore.run(id); }
function hardDeleteArsip(id) { qHardDelete.run(id); }
function listTrash() { return qListTrash.all(); }
function setArsipStatus(id, s) { qSetStatus.run(s, id); }
function countArsip() { return qCountArsip.get().n; }

// nomor arsip otomatis KODE/TAHUN/0001
function nextNomorArsip(kategoriId, tahun) {
  const kid = kategoriId ? kategoriId : 0;
  const kode = kid !== 0 ? (getKategori(kid) ? getKategori(kid).kode : 'ARS') : 'ARS';
  const upd = db.prepare(`INSERT INTO arsip_counter (tahun, kategori_id, urut) VALUES (?,?,1)
    ON CONFLICT(tahun, kategori_id) DO UPDATE SET urut = urut + 1`);
  upd.run(tahun, kid);
  const cur = db.prepare('SELECT urut FROM arsip_counter WHERE tahun=? AND kategori_id=?').get(tahun, kid).urut;
  return `${kode}/${tahun}/${String(cur).padStart(4, '0')}`;
}

// ---------- Disposisi ----------
const qInsertDisposisi = db.prepare('INSERT INTO disposisi (arsip_id, dari_user_id, ke_user_id, instruksi, catatan, tanggal) VALUES (?,?,?,?,?,?)');
const qListDisposisi = db.prepare(`
  SELECT d.*, a.nomor_arsip, a.judul AS judul_arsip, a.jenis AS jenis_arsip,
         u_d.nama_lengkap AS dari_nama, u_k.nama_lengkap AS ke_nama
  FROM disposisi d
  LEFT JOIN arsip a ON a.id = d.arsip_id
  LEFT JOIN users u_d ON u_d.id = d.dari_user_id
  LEFT JOIN users u_k ON u_k.id = d.ke_user_id
  ORDER BY d.created_at DESC LIMIT 200`);
const qGetDisposisi = db.prepare('SELECT * FROM disposisi WHERE id=?');
const qSetDisposisiStatus = db.prepare('UPDATE disposisi SET status=? WHERE id=?');
const qMarkDisposisiBaca = db.prepare("UPDATE disposisi SET dibaca=1 WHERE id=? AND ke_user_id=?");
const qCountDisposisiBelumBaca = db.prepare('SELECT COUNT(*) AS n FROM disposisi WHERE ke_user_id=? AND dibaca=0');

function createDisposisi(x) { qInsertDisposisi.run(x.arsip_id, x.dari_user_id, x.ke_user_id, x.instruksi || '', x.catatan || '', x.tanggal || new Date().toISOString().slice(0, 10)); }
function listDisposisi() { return qListDisposisi.all(); }
function getDisposisi(id) { return qGetDisposisi.get(id); }
function setDisposisiStatus(id, s) { qSetDisposisiStatus.run(s, id); }
function markDisposisiBaca(id, uid) { qMarkDisposisiBaca.run(id, uid); }
function countDisposisiBelumBaca(uid) { return qCountDisposisiBelumBaca.get(uid).n; }

// ---------- Peminjaman ----------
const qInsertPeminjaman = db.prepare(`
  INSERT INTO peminjaman (arsip_id, peminjam, unit_peminjam, tanggal_pinjam, jatuh_tempo, keterangan, created_by)
  VALUES (?,?,?,?,?,?,?)`);
const qListPeminjaman = db.prepare(`
  SELECT p.*, a.nomor_arsip, a.judul AS judul_arsip, a.jenis AS jenis_arsip,
         CASE WHEN p.status='dipinjam' AND date(p.jatuh_tempo) < date('now','localtime') THEN 'terlambat' ELSE p.status END AS status_efektif
  FROM peminjaman p
  LEFT JOIN arsip a ON a.id = p.arsip_id
  ORDER BY p.created_at DESC LIMIT 200`);
const qKembalikan = db.prepare("UPDATE peminjaman SET status='dikembalikan', tanggal_kembali=date('now','localtime') WHERE id=?");
const qGetPeminjaman = db.prepare('SELECT * FROM peminjaman WHERE id=?');
const qDeletePeminjaman = db.prepare('DELETE FROM peminjaman WHERE id=?');
const qUpdateOverdue = db.prepare(`
  UPDATE peminjaman SET status='terlambat'
  WHERE status='dipinjam' AND date(jatuh_tempo) < date('now','localtime')`);
const qListAktifPeminjaman = db.prepare(`
  SELECT p.*, a.nomor_arsip, a.judul AS judul_arsip, a.jenis AS jenis_arsip,
         CASE WHEN date(p.jatuh_tempo) < date('now','localtime') THEN 'terlambat' ELSE 'dipinjam' END AS status_efektif
  FROM peminjaman p LEFT JOIN arsip a ON a.id = p.arsip_id
  WHERE p.status='dipinjam' ORDER BY p.jatuh_tempo ASC`);
const qCountPeminjamanAktif = db.prepare("SELECT COUNT(*) AS n FROM peminjaman WHERE status='dipinjam'");
const qCountPeminjamanTerlambat = db.prepare("SELECT COUNT(*) AS n FROM peminjaman WHERE status='dipinjam' AND date(jatuh_tempo) < date('now','localtime')");

function createPeminjaman(x) { qInsertPeminjaman.run(x.arsip_id, x.peminjam, x.unit_peminjam || '', x.tanggal_pinjam, x.jatuh_tempo, x.keterangan || '', x.created_by); return db.prepare('SELECT last_insert_rowid() AS id').get().id; }
function listPeminjaman() { return qListPeminjaman.all(); }
function getPeminjaman(id) { return qGetPeminjaman.get(id); }
function kembalikanPeminjaman(id) { qKembalikan.run(id); }
function deletePeminjaman(id) { qDeletePeminjaman.run(id); }
function updateOverdue() { return qUpdateOverdue.run().changes; }
function listPeminjamanAktif() { return qListAktifPeminjaman.all(); }
function countPeminjamanAktif() { return qCountPeminjamanAktif.get().n; }
function countPeminjamanTerlambat() { return qCountPeminjamanTerlambat.get().n; }

// ---------- Agenda ----------
const qNextAgenda = db.prepare('SELECT COALESCE(MAX(nomor_urut),0)+1 AS next FROM agenda WHERE tahun=? AND jenis=?');
const qInsertAgenda = db.prepare('INSERT INTO agenda (tahun, jenis, nomor_urut, arsip_id, tanggal) VALUES (?,?,?,?,?)');
const qListAgenda = db.prepare(`
  SELECT ag.*, a.nomor_arsip, a.judul, a.perihal, a.tanggal AS tanggal_arsip, k.kode AS kode_kategori
  FROM agenda ag
  LEFT JOIN arsip a ON a.id = ag.arsip_id
  LEFT JOIN kategori k ON k.id = a.kategori_id
  ORDER BY ag.jenis, ag.nomor_urut`);

function nextAgendaNomor(tahun, jenis) { return qNextAgenda.get(tahun, jenis).next; }
function createAgenda(x) { qInsertAgenda.run(x.tahun, x.jenis, x.nomor_urut, x.arsip_id, x.tanggal); }
function listAgenda() { return qListAgenda.all(); }

// ---------- Kegiatan ----------
const qInsertKegiatan = db.prepare('INSERT INTO kegiatan (tanggal, jam_mulai, jam_selesai, judul, jenis, lokasi, keterangan, created_by) VALUES (?,?,?,?,?,?,?,?)');
const qListKegiatan = db.prepare('SELECT * FROM kegiatan ORDER BY tanggal DESC, jam_mulai ASC');
const qListKegiatanBulan = db.prepare("SELECT * FROM kegiatan WHERE substr(tanggal,1,7)=? ORDER BY tanggal ASC, jam_mulai ASC");
const qGetKegiatan = db.prepare('SELECT * FROM kegiatan WHERE id=?');
const qUpdateKegiatan = db.prepare('UPDATE kegiatan SET tanggal=?, jam_mulai=?, jam_selesai=?, judul=?, jenis=?, lokasi=?, keterangan=? WHERE id=?');
const qDeleteKegiatan = db.prepare('DELETE FROM kegiatan WHERE id=?');
const qSetKegiatanSelesai = db.prepare('UPDATE kegiatan SET selesai=? WHERE id=?');
const qKegiatanHariIni = db.prepare("SELECT * FROM kegiatan WHERE tanggal = date('now','localtime') ORDER BY jam_mulai ASC");

function createKegiatan(x) { qInsertKegiatan.run(x.tanggal, x.jam_mulai || '', x.jam_selesai || '', x.judul, x.jenis, x.lokasi || '', x.keterangan || '', x.created_by); }
function listKegiatan() { return qListKegiatan.all(); }
function listKegiatanBulan(bln) { return qListKegiatanBulan.all(bln); }
function getKegiatan(id) { return qGetKegiatan.get(id); }
function updateKegiatan(id, x) { qUpdateKegiatan.run(x.tanggal, x.jam_mulai || '', x.jam_selesai || '', x.judul, x.jenis, x.lokasi || '', x.keterangan || '', id); }
function deleteKegiatan(id) { qDeleteKegiatan.run(id); }
function setKegiatanSelesai(id, s) { qSetKegiatanSelesai.run(s, id); }
function kegiatanHariIni() { return qKegiatanHariIni.all(); }

// ---------- Notifikasi ----------
const qInsertNotifikasi = db.prepare('INSERT INTO notifikasi (user_id, jenis, pesan, link) VALUES (?,?,?,?)');
const qListNotifikasiUser = db.prepare('SELECT * FROM notifikasi WHERE user_id=? ORDER BY created_at DESC LIMIT 30');
const qCountBelumBaca = db.prepare('SELECT COUNT(*) AS n FROM notifikasi WHERE user_id=? AND dibaca=0');
const qMarkAllBaca = db.prepare('UPDATE notifikasi SET dibaca=1 WHERE user_id=?');
const qMarkOneBaca = db.prepare('UPDATE notifikasi SET dibaca=1 WHERE id=? AND user_id=?');

function createNotifikasi(user_id, jenis, pesan, link) { qInsertNotifikasi.run(user_id, jenis, pesan, link || '#'); }
function listNotifikasiUser(uid) { return qListNotifikasiUser.all(uid); }
function countBelumBaca(uid) { return qCountBelumBaca.get(uid).n; }
function markAllBaca(uid) { qMarkAllBaca.run(uid); }
function markOneBaca(id, uid) { qMarkOneBaca.run(id, uid); }

// ---------- Log ----------
const qInsertLog = db.prepare('INSERT INTO log (user_id, username, aksi, modul, detail, ip) VALUES (?,?,?,?,?,?)');
const qListLog = db.prepare('SELECT * FROM log ORDER BY created_at DESC, id DESC LIMIT 500');
const qCountLog = db.prepare('SELECT COUNT(*) AS n FROM log');

function writeLog(user, aksi, modul, detail, ip) {
  try { qInsertLog.run(user ? user.id : null, user ? user.username : 'sistem', aksi, modul || '', detail || '', ip || ''); } catch (e) { /* ignore */ }
}
function listLog() { return qListLog.all(); }
function countLog() { return qCountLog.get().n; }

// ---------- Dashboard / statistik ----------
function dashStats() {
  const q = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0) AS total_arsip,
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0 AND jenis='surat-masuk') AS surat_masuk,
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0 AND jenis='surat-keluar') AS surat_keluar,
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0 AND jenis IN ('sertifikat','sk')) AS dokumen,
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0 AND status='hilang') AS hilang,
      (SELECT COUNT(*) FROM arsip WHERE is_deleted=0 AND status='rusak') AS rusak,
      (SELECT COUNT(*) FROM peminjaman WHERE status='dipinjam') AS peminjaman_aktif,
      (SELECT COUNT(*) FROM disposisi WHERE status='proses') AS disposisi_proses`);
  const row = q.get();
  row.total_kategori = db.prepare('SELECT COUNT(*) AS n FROM kategori').get().n;
  row.total_user = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status=1").get().n;
  return row;
}

function tren12Bulan() {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS bulan, COUNT(*) AS n
    FROM arsip WHERE is_deleted=0 AND created_at >= date('now','localtime','-11 months','start of month')
    GROUP BY bulan ORDER BY bulan`).all();
  return rows;
}

function arsipPerStatus() {
  return db.prepare(`
    SELECT status, COUNT(*) AS n FROM arsip
    WHERE is_deleted=0 GROUP BY status`).all();
}

function arsipPerKategori() {
  return db.prepare(`
    SELECT COALESCE(k.kode,'-') AS kode, COUNT(a.id) AS n FROM arsip a
    LEFT JOIN kategori k ON k.id=a.kategori_id
    WHERE a.is_deleted=0 GROUP BY k.kode ORDER BY n DESC LIMIT 12`).all();
}

function arsipPerBulan(tahun) {
  const y = tahun || new Date().getFullYear();
  return db.prepare(`
    SELECT strftime('%m', created_at) AS bulan, COUNT(*) AS n
    FROM arsip WHERE is_deleted=0 AND strftime('%Y', created_at)=?
    GROUP BY bulan ORDER BY bulan`).all(String(y));
}

function disposisiTerbaru() {
  return db.prepare(`
    SELECT d.*, a.nomor_arsip, a.judul AS judul_arsip, u_k.nama_lengkap AS ke_nama
    FROM disposisi d
    LEFT JOIN arsip a ON a.id=d.arsip_id
    LEFT JOIN users u_k ON u_k.id=d.ke_user_id
    ORDER BY d.created_at DESC LIMIT 5`).all();
}

module.exports = {
  findUserByUsername, findUserById, listUsers, createUser, updateUser, setPassword, setLastLogin,
  deleteUser, removeUserDisposisiKe,
  getPengaturan, updatePengaturan,
  listKategori, getKategori, createKategori, updateKategori, deleteKategori,
  listLokasi, createLokasi, updateLokasi, deleteLokasi,
  listUnit, createUnit, updateUnit, deleteUnit,
  listInstansi, createInstansi, updateInstansi, deleteInstansi,
  listArsip, getArsip, createArsip, updateArsip, softDeleteArsip, restoreArsip, hardDeleteArsip,
  listTrash, setArsipStatus, countArsip, nextNomorArsip,
  createDisposisi, listDisposisi, getDisposisi, setDisposisiStatus, markDisposisiBaca, countDisposisiBelumBaca,
  createPeminjaman, listPeminjaman, getPeminjaman, kembalikanPeminjaman, deletePeminjaman, updateOverdue,
  listPeminjamanAktif, countPeminjamanAktif, countPeminjamanTerlambat,
  nextAgendaNomor, createAgenda, listAgenda,
  createKegiatan, listKegiatan, listKegiatanBulan, getKegiatan, updateKegiatan, deleteKegiatan,
  setKegiatanSelesai, kegiatanHariIni,
  createNotifikasi, listNotifikasiUser, countBelumBaca, markAllBaca, markOneBaca,
  writeLog, listLog, countLog,
  dashStats, tren12Bulan, arsipPerStatus, arsipPerKategori, arsipPerBulan, disposisiTerbaru,
};