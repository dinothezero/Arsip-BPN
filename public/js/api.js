'use strict';
/* API helper - semua panggilan ke /api */
const API = (() => {
  async function request(method, url, body, isForm) {
    const opts = { method, headers: {} };
    if (body) {
      if (isForm) {
        opts.body = body;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : 'Terjadi kesalahan pada server.';
      throw Object.assign(new Error(msg), { status: res.status, data });
    }
    return data;
  }
  const get = (u) => request('GET', u);
  const post = (u, b) => request('POST', u, b, b instanceof FormData);
  const put = (u, b) => request('PUT', u, b, b instanceof FormData);
  const del = (u) => request('DELETE', u);

  function login(username, password) { return post('/api/auth/login', { username, password }); }
  function logout() { return post('/api/auth/logout', {}); }
  function me() { return get('/api/auth/me'); }
  function gantiPassword(body) { return post('/api/auth/ganti-password', body); }

  return {
    get, post, put, del, request,
    login, logout, me, gantiPassword,
    // arsip
    arsip: (qsv) => get('/api/arsip' + (qsv ? '?' + qsv : '')),
    arsipDetail: (id) => get('/api/arsip/' + id),
    arsipPreview: (tahun, k) => get(`/api/arsip/preview/nomor?tahun=${tahun}&kategori_id=${k}`),
    arsipCreate: (form) => post('/api/arsip', form),
    arsipUpdate: (id, form) => put('/api/arsip/' + id, form),
    arsipSoftDelete: (id) => del('/api/arsip/' + id),
    arsipRestore: (id) => post('/api/arsip/' + id + '/restore', {}),
    arsipPermanen: (id) => del('/api/arsip/' + id + '/permanen'),
    arsipStatus: (id, status) => post('/api/arsip/' + id + '/status', { status }),
    trash: () => get('/api/arsip/trash'),
    download: (id) => '/api/arsip/' + id + '/download',
    qr: (id) => '/api/arsip/' + id + '/qr',
    // disposisi
    disposisi: () => get('/api/disposisi'),
    disposisiCreate: (b) => post('/api/disposisi', b),
    disposisiBaca: (id) => put('/api/disposisi/' + id + '/baca', {}),
    disposisiStatus: (id, s) => put('/api/disposisi/' + id + '/status', { status: s }),
    // peminjaman
    pinjam: () => get('/api/peminjaman'),
    pinjamAktif: () => get('/api/peminjaman/aktif'),
    pinjamCreate: (b) => post('/api/peminjaman', b),
    pinjamKembalikan: (id) => put('/api/peminjaman/' + id + '/kembalikan', {}),
    pinjamHapus: (id) => del('/api/peminjaman/' + id),
    // agenda & kegiatan
    agenda: () => get('/api/agenda'),
    kegiatan: (bln) => get('/api/kegiatan' + (bln ? '?bulan=' + bln : '')),
    kegiatanCreate: (b) => post('/api/kegiatan', b),
    kegiatanUpdate: (id, b) => put('/api/kegiatan/' + id, b),
    kegiatanDelete: (id) => del('/api/kegiatan/' + id),
    kegiatanSelesai: (id, s) => put('/api/kegiatan/' + id + '/selesai', { selesai: s }),
    // master
    masterKategori: () => get('/api/master/kategori'),
    masterKategoriCreate: (b) => post('/api/master/kategori', b),
    masterKategoriUpdate: (id, b) => put('/api/master/kategori/' + id, b),
    masterKategoriDelete: (id) => del('/api/master/kategori/' + id),
    masterLokasi: () => get('/api/master/lokasi'),
    masterLokasiCreate: (b) => post('/api/master/lokasi', b),
    masterLokasiUpdate: (id, b) => put('/api/master/lokasi/' + id, b),
    masterLokasiDelete: (id) => del('/api/master/lokasi/' + id),
    masterUnit: () => get('/api/master/unit'),
    masterUnitCreate: (b) => post('/api/master/unit', b),
    masterUnitUpdate: (id, b) => put('/api/master/unit/' + id, b),
    masterUnitDelete: (id) => del('/api/master/unit/' + id),
    masterInstansi: () => get('/api/master/instansi'),
    masterInstansiCreate: (b) => post('/api/master/instansi', b),
    masterInstansiUpdate: (id, b) => put('/api/master/instansi/' + id, b),
    masterInstansiDelete: (id) => del('/api/master/instansi/' + id),
    // pengaturan & users
    pengaturan: () => get('/api/pengaturan'),
    pengaturanUpdate: (b) => put('/api/pengaturan', b),
    users: () => get('/api/users'),
    userCreate: (b) => post('/api/users', b),
    userUpdate: (id, b) => put('/api/users/' + id, b),
    userDelete: (id) => del('/api/users/' + id),
    // notifikasi
    notif: () => get('/api/notifikasi'),
    notifBelum: () => get('/api/notifikasi/belum-baca'),
    notifBacaSemua: () => put('/api/notifikasi/baca-semua', {}),
    notifBaca: (id) => put('/api/notifikasi/' + id + '/baca', {}),
    // log
    log: () => get('/api/log'),
    // dashboard & laporan
    dashboard: () => get('/api/dashboard'),
    rekap: (qsv) => get('/api/laporan/rekap' + (qsv ? '?' + qsv : '')),
    importCsv: (fd) => post('/api/laporan/import-csv', fd),
    exportCsv: (q) => '/api/laporan/export-csv' + (q || ''),
    exportXlsx: (q) => '/api/laporan/export-xlsx' + (q || ''),
    backup: () => '/api/laporan/backup',
  };
})();
window.API = API;