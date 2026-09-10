/* Arsip BPN - Data Store (LocalStorage) */
const Store = (() => {
  const KEY = 'arsip-bpn-data';
  const SESSION = 'arsip-bpn-session';
  const VERSION = '1.0';

  function simpleHash(str) {
    let h = 5381;
    const s = 'bpn::' + str;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }

  function seed() {
    return {
      version: VERSION,
      ids: { user: 2, kategori: 8, suratMasuk: 0, suratKeluar: 0, arsip: 0, sertifikat: 0, disposisi: 0, log: 0 },
      users: [
        { id: 1, username: 'admin', password: simpleHash('admin123'), nama_lengkap: 'Administrator', nip: '198001012005011001', jabatan: 'Admin Sistem', role: 'admin', email: 'admin@bpn.go.id', telepon: '', status: 1, created_at: Date.now() },
        { id: 2, username: 'kepala', password: simpleHash('kepala123'), nama_lengkap: 'Kepala Kantor', nip: '197501012000031002', jabatan: 'Kepala Kantor', role: 'kepala', email: 'kepala@bpn.go.id', telepon: '', status: 1, created_at: Date.now() }
      ],
      kategori: [
        { id: 1, nama_kategori: 'Umum', keterangan: 'Surat pengumuman dan pemberitahuan umum', tipe: 'semua' },
        { id: 2, nama_kategori: 'Kepegawaian', keterangan: 'Surat terkait kepegawaian dan SDM', tipe: 'semua' },
        { id: 3, nama_kategori: 'Keuangan', keterangan: 'Surat terkait keuangan dan anggaran', tipe: 'semua' },
        { id: 4, nama_kategori: 'Pertanahan', keterangan: 'Surat terkait urusan pertanahan', tipe: 'semua' },
        { id: 5, nama_kategori: 'Teknis', keterangan: 'Surat teknis dan pelaksanaan', tipe: 'semua' },
        { id: 6, nama_kategori: 'Hukum', keterangan: 'Surat hukum dan peraturan', tipe: 'semua' },
        { id: 7, nama_kategori: 'Koordinasi', keterangan: 'Surat koordinasi antar instansi', tipe: 'semua' },
        { id: 8, nama_kategori: 'Pimpinan', keterangan: 'Surat dari/ke pimpinan', tipe: 'semua' }
      ],
      suratMasuk: [],
      suratKeluar: [],
      arsip: [],
      sertifikat: [],
      disposisi: [],
      pengaturan: { nama_kantor: 'Kantor Pertanahan Kabupaten', alamat_kantor: 'Jl. Pertanahan No. 1, Kabupaten', telepon_kantor: '(021) 1234-5678', email_kantor: 'info@bpn-kab.go.id', website: '' },
      log: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { const s = seed(); save(s); return s; }
      const d = JSON.parse(raw);
      if (!d || d.version !== VERSION) { const s = seed(); save(s); return s; }
      return d;
    } catch (e) {
      const s = seed(); save(s); return s;
    }
  }

  function save(dirty) {
    try { localStorage.setItem(KEY, JSON.stringify(dirty || data)); } catch (e) { alert('Penyimpanan penuh! Hapus beberapa lampiran/dokumen.'); }
  }

  let data = load();

  function uid(entity) { data.ids[entity] = (data.ids[entity] || 0) + 1; return data.ids[entity]; }

  function hash(pw) { return simpleHash(pw); }

  function getSession() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } }
  function setSession(u) { localStorage.setItem(SESSION, JSON.stringify(u)); }
  function clearSession() { localStorage.removeItem(SESSION); }
  function currentUser() {
    const s = getSession();
    if (!s) return null;
    const u = data.users.find(x => x.id === s.id && x.status === 1);
    return u || null;
  }

  function login(username, password) {
    const u = data.users.find(x => x.username.trim().toLowerCase() === String(username).trim().toLowerCase() && x.status === 1);
    if (!u) return { ok: false, message: 'Username atau password salah!' };
    if (u.password !== simpleHash(password)) return { ok: false, message: 'Username atau password salah!' };
    setSession({ id: u.id });
    addLog(u.id, 'Login ke sistem', 'Auth', `User ${u.username} berhasil login`);
    return { ok: true, user: u };
  }

  function addLog(userId, aktivitas, modul, detail) {
    data.log.unshift({
      id: uid('log'), user_id: userId, username: (data.users.find(x => x.id === userId) || {}).username || '-',
      aktivitas, modul, detail: detail || '', ip_address: 'browser', created_at: Date.now()
    });
    if (data.log.length > 500) data.log = data.log.slice(0, 500);
    save();
  }

  function kategoriName(id) { const k = data.kategori.find(x => x.id === Number(id)); return k ? k.nama_kategori : '-'; }
  function userName(id) { const u = data.users.find(x => x.id === Number(id)); return u ? u.nama_lengkap : '-'; }
  function userInitial(name) { return (name || '?').charAt(0).toUpperCase(); }

  function fmt(date, withTime) {
    if (!date) return '-';
    const d = typeof date === 'number' ? new Date(date) : new Date(date);
    if (isNaN(d)) return String(date);
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    if (withTime) opts.hour = '2-digit', opts.minute = '2-digit';
    return d.toLocaleDateString('id-ID', opts) + (withTime ? ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
  }

  return {
    get data() { return data; },
    load, save, uid, hash, login,
    currentUser, getSession, setSession, clearSession,
    addLog, kategoriName, userName, userInitial, fmt,
    resetDemo() {
      const s = seed();
      save(s);
      data = s;
      clearSession();
    }
  };
})();