'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');

const Q = require('../db/queries');
const { db, UPLOAD_DIR } = require('../db/db');
const { requireAuth, requireRole, logAction, bcrypt } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.zip'];

const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, UPLOAD_DIR); },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  },
});
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXT.includes(ext)) cb(null, true);
  else cb(new Error('Tipe berkas tidak diizinkan.'));
}
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

const pick = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };

// ================= AUTH =================
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  const user = Q.findUserByUsername(String(username).trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    logAction(null, 'GAGAL LOGIN', 'auth', `Username ${username} salah password`, req.ip);
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  if (user.status !== 1) return res.status(403).json({ error: 'Akun anda nonaktif.' });
  req.session.userId = user.id;
  Q.setLastLogin(user.id);
  logAction(user, 'LOGIN', 'auth', `${user.role} masuk`);
  res.json({ user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role } });
});

router.post('/auth/logout', requireAuth, (req, res) => {
  logAction(req.user, 'LOGOUT', 'auth', `${req.user.username} keluar`);
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, nama_lengkap: req.user.nama_lengkap, nip: req.user.nip, jabatan: req.user.jabatan, role: req.user.role },
    belumBaca: Q.countBelumBaca(req.user.id) + Q.countDisposisiBelumBaca(req.user.id),
  });
});

router.post('/auth/ganti-password', requireAuth, (req, res) => {
  const { password_lama, password_baru } = req.body || {};
  if (!password_lama || !password_baru) return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });
  if (!bcrypt.compareSync(String(password_lama), req.user.password_hash)) return res.status(400).json({ error: 'Password lama salah.' });
  if (String(password_baru).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  Q.setPassword(req.user.id, bcrypt.hashSync(String(password_baru), 10));
  logAction(req.user, 'GANTI PASSWORD', 'auth', '');
  res.json({ ok: true });
});

// ================= ARSIP =================
router.get('/arsip', requireAuth, (req, res) => {
  const r = Q.listArsip(pick(req.query, ['q', 'kategori_id', 'jenis', 'status', 'instansi_id', 'lokasi_id', 'unit_id', 'dari', 'sampai', 'tahun', 'sort', 'order', 'limit', 'offset']));
  res.json(r);
});
router.get('/arsip/trash', requireAuth, requireRole('admin'), (req, res) => res.json(Q.listTrash()));
router.get('/arsip/:id', requireAuth, (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (!a) return res.status(404).json({ error: 'Arsip tidak ditemukan.' });
  const now = new Date().toISOString().slice(0, 10);
  a.agenda_ke = db.prepare('SELECT * FROM agenda WHERE arsip_id=?').all(a.id);
  a.disposisi_list = db.prepare(`
    SELECT d.*, u_d.nama_lengkap AS dari_nama, u_k.nama_lengkap AS ke_nama
    FROM disposisi d LEFT JOIN users u_d ON u_d.id=d.dari_user_id LEFT JOIN users u_k ON u_k.id=d.ke_user_id
    WHERE d.arsip_id=? ORDER BY d.created_at DESC`).all(a.id);
  a.peminjaman_list = db.prepare('SELECT * FROM peminjaman WHERE arsip_id=? ORDER BY created_at DESC').all(a.id);
  a.tanggal_sekarang = now;
  res.json(a);
});

// nomor arsip otomatis
router.get('/arsip/preview/nomor', requireAuth, (req, res) => {
  const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
  const kid = req.query.kategori_id ? Number(req.query.kategori_id) : 0;
  try {
    const kode = kid ? (Q.getKategori(kid) || {}).kode : 'ARS';
    const cur = db.prepare('SELECT urut FROM arsip_counter WHERE tahun=? AND kategori_id=?').get(tahun, kid) || { urut: 0 };
    res.json({ nomor: `${kode || 'ARS'}/${tahun}/${String(cur.urut + 1).padStart(4, '0')}` });
  } catch (e) { res.json({ nomor: `${tahun}/0001` }); }
});

router.post('/arsip', requireAuth, upload.single('file'), (req, res) => {
  const b = req.body;
  if (!b.judul) return res.status(400).json({ error: 'Judul wajib diisi.' });
  const kategori_id = b.kategori_id ? Number(b.kategori_id) : null;
  const tahun = parseInt(b.tahun_arsip, 10) || new Date().getFullYear();
  const nomor = b.nomor_arsip_manual || Q.nextNomorArsip(kategori_id, tahun);
  const id = Q.createArsip({
    nomor_arsip: nomor, kategori_id, jenis: b.jenis || 'surat-masuk', judul: b.judul,
    perihal: b.perihal, tanggal: b.tanggal, tahun_arsip: tahun,
    instansi_id: b.instansi_id ? Number(b.instansi_id) : null,
    unit_id: b.unit_id ? Number(b.unit_id) : null,
    lokasi_id: b.lokasi_id ? Number(b.lokasi_id) : null,
    status: b.status || 'aktif', keterangan: b.keterangan, created_by: req.user.id,
    file_name: req.file ? req.file.originalname : '', file_path: req.file ? req.file.filename : '', file_size: req.file ? req.file.size : 0,
  });
  if (b.auto_agenda === '1' || b.auto_agenda === 'on') {
    if (b.jenis === 'surat-masuk' || b.jenis === 'surat-keluar') {
      const jenisAgenda = b.jenis === 'surat-masuk' ? 'masuk' : 'keluar';
      const n = Q.nextAgendaNomor(tahun, jenisAgenda);
      Q.createAgenda({ tahun, jenis: jenisAgenda, nomor_urut: n, arsip_id: id, tanggal: b.tanggal || new Date().toISOString().slice(0, 10) });
    }
  }
  logAction(req.user, 'TAMBAH ARSIP', 'arsip', nomor);
  res.json({ id, nomor_arsip: nomor });
});

router.put('/arsip/:id', requireAuth, upload.single('file'), (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (!a) return res.status(404).json({ error: 'Arsip tidak ditemukan.' });
  const b = req.body;
  const file_name = req.file ? req.file.originalname : (b.keep_file === '1' ? a.file_name : '');
  const file_path = req.file ? req.file.filename : (b.keep_file === '1' ? a.file_path : '');
  const file_size = req.file ? req.file.size : a.file_size;
  Q.updateArsip(a.id, {
    kategori_id: b.kategori_id ? Number(b.kategori_id) : null, jenis: b.jenis || a.jenis, judul: b.judul || a.judul,
    perihal: b.perihal !== undefined ? b.perihal : a.perihal, tanggal: b.tanggal || a.tanggal,
    tahun_arsip: parseInt(b.tahun_arsip, 10) || a.tahun_arsip,
    instansi_id: b.instansi_id ? Number(b.instansi_id) : null, unit_id: b.unit_id ? Number(b.unit_id) : null,
    lokasi_id: b.lokasi_id ? Number(b.lokasi_id) : null, status: b.status || a.status,
    file_name, file_path, file_size, keterangan: b.keterangan !== undefined ? b.keterangan : a.keterangan,
  });
  logAction(req.user, 'UBAH ARSIP', 'arsip', a.nomor_arsip);
  res.json({ ok: true });
});

router.delete('/arsip/:id', requireAuth, (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (!a) return res.status(404).json({ error: 'Arsip tidak ditemukan.' });
  Q.softDeleteArsip(a.id);
  logAction(req.user, 'HAPUS (TEMPAT SAMPAH)', 'arsip', a.nomor_arsip);
  res.json({ ok: true });
});

// restore / hapus permanen (admin)
router.post('/arsip/:id/restore', requireAuth, requireRole('admin'), (req, res) => {
  Q.restoreArsip(req.params.id);
  logAction(req.user, 'PULIHKAN ARSIP', 'arsip', req.params.id);
  res.json({ ok: true });
});
router.delete('/arsip/:id/permanen', requireAuth, requireRole('admin'), (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (a && a.file_path && fs.existsSync(path.join(UPLOAD_DIR, a.file_path))) {
    fs.unlinkSync(path.join(UPLOAD_DIR, a.file_path));
  }
  Q.hardDeleteArsip(req.params.id);
  logAction(req.user, 'HAPUS PERMANEN', 'arsip', a ? a.nomor_arsip : req.params.id);
  res.json({ ok: true });
});
router.post('/arsip/:id/status', requireAuth, (req, res) => {
  Q.setArsipStatus(req.params.id, req.body.status);
  const a = Q.getArsip(req.params.id);
  logAction(req.user, 'UBAH STATUS ARSIP', 'arsip', a ? a.nomor_arsip + ' -> ' + req.body.status : '');
  res.json({ ok: true });
});

// download lampiran
router.get('/arsip/:id/download', requireAuth, (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (!a || !a.file_path) return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
  const full = path.join(UPLOAD_DIR, a.file_path);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Berkas sudah dihapus dari penyimpanan.' });
  res.download(full, a.file_name || a.file_path);
});

// QR code sebagai PNG
router.get('/arsip/:id/qr', requireAuth, (req, res) => {
  const a = Q.getArsip(req.params.id);
  if (!a) return res.status(404).json({ error: 'Arsip tidak ditemukan.' });
  const data = `ARSIP-DIGITAL|${a.nomor_arsip}|${a.id}|${a.judul}`;
  QRCode.toBuffer(data, { width: 300, margin: 1, color: { dark: '#0f766e', light: '#ffffff' } })
    .then((buf) => { res.type('png').send(buf); })
    .catch(() => res.status(500).json({ error: 'Gagal membuat QR.' }));
});

// ================= DISPOSISI =================
router.get('/disposisi', requireAuth, (req, res) => res.json(Q.listDisposisi()));
router.post('/disposisi', requireAuth, (req, res) => {
  const b = req.body;
  if (!b.arsip_id || !b.ke_user_id) return res.status(400).json({ error: 'Arsip dan tujuan disposisi wajib diisi.' });
  Q.createDisposisi({
    arsip_id: Number(b.arsip_id), dari_user_id: req.user.id, ke_user_id: Number(b.ke_user_id),
    instruksi: b.instruksi, catatan: b.catatan, tanggal: b.tanggal || new Date().toISOString().slice(0, 10),
  });
  const a = Q.getArsip(Number(b.arsip_id));
  const ke = Q.findUserById(Number(b.ke_user_id));
  Q.createNotifikasi(ke.id, 'disposisi', `Anda menerima disposisi arsip ${a.nomor_arsip}`, '#/disposisi');
  logAction(req.user, 'DISPOSISI', 'disposisi', `${a.nomor_arsip} ke ${ke.nama_lengkap}`);
  res.json({ ok: true });
});
router.put('/disposisi/:id/baca', requireAuth, (req, res) => {
  Q.markDisposisiBaca(req.params.id, req.user.id);
  res.json({ ok: true });
});
router.put('/disposisi/:id/status', requireAuth, (req, res) => {
  Q.setDisposisiStatus(req.params.id, req.body.status);
  logAction(req.user, 'STATUS DISPOSISI', 'disposisi', req.body.status);
  res.json({ ok: true });
});

// ================= PEMINJAMAN =================
router.get('/peminjaman', requireAuth, (req, res) => {
  Q.updateOverdue();
  res.json(Q.listPeminjaman());
});
router.get('/peminjaman/aktif', requireAuth, (req, res) => {
  Q.updateOverdue();
  res.json(Q.listPeminjamanAktif());
});
router.post('/peminjaman', requireAuth, (req, res) => {
  const b = req.body;
  if (!b.arsip_id || !b.peminjam || !b.jatuh_tempo) return res.status(400).json({ error: 'Arsip, peminjam, dan jatuh tempo wajib diisi.' });
  const a = Q.getArsip(Number(b.arsip_id));
  Q.createPeminjaman({
    arsip_id: Number(b.arsip_id), peminjam: b.peminjam, unit_peminjam: b.unit_peminjam,
    tanggal_pinjam: b.tanggal_pinjam || new Date().toISOString().slice(0, 10), jatuh_tempo: b.jatuh_tempo,
    keterangan: b.keterangan, created_by: req.user.id,
  });
  if (a) Q.setArsipStatus(a.id, 'dipinjam');
  logAction(req.user, 'PEMINJAMAN', 'peminjaman', `${b.peminjam} - ${a ? a.nomor_arsip : ''}`);
  res.json({ ok: true });
});
router.put('/peminjaman/:id/kembalikan', requireAuth, (req, res) => {
  const p = Q.getPeminjaman(req.params.id);
  if (p) Q.kembalikanPeminjaman(p.id);
  if (p) Q.setArsipStatus(p.arsip_id, 'aktif');
  logAction(req.user, 'PENGEMBALIAN', 'peminjaman', req.params.id);
  res.json({ ok: true });
});
router.delete('/peminjaman/:id', requireAuth, (req, res) => { Q.deletePeminjaman(req.params.id); res.json({ ok: true }); });

// ================= AGENDA =================
router.get('/agenda', requireAuth, (req, res) => res.json(Q.listAgenda()));

// ================= KEGIATAN =================
router.get('/kegiatan', requireAuth, (req, res) => {
  const bln = req.query.bulan || new Date().toISOString().slice(0, 7);
  res.json(Q.listKegiatanBulan(bln));
});
router.post('/kegiatan', requireAuth, (req, res) => {
  const b = req.body;
  if (!b.tanggal || !b.judul) return res.status(400).json({ error: 'Tanggal dan judul wajib diisi.' });
  Q.createKegiatan({ ...b, created_by: req.user.id });
  logAction(req.user, 'TAMBAH KEGIATAN', 'kegiatan', b.judul);
  res.json({ ok: true });
});
router.put('/kegiatan/:id', requireAuth, (req, res) => {
  Q.updateKegiatan(req.params.id, req.body);
  logAction(req.user, 'UBAH KEGIATAN', 'kegiatan', req.body.judul || '');
  res.json({ ok: true });
});
router.delete('/kegiatan/:id', requireAuth, (req, res) => { Q.deleteKegiatan(req.params.id); res.json({ ok: true }); });
router.put('/kegiatan/:id/selesai', requireAuth, (req, res) => { Q.setKegiatanSelesai(req.params.id, req.body.selesai ? 1 : 0); res.json({ ok: true }); });

// ================= MASTER DATA =================
router.get('/master/kategori', requireAuth, (req, res) => res.json(Q.listKategori()));
router.post('/master/kategori', requireAuth, requireRole('admin'), (req, res) => {
  const b = req.body;
  if (!b.kode || !b.nama_kategori) return res.status(400).json({ error: 'Kode dan nama kategori wajib.' });
  try { const k = Q.createKategori(b); logAction(req.user, 'TAMBAH KATEGORI', 'master', b.kode); res.json(k); }
  catch (e) { res.status(400).json({ error: 'Kode kategori sudah dipakai.' }); }
});
router.put('/master/kategori/:id', requireAuth, requireRole('admin'), (req, res) => { Q.updateKategori(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/master/kategori/:id', requireAuth, requireRole('admin'), (req, res) => {
  const a = db.prepare('SELECT COUNT(*) AS n FROM arsip WHERE kategori_id=?').get(req.params.id).n;
  if (a > 0) return res.status(400).json({ error: `Kategori dipakai ${a} arsip. Ubah arsipnya dulu.` });
  Q.deleteKategori(req.params.id); res.json({ ok: true });
});

router.get('/master/lokasi', requireAuth, (req, res) => res.json(Q.listLokasi()));
router.post('/master/lokasi', requireAuth, requireRole('admin'), (req, res) => { Q.createLokasi(req.body); res.json({ ok: true }); });
router.put('/master/lokasi/:id', requireAuth, requireRole('admin'), (req, res) => { Q.updateLokasi(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/master/lokasi/:id', requireAuth, requireRole('admin'), (req, res) => { Q.deleteLokasi(req.params.id); res.json({ ok: true }); });

router.get('/master/unit', requireAuth, (req, res) => res.json(Q.listUnit()));
router.post('/master/unit', requireAuth, requireRole('admin'), (req, res) => { Q.createUnit(req.body); res.json({ ok: true }); });
router.put('/master/unit/:id', requireAuth, requireRole('admin'), (req, res) => { Q.updateUnit(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/master/unit/:id', requireAuth, requireRole('admin'), (req, res) => { Q.deleteUnit(req.params.id); res.json({ ok: true }); });

router.get('/master/instansi', requireAuth, (req, res) => res.json(Q.listInstansi()));
router.post('/master/instansi', requireAuth, requireRole('admin'), (req, res) => { Q.createInstansi(req.body); res.json({ ok: true }); });
router.put('/master/instansi/:id', requireAuth, requireRole('admin'), (req, res) => { Q.updateInstansi(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/master/instansi/:id', requireAuth, requireRole('admin'), (req, res) => { Q.deleteInstansi(req.params.id); res.json({ ok: true }); });

// ================= PENGATURAN / PROFIL KANTOR =================
router.get('/pengaturan', requireAuth, (req, res) => res.json(Q.getPengaturan()));
router.put('/pengaturan', requireAuth, requireRole('admin'), (req, res) => {
  Q.updatePengaturan(req.body);
  logAction(req.user, 'UBAH PROFIL KANTOR', 'pengaturan', '');
  res.json({ ok: true });
});

// ================= USERS =================
router.get('/users', requireAuth, requireRole('admin'), (req, res) => res.json(Q.listUsers()));
router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const b = req.body;
  if (!b.username || !b.nama_lengkap) return res.status(400).json({ error: 'Username dan nama lengkap wajib.' });
  if (Q.findUserByUsername(b.username)) return res.status(400).json({ error: 'Username sudah dipakai.' });
  const u = Q.createUser({ username: b.username, hash: bcrypt.hashSync(b.password || 'password123', 10), nama_lengkap: b.nama_lengkap, nip: b.nip, jabatan: b.jabatan, role: b.role || 'staf', status: b.status === undefined ? 1 : Number(b.status) });
  logAction(req.user, 'TAMBAH USER', 'pengguna', b.username);
  res.json(u);
});
router.put('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const b = req.body;
  Q.updateUser(req.params.id, { nama_lengkap: b.nama_lengkap, nip: b.nip, jabatan: b.jabatan, role: b.role, status: Number(b.status) });
  if (b.password) Q.setPassword(req.params.id, bcrypt.hashSync(b.password, 10));
  logAction(req.user, 'UBAH USER', 'pengguna', b.username || req.params.id);
  res.json({ ok: true });
});
router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
  Q.deleteUser(req.params.id);
  logAction(req.user, 'HAPUS USER', 'pengguna', req.params.id);
  res.json({ ok: true });
});

// ================= NOTIFIKASI =================
router.get('/notifikasi', requireAuth, (req, res) => res.json(Q.listNotifikasiUser(req.user.id)));
router.get('/notifikasi/belum-baca', requireAuth, (req, res) => res.json({ jumlah: Q.countBelumBaca(req.user.id) + Q.countDisposisiBelumBaca(req.user.id) }));
router.put('/notifikasi/baca-semua', requireAuth, (req, res) => { Q.markAllBaca(req.user.id); res.json({ ok: true }); });
router.put('/notifikasi/:id/baca', requireAuth, (req, res) => { Q.markOneBaca(req.params.id, req.user.id); res.json({ ok: true }); });

// ================= LOG =================
router.get('/log', requireAuth, requireRole('admin'), (req, res) => res.json(Q.listLog()));

// ================= DASHBOARD STATISTIK =================
router.get('/dashboard', requireAuth, (req, res) => {
  const s = Q.dashStats();
  const bln = new Date().toISOString().slice(0, 7);
  res.json({
    stats: s,
    tren12: Q.tren12Bulan(),
    perStatus: Q.arsipPerStatus(),
    perKategori: Q.arsipPerKategori(),
    agendaHariIni: Q.kegiatanHariIni(),
    pinjamAktif: Q.listPeminjamanAktif().slice(0, 5),
    disposisiTerbaru: Q.disposisiTerbaru(),
    kegiatanBulan: Q.listKegiatanBulan(bln),
  });
});

// ================= LAPORAN / EKSPOR =================
router.get('/laporan/rekap', requireAuth, (req, res) => {
  const { jenis, dari, sampai, kategori_id } = req.query;
  const w = ['a.is_deleted=0'];
  const p = [];
  if (jenis) { w.push('a.jenis=?'); p.push(jenis); }
  if (dari && sampai) { w.push('a.tanggal BETWEEN ? AND ?'); p.push(dari, sampai); }
  if (kategori_id) { w.push('a.kategori_id=?'); p.push(kategori_id); }
  const rows = db.prepare(`
    SELECT a.nomor_arsip, a.judul, a.perihal, a.tanggal, k.kode AS kategori, a.jenis, i.nama_instansi, l.nama_lokasi, a.status
    FROM arsip a
    LEFT JOIN kategori k ON k.id=a.kategori_id
    LEFT JOIN instansi i ON i.id=a.instansi_id
    LEFT JOIN lokasi l ON l.id=a.lokasi_id
    WHERE ${w.join(' AND ')} ORDER BY a.tanggal DESC`).all(...p);
  res.json(rows);
});

// -------- Export CSV --------
router.get('/laporan/export-csv', requireAuth, (req, res) => {
  const w = ['a.is_deleted=0'];
  const p = [];
  if (req.query.jenis) { w.push('a.jenis=?'); p.push(req.query.jenis); }
  if (req.query.dari && req.query.sampai) { w.push('a.tanggal BETWEEN ? AND ?'); p.push(req.query.dari, req.query.sampai); }
  const rows = db.prepare(`
    SELECT a.nomor_arsip, a.judul, a.perihal, a.tanggal, k.kode AS kategori, a.jenis, i.nama_instansi, l.nama_lokasi, a.status
    FROM arsip a LEFT JOIN kategori k ON k.id=a.kategori_id LEFT JOIN instansi i ON i.id=a.instansi_id LEFT JOIN lokasi l ON l.id=a.lokasi_id
    WHERE ${w.join(' AND ')} ORDER BY a.tanggal DESC`).all(...p);
  const header = ['Nomor Arsip', 'Judul', 'Perihal', 'Tanggal', 'Kategori', 'Jenis', 'Instansi', 'Lokasi', 'Status'];
  const csv = '\uFEFF' + [header.join(';')].concat(rows.map((r) => [
    r.nomor_arsip, r.judul, r.perihal, r.tanggal, r.kategori, r.jenis, r.nama_instansi, r.nama_lokasi, r.status,
  ].map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';'))).join('\r\n');
  logAction(req.user, 'EKSPOR CSV', 'laporan', res.req.query.jenis || 'semua');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rekap-arsip-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// -------- Export Excel XLSX (dengan gaya hijau BPN) --------
router.get('/laporan/export-xlsx', requireAuth, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const w = ['a.is_deleted=0'];
    const p = [];
    if (req.query.jenis) { w.push('a.jenis=?'); p.push(req.query.jenis); }
    if (req.query.dari && req.query.sampai) { w.push('a.tanggal BETWEEN ? AND ?'); p.push(req.query.dari, req.query.sampai); }
    const rows = db.prepare(`
      SELECT a.nomor_arsip, a.judul, a.perihal, a.tanggal, k.kode AS kategori, a.jenis, i.nama_instansi, l.nama_lokasi, a.status
      FROM arsip a LEFT JOIN kategori k ON k.id=a.kategori_id LEFT JOIN instansi i ON i.id=a.instansi_id LEFT JOIN lokasi l ON l.id=a.lokasi_id
      WHERE ${w.join(' AND ')} ORDER BY a.tanggal DESC`).all(...p);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Arsip');
    const hijau = '0B6E4F', toska = '0E9F6E', emas = 'C9A227';
    ws.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Nomor Arsip', key: 'nomor_arsip', width: 22 },
      { header: 'Judul / Perihal', key: 'judul', width: 38 },
      { header: 'Tanggal', key: 'tanggal', width: 13 },
      { header: 'Kategori', key: 'kategori', width: 12 },
      { header: 'Jenis', key: 'jenis', width: 14 },
      { header: 'Instansi', key: 'nama_instansi', width: 26 },
      { header: 'Lokasi', key: 'nama_lokasi', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hijau } }; });
    headerRow.height = 22;
    rows.forEach((r, i) => {
      ws.addRow({ no: i + 1, ...r, judul: `${r.perihal || r.judul}` });
      const rr = ws.lastRow;
      const statusColor = r.status === 'aktif' ? 'E6F4EA' : r.status === 'dipinjam' ? 'FFF4E5' : r.status === 'hilang' ? 'FDECEA' : 'F4F4F4';
      rr.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows.length + 1, 1), column: 9 } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.getRow(1).eachCell((c) => { c.border = { bottom: { style: 'thin', color: { argb: toska } } }; });

    logAction(req.user, 'EKSPOR EXCEL', 'laporan', req.query.jenis || 'semua');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-arsip-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal membuat Excel: ' + e.message });
  }
});

// -------- Import CSV --------
router.post('/laporan/import-csv', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pilih berkas CSV dulu.' });
    const data = fs.readFileSync(path.join(UPLOAD_DIR, req.file.filename), 'utf8').replace(/^\uFEFF/, '');
    fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename));
    const lines = data.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.toLowerCase().startsWith('nomor arsip'));
    const header = data.split(/\r?\n/)[0].split(';').map((s) => s.replace(/^"|"$/g, ''));
    const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const nNomor = idx('Nomor Arsip'), nJudul = idx('Judul'), nPerihal = idx('Perihal'), nTanggal = idx('Tanggal'),
      nKategori = idx('Kategori'), nJenis = idx('Jenis'), nInstansi = idx('Instansi'), nLokasi = idx('Lokasi'), nStatus = idx('Status');
    if (nJudul < 0 && nNomor < 0) {
      return res.status(400).json({ error: 'Kolom tidak dikenali. Gunakan format: Nomor Arsip; Judul; Perihal; Tanggal; Kategori; Jenis; Instansi; Lokasi; Status' });
    }
    const parse = (i, def) => (i >= 0 && lines.length && lines[0].split(';')[i]) ? String(lines[0].split(';')[i]).replace(/^"|"$/g, '').trim() || def : def;
    let sukses = 0, gagal = 0; const logGagal = [];
    for (let li = 0; li < lines.length; li++) {
      try {
        const cols = lines[li].split(';').map((s) => s.replace(/^"|"$/g, '').trim());
        const gJudul = (nJudul >= 0 ? cols[nJudul] : '') || (nPerihal >= 0 ? cols[nPerihal] : '');
        if (!gJudul) { gagal++; logGagal.push(`Baris ${li + 2}: Judul kosong`); continue; }
        const tgl = nTanggal >= 0 ? cols[nTanggal] : '';
        const tahun = (tgl || '').slice(0, 4) || new Date().getFullYear();
        let kategoriId = null, kataKode = (nKategori >= 0 ? cols[nKategori] : '');
        if (kataKode) {
          const found = Q.listKategori().find((k) => k.kode.toLowerCase() === kataKode.toLowerCase() || k.nama_kategori.toLowerCase() === kataKode.toLowerCase());
          if (found) kategoriId = found.id;
        }
        const instNama = nInstansi >= 0 ? cols[nInstansi] : '';
        let instId = null;
        if (instNama) {
          const found = Q.listInstansi().find((i) => i.nama_instansi.toLowerCase() === instNama.toLowerCase());
          instId = found ? found.id : (Q.createInstansi({ nama_instansi: instNama, jenis: 'pengirim' }), db.prepare('SELECT id FROM instansi WHERE nama_instansi=?').get(instNama).id);
        }
        const lokNama = nLokasi >= 0 ? cols[nLokasi] : '';
        let lokId = null;
        if (lokNama) {
          const found = Q.listLokasi().find((l) => l.nama_lokasi.toLowerCase() === lokNama.toLowerCase());
          lokId = found ? found.id : (Q.createLokasi({ nama_lokasi: lokNama }), db.prepare('SELECT id FROM lokasi WHERE nama_lokasi=?').get(lokNama).id);
        }
        const nomor = (nNomor >= 0 && cols[nNomor]) ? cols[nNomor] : Q.nextNomorArsip(kategoriId, parseInt(tahun, 10));
        const jenis = (nJenis >= 0 ? cols[nJenis] : '') || 'surat-masuk';
        const status = (nStatus >= 0 ? cols[nStatus] : '') || 'aktif';
        Q.createArsip({
          nomor_arsip: nomor, kategori_id: kategoriId, jenis, judul: gJudul, perihal: nPerihal >= 0 ? cols[nPerihal] : '',
          tanggal: tgl, tahun_arsip: parseInt(tahun, 10), instansi_id: instId, lokasi_id: lokId, status, keterangan: '', created_by: req.user.id,
        });
        sukses++;
      } catch (e) { gagal++; logGagal.push(`Baris ${li + 2}: ${e.message}`); }
    }
    logAction(req.user, 'IMPORT CSV', 'laporan', `${sukses} ok, ${gagal} gagal`);
    res.json({ sukses, gagal, log: logGagal.slice(0, 20) });
  } catch (e) { res.status(500).json({ error: 'Gagal import: ' + e.message }); }
});

// -------- Backup JSON --------
router.get('/laporan/backup', requireAuth, requireRole('admin'), (req, res) => {
  const backup = {
    meta: { nama: 'Sistem Arsip', versi: 2, dibuat: new Date().toISOString(), oleh: req.user.username },
    pengaturan: Q.getPengaturan(),
    users: Q.listUsers(),
    kategori: Q.listKategori(),
    lokasi: Q.listLokasi(),
    unit: Q.listUnit(),
    instansi: Q.listInstansi(),
    disposisi: db.prepare('SELECT * FROM disposisi').all(),
    peminjaman: db.prepare('SELECT * FROM peminjaman').all(),
    agenda: db.prepare('SELECT * FROM agenda').all(),
    kegiatan: db.prepare('SELECT * FROM kegiatan').all(),
    log: db.prepare('SELECT * FROM log ORDER BY id').all(),
  };
  // batasi arsip agar tidak terlalu besar (hapus file_path binary) -> simpan nama file saja
  backup.arsip = db.prepare('SELECT id, nomor_arsip, kategori_id, jenis, judul, perihal, tanggal, tahun_arsip, instansi_id, unit_id, lokasi_id, status, file_name, keterangan, is_deleted, deleted_at, created_by, created_at, updated_at FROM arsip').all();
  logAction(req.user, 'BACKUP JSON', 'sistem', '');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="backup-arsip-bpn-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});

module.exports = router;