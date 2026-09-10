'use strict';
/* App controller: auth, router, sidebar, topbar, modal, splash, clock, notif */

const Modal = {
  el: null,
  onSave: null,
  _foot: null,
  init() {
    this.el = document.getElementById('modal-box');
    this._foot = document.getElementById('modal-foot');
    document.getElementById('modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  },
  open({ title, body, footer, onSave, lg }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    this.el.classList.toggle('modal-lg', !!lg);
    this._foot.innerHTML = footer || '';
    document.getElementById('modal-backdrop').classList.remove('hidden');
    this.onSave = onSave || null;
    document.body.style.overflow = 'hidden';
  },
  close() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    this.onSave = null;
    document.body.style.overflow = '';
  },
  save() { if (this.onSave) this.onSave(); },
};

const App = {
  user: null,
  state: { notifBelum: 0 },
  routes: {
    '/dashboard': { title: 'Dashboard', view: 'dashboard', ico: 'fa-gauge-high', crumb: 'Beranda' },
    '/arsip': { title: 'Arsip Dokumen', view: 'arsip', ico: 'fa-folder-open', crumb: 'Pengelolaan Arsip' },
    '/arsip/trash': { title: 'Tempat Sampah', view: 'trash', ico: 'fa-trash-can', crumb: 'Arsip Terhapus' },
    '/disposisi': { title: 'Disposisi', view: 'disposisi', ico: 'fa-right-left', crumb: 'Pengelolaan' },
    '/peminjaman': { title: 'Peminjaman Arsip', view: 'peminjaman', ico: 'fa-hand-holding', crumb: 'Pengelolaan' },
    '/agenda': { title: 'Buku Agenda', view: 'agenda', ico: 'fa-book-open', crumb: 'Administrasi' },
    '/kalender': { title: 'Kalender Kegiatan', view: 'kalender', ico: 'fa-calendar-days', crumb: 'Administrasi' },
    '/laporan': { title: 'Laporan & Ekspor', view: 'laporan', ico: 'fa-file-chart-column', crumb: 'Data & Ekspor' },
    '/master': { title: 'Master Data', view: 'master', ico: 'fa-database', crumb: 'Referensi', role: 'admin' },
    '/pengguna': { title: 'Manajemen Pengguna', view: 'pengguna', ico: 'fa-users', crumb: 'Administrasi', role: 'admin' },
    '/log': { title: 'Log Aktivitas', view: 'log', ico: 'fa-list-check', crumb: 'Audit', role: 'admin' },
    '/profil': { title: 'Profil Kantor & Kop Surat', view: 'profil', ico: 'fa-building-columns', crumb: 'Pengaturan', role: 'admin' },
  },
  init() {
    Modal.init();
    this.clock = setInterval(() => this.renderClock(), 1000);
    this.splash();
    this.restore();
  },
  splash() {
    const sp = document.getElementById('splash');
    setTimeout(() => {
      sp.style.transition = 'opacity .4s ease';
      sp.style.opacity = '0';
      setTimeout(() => sp.remove(), 400);
    }, 900);
  },
  restore() {
    API.me().then((r) => {
      this.user = r.user;
      this.state.notifBelum = r.belumBaca || 0;
      this.enterApp();
    }).catch(() => {
      this.showLogin();
    });
  },
  showLogin() {
    document.getElementById('app').classList.add('hidden');
    const ls = document.getElementById('login-screen');
    ls.classList.remove('hidden');
    ls.innerHTML = this.loginHTML();
  },
  loginHTML() {
    return `
      <div class="login-wrap">
        <div class="login-brand">
          <div class="logo-symbol"><i class="fas fa-landmark-dome" style="font-size:36px;color:#0b6e4f"></i></div>
          <h1>Sistem Arsip<br>Kantor Pertanahan</h1>
          <p>Pengelolaan arsip surat, sertifikat, dan dokumen pertanahan secara digital. Berjalan <b>100% lokal</b> di komputer Anda, tanpa biaya dan tanpa internet.</p>
          <div class="feat-pills">
            <span>CRUD Arsip</span><span>Disposisi</span><span>Peminjaman</span><span>Barcode / QR</span><span>Laporan &amp; Ekspor Excel</span><span>Backup JSON</span>
          </div>
        </div>
        <div class="login-card">
          <h3>Masuk ke Sistem</h3>
          <p class="sub">Gunakan akun yang diberikan oleh administrator.</p>
          <form onsubmit="App.login(event)">
            <div class="row"><label>Username</label><input class="field" id="login-username" autocomplete="username" placeholder="contoh: admin" required></div>
            <div class="row"><label>Password</label><input class="field" id="login-password" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
            <div class="row" id="login-err" style="display:none;color:#b91c1c;font-size:13px;background:#fdecec;padding:10px 14px;border-radius:8px"></div>
            <div class="row mt-3"><button class="btn btn-primary btn-block" id="login-btn" type="submit"><i class="fas fa-right-to-bracket"></i> Masuk</button></div>
          </form>
          <p class="text-center text-small text-muted mt-3">Kantor Pertanahan &middot; Sistem Arsip Digital &middot; v2.0</p>
        </div>
      </div>`;
  },
  async login(e) {
    e.preventDefault();
    const err = document.getElementById('login-err');
    const btn = document.getElementById('login-btn');
    err.style.display = 'none';
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
    try {
      const r = await API.login(document.getElementById('login-username').value.trim(), document.getElementById('login-password').value);
      this.user = r.user;
      this.state.notifBelum = 0;
      await this.enterApp();
      UI.toast(`Selamat datang, ${r.user.nama_lengkap}`, 'success');
    } catch (e2) {
      err.textContent = e2.message; err.style.display = 'block';
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Masuk';
    }
  },
  async logout() {
    UI.toast('Anda telah keluar.', 'info');
    this._nt && clearTimeout(this._nt);
    try { await API.logout(); } catch (e) { /* ignore */ }
    this.user = null;
    document.getElementById('app').classList.add('hidden');
    this.showLogin();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    location.hash = '#/dashboard';
    this.renderClock();
  },
  enterApp() {
    return new Promise((resolve) => {
      document.getElementById('login-screen').classList.add('hidden');
      const app = document.getElementById('app');
      app.classList.remove('hidden');
      this.renderSidebar();
      this.renderTopbar();
      this.bindGlobal();
      if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
      this.route();
      this.observeHash();
      this.pollNotif();
      resolve();
    });
  },
  bindGlobal() {
    document.getElementById('bt-menu').onclick = () => document.getElementById('sidebar').classList.toggle('open');
  },
  pollNotif() {
    this._nt && clearTimeout(this._nt);
    const t = () => {
      API.notifBelum().then((r) => { this.state.notifBelum = r.jumlah; this.refreshBadges(); }).catch(() => {});
      this._nt = setTimeout(t, 30000);
    };
    this._nt = setTimeout(t, 20000);
  },
  refreshBadges() {
    const d = document.getElementById('notif-dot');
    if (d) { d.textContent = this.state.notifBelum; d.style.display = this.state.notifBelum > 0 ? 'inline-flex' : 'none'; }
  },
  navMenu() {
    const admin = this.user && this.user.role === 'admin';
    const items = [
      { href: '#/dashboard', ico: 'fa-gauge-high', label: 'Dashboard' },
      { label: 'PENGELOLAAN', sep: true, role: true },
      { href: '#/arsip', ico: 'fa-folder-open', label: 'Arsip Dokumen', role: true },
      { href: '#/disposisi', ico: 'fa-right-left', label: 'Disposisi', role: true },
      { href: '#/peminjaman', ico: 'fa-hand-holding', label: 'Peminjaman' },
      { href: '#/arsip/trash', ico: 'fa-trash-can', label: 'Tempat Sampah', admin: true },
      { label: 'ADMINISTRASI', sep: true, role: true },
      { href: '#/agenda', ico: 'fa-book-open', label: 'Buku Agenda' },
      { href: '#/kalender', ico: 'fa-calendar-days', label: 'Kalender Kegiatan' },
      { label: 'DATA & LAPORAN', sep: true, role: true },
      { href: '#/laporan', ico: 'fa-file-chart-column', label: 'Laporan & Ekspor' },
      ...(admin ? [
        { label: 'ADMIN', sep: true },
        { href: '#/master', ico: 'fa-database', label: 'Master Data' },
        { href: '#/pengguna', ico: 'fa-users', label: 'Manajemen Pengguna' },
        { href: '#/log', ico: 'fa-list-check', label: 'Log Aktivitas' },
        { href: '#/profil', ico: 'fa-building-columns', label: 'Profil Kantor' },
      ] : []),
    ];
    return items;
  },
  roleOf() { return this.user ? this.user.role : ''; },
  renderSidebar() {
    const cur = location.hash || '#/dashboard';
    const items = this.navMenu().filter((x) => x.role !== false && !(x.admin && this.roleOf() !== 'admin'));
    let html = `
      <div class="side-brand">
        <div class="logo-mini"><i class="fas fa-landmark-dome"></i></div>
        <div class="nm">Arsip Kantor Pertanahan</div>
      </div>
      <div class="side-nav">`;
    for (const it of items) {
      if (it.sep) { html += `<div class="nav-label">${it.label}</div>`; continue; }
      const active = cur === it.href ? ' active' : '';
      let pill = '';
      if (it.href === '#/disposisi' || it.href === '#/peminjaman') {
        pill = `<span class="count-pill" id="nav-pill-${it.href.slice(1)}" style="display:none">0</span>`;
      }
      html += `<a href="${it.href}" class="nav-link${active}">${pill}<i class="fas ${it.ico}"></i>${UI.esc(it.label)}</a>`;
    }
    html += `</div>
      <div class="side-foot">&copy; ${new Date().getFullYear()} Sistem Arsip Kantor Pertanahan<br>Dibuat 100% lokal tanpa biaya.</div>`;
    document.getElementById('sidebar').innerHTML = html;
    this.setHamburger();
  },
  setHamburger() {
    const sb = document.getElementById('sidebar');
    // tambah tombol tutup di sidebar versi mobile
    if (!document.getElementById('side-close')) {
      sb.insertAdjacentHTML('afterbegin', `<div id="side-close" class="bt-menu" style="position:absolute;top:12px;right:12px;color:#fff;background:rgba(255,255,255,.15)" onclick="document.getElementById('sidebar').classList.remove('open')"><i class="fas fa-xmark"></i></div>`);
    }
  },
  renderTopbar() {
    const name = this.user ? this.user.nama_lengkap : '';
    const roleLbl = { admin: 'Administrator', staf: 'Staf', kepala: 'Kepala' }[this.user ? this.user.role : ''] || '';
    document.getElementById('topbar').innerHTML = `
      <button class="btn btn-outline icon-btn bt-menu" id="bt-menu"><i class="fas fa-bars"></i></button>
      <div class="top-title"><h2 id="tb-title"></h2><div class="crumb" id="tb-crumb"></div></div>
      <div class="top-actions">
        <div class="dropdown">
          <button class="icon-btn bell" id="bell-btn" onclick="App.toggleNotif(event)"><i class="fas fa-bell"></i><span class="dot" id="notif-dot" style="display:none">0</span></button>
          <div class="dropdown-menu hidden" id="notif-menu"></div>
        </div>
        <div class="dropdown">
          <div class="avatar" onclick="App.toggleUserMenu(event)">
            <div class="ava">${UI.esc((name || '?').charAt(0).toUpperCase())}</div>
            <div class="who"><b>${UI.esc(name)}</b><span>${UI.esc(roleLbl)}</span></div>
          </div>
          <div class="dropdown-menu hidden" id="user-menu">
            <div class="dm-head"><b>${UI.esc(name)}</b><span>${UI.esc(roleLbl)}</span></div>
            <button onclick="App.openGantiPassword()"><i class="fas fa-key"></i> Ganti Password</button>
            <button onclick="App.logout()"><i class="fas fa-right-from-bracket" style="color:#dc2626"></i> Keluar</button>
          </div>
        </div>
        <div class="top-clock text-muted text-small hidden" id="top-clock" style="text-align:right;white-space:nowrap"></div>
      </div>`;
  },
  toggleNotif(e) {
    e.stopPropagation();
    const m = document.getElementById('notif-menu');
    document.getElementById('user-menu').classList.add('hidden');
    if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    m.innerHTML = '<div class="dm-head"><b>Notifikasi</b></div><div class="text-center text-muted text-small" style="padding:18px"><i class="fas fa-spinner fa-spin"></i></div>';
    API.notif().then((list) => {
      if (!list.length) { m.innerHTML = '<div class="dm-head"><b>Notifikasi</b></div><div class="empty" style="padding:22px"><i class="fas fa-bell-slash"></i><b>Tidak ada notifikasi</b></div>'; return; }
      let h = '<div class="dm-head" style="display:flex;justify-content:space-between;align-items:center"><b>Notifikasi</b><button class="text-small" style="border:none;background:none;color:#0b6e4f;font-weight:600" onclick="App.bacaSemua()">Tandai semua dibaca</button></div>';
      list.forEach((n) => { h += `<div class="notif-item ${n.dibaca ? '' : 'unread'}" onclick="App.bukaNotif(${JSON.stringify(n.link).replace(/"/g, '&quot;')}, ${n.id})"><div class="ni-ic"><i class="fas ${n.jenis === 'disposisi' ? 'fa-right-left' : 'fa-bell'}"></i></div><div class="ni-body"><p>${UI.esc(n.pesan)}</p><small>${UI.relTime(n.created_at)}</small></div></div>`; });
      m.innerHTML = h;
    }).catch(UI.toastError);
  },
  toggleUserMenu(e) {
    e.stopPropagation();
    const m = document.getElementById('user-menu');
    document.getElementById('notif-menu').classList.add('hidden');
    m.classList.toggle('hidden');
  },
  bacaSemua() {
    API.notifBacaSemua().then(() => { this.state.notifBelum = 0; this.refreshBadges(); document.getElementById('notif-menu').classList.add('hidden'); }).catch(UI.toastError);
  },
  bukaNotif(link, id) {
    if (id) API.notifBaca(id).then(() => this.refreshBadges()).catch(() => {});
    document.getElementById('notif-menu').classList.add('hidden');
    const target = location.hash;
    location.hash = link;
    if (target === link) this.route();
  },
  openGantiPassword() {
    document.getElementById('user-menu').classList.add('hidden');
    const body = `
      <form id="pwd-form" onsubmit="return false">
        <div class="form-row"><label>Password Lama</label><input class="field" type="password" id="pwd-lama" required></div>
        <div class="form-row"><label>Password Baru <span class="req">*</span> <span class="text-muted">(min. 6 karakter)</span></label><input class="field" type="password" id="pwd-baru" required minlength="6"></div>
        <div class="form-row"><label>Ulangi Password Baru</label><input class="field" type="password" id="pwd-baru2" required></div>
      </form>`;
    Modal.open({
      title: 'Ganti Password', body,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitGantiPassword()"><i class="fas fa-key"></i> Simpan Password</button>`, lg: false,
    });
    setTimeout(() => document.getElementById('pwd-lama').focus(), 50);
  },
  async submitGantiPassword() {
    const a = document.getElementById('pwd-baru').value, b = document.getElementById('pwd-baru2').value;
    if (a !== b) return UI.toast('Konfirmasi password tidak cocok.', 'error');
    try {
      await API.gantiPassword({ password_lama: document.getElementById('pwd-lama').value, password_baru: a });
      UI.toast('Password berhasil diganti.');
      Modal.close();
    } catch (e) { UI.toastError(e); }
  },
  observeHash() {
    window.addEventListener('hashchange', () => {
      document.getElementById('sidebar').classList.remove('open');
      this.route();
    });
  },
  route() {
    if (!this.user) return;
    const hash = location.hash.replace(/^#/, '') || '/dashboard';
    const cfg = this.routes[hash] || this.routes['/dashboard'];
    if (cfg.role && this.roleOf() !== cfg.role) {
      UI.toast('Anda tidak memiliki hak akses ke halaman ini.', 'error');
      location.hash = '#/dashboard';
      return;
    }
    document.getElementById('tb-title').textContent = cfg.title;
    document.getElementById('tb-crumb').textContent = `${cfg.crumb}`;
    const content = document.getElementById('content');
    content.classList.remove('view-enter');
    void content.offsetWidth;
    content.classList.add('view-enter');
    this.highlightNav(hash);
    Views.go(cfg.view, content);
  },
  highlightNav(hash) {
    document.querySelectorAll('.side-nav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
    });
  },
  renderClock() {
    const el = document.getElementById('top-clock');
    if (!el) return;
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    if (h < 10) h = '0' + h; if (m < 10) m = '0' + m; if (s < 10) s = '0' + s;
    const today = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
    el.textContent = `${today}, ${UI.fmtDate(d.toISOString())} • ${h}:${m}:${s}`;
    el.classList.remove('hidden');
  },

  // ================= MODAL ARSIP =================
  async modalTambahArsip() {
    const [kats, insts, loks, unit] = await Promise.all([API.masterKategori(), API.masterInstansi(), API.masterLokasi(), API.masterUnit()]);
    Modal.open({
      title: 'Tambah Arsip', lg: true,
      body: `
        <form id="arsip-form" onsubmit="return false">
          <div class="form-2col">
            <div class="form-row"><label>Jenis Arsip <span class="req">*</span></label><select class="field" name="jenis" onchange="App.jenisChanged(this.value)">
              <option value="surat-masuk">Surat Masuk</option><option value="surat-keluar">Surat Keluar</option><option value="sertifikat">Sertifikat</option><option value="sk">Surat Keputusan</option><option value="laporan">Laporan</option><option value="lainnya">Lainnya</option></select></div>
            <div class="form-row"><label>Kategori</label><select class="field" name="kategori_id" onchange="App.prevNomor()"><option value="">Tanpa kategori</option>${kats.map((x) => `<option value="${x.id}">${UI.esc(x.kode)} - ${UI.esc(x.nama_kategori)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Tahun Arsip</label><input class="field" type="number" name="tahun_arsip" id="f-tahun" value="${new Date().getFullYear()}" onchange="App.prevNomor()"></div>
            <div class="form-row"><label>Nomor Arsip <span class="req">*</span></label><input class="field" name="nomor_arsip_manual" id="f-nomor" placeholder="otomatis"></div>
            <div class="form-row" style="grid-column:span 2"><label>Judul <span class="req">*</span></label><input class="field" name="judul" required placeholder="Judul / perihal arsip"></div>
            <div class="form-row" style="grid-column:span 2"><label>Perihal (lengkap)</label><input class="field" name="perihal" placeholder="Detail perihal surat"></div>
            <div class="form-row"><label>Tanggal</label><input class="field" type="date" name="tanggal" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="form-row"><label>Status</label><select class="field" name="status"><option value="aktif">Aktif</option><option value="arsip">Arsip</option><option value="dipinjam">Dipinjam</option><option value="hilang">Hilang</option><option value="rusak">Rusak</option></select></div>
            <div class="form-row"><label>Instansi (pengirim/penerima)</label><select class="field" name="instansi_id"><option value="">-</option>${insts.map((x) => `<option value="${x.id}">${UI.esc(x.nama_instansi)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Unit / Bidang</label><select class="field" name="unit_id"><option value="">-</option>${unit.map((x) => `<option value="${x.id}">${UI.esc(x.nama_unit)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Lokasi Penyimpanan</label><select class="field" name="lokasi_id"><option value="">-</option>${loks.map((x) => `<option value="${x.id}">${UI.esc(x.nama_lokasi)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Keterangan</label><textarea class="field" name="keterangan"></textarea></div>
            <div class="form-row" style="grid-column:span 2">
              <label>Lampiran</label>
              <label class="drop-zone" id="drop-zone" ondragover="this.classList.add('drag');event.preventDefault()" ondragleave="this.classList.remove('drag')" ondrop="App.fileDrop(event)"><input type="file" name="file" id="f-file" style="display:none" onchange="App.filePick(this)"><i class="fas fa-cloud-arrow-up"></i><span id="drop-text">Klik atau tarik berkas di sini (PDF, JPG, PNG, DOC, XLS, TXT, ZIP · maks 50MB)</span></label>
            </div>
            <div class="form-row mt-2" style="grid-column:span 2"><label class="flex items-center" style="gap:8px;cursor:pointer"><input type="checkbox" name="auto_agenda" checked> <span>Catat otomatis ke Buku Agenda (untuk Surat Masuk/Keluar)</span></label></div>
          </div>
        </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" id="arsip-save" onclick="App.submitArsip(event)"><i class="fas fa-save"></i> Simpan Arsip</button>`,
      onSave: null, lg: true,
    });
    document.getElementById('f-tahun').addEventListener('input', () => this.prevNomor());
  },
  jenisChanged() { this.prevNomor(); },
  editJenis() {},
  async prevNomor() {
    const tahun = (document.getElementById('f-tahun') || {}).value || new Date().getFullYear();
    const k = (document.getElementById('arsip-form').querySelector('[name=kategori_id]') || {}).value || '';
    const inp = document.getElementById('f-nomor');
    if (!inp) return;
    try {
      const r = await API.arsipPreview(tahun, k);
      inp.placeholder = r.nomor;
    } catch (e) { inp.placeholder = tahun + '/0001'; }
  },
  filePick(inp) {
    if (inp.files[0]) document.getElementById('drop-text').textContent = inp.files[0].name;
    else document.getElementById('drop-text').textContent = 'Tidak ada berkas dipilih';
  },
  fileDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag');
    const files = e.dataTransfer.files;
    if (files.length) { const inp = document.getElementById('f-file'); const dt = new DataTransfer(); dt.items.add(files[0]); inp.files = dt.files; this.filePick(inp); }
  },
  async submitArsip(e, id) {
    if (id == null) {
      const form = document.getElementById('arsip-form');
      const b = new FormData(form);
      if (!b.get('judul')) return UI.toast('Judul wajib diisi.', 'error');
      try {
        const r = await API.arsipCreate(b);
        UI.toast('Arsip berhasil ditambahkan: ' + r.nomor_arsip);
        Modal.close();
        Views.go('arsip', document.getElementById('content'));
      } catch (err) { UI.toastError(err); }
    } else {
      const b = new FormData(document.getElementById('edit-arsip-form'));
      b.set('keep_file', document.getElementById('edit-keep-file').checked ? '1' : '');
      try { await API.arsipUpdate(id, b); UI.toast('Arsip berhasil diperbarui.'); Modal.close(); Views.go('arsip', document.getElementById('content')); } catch (err) { UI.toastError(err); }
    }
  },
  async modalDetail(id) {
    try {
      const a = await API.arsipDetail(id);
      Modal.open({
        title: 'Detail Arsip', lg: true,
        body: `
          <div class="detail-hero"><div class="dh-icon"><i class="fas fa-folder-open"></i></div><div><h2>${UI.esc(a.nomor_arsip)}</h2><div class="sub">${UI.esc(a.judul)}</div></div>${Views.statusBadge(a.status)} <a href="${API.qr(a.id)}" target="_blank" class="icon-btn" title="Unduh QR"><i class="fas fa-qrcode"></i></a></div>
          <div class="grid grid-2">
            <div class="kvp">
              <div class="k">Nomor Arsip</div><div class="v">${UI.esc(a.nomor_arsip)}</div>
              <div class="k">Kategori</div><div class="v">${a.nama_kategori ? UI.esc(a.nama_kategori) + ' (' + UI.esc(a.kode_kategori) + ')' : '-'}</div>
              <div class="k">Jenis</div><div class="v">${a.nama_nilai || Views.jenisBadge(a.jenis)}</div>
              <div class="k">Tanggal</div><div class="v">${a.tanggal ? UI.fmtDate(a.tanggal) : '-'}</div>
              <div class="k">Instansi</div><div class="v">${UI.esc(a.nama_instansi || '-')}</div>
              <div class="k">Unit</div><div class="v">${UI.esc(a.nama_unit || '-')}</div>
              <div class="k">Lokasi</div><div class="v">${UI.esc(a.nama_lokasi || '-')}</div>
              <div class="k">Status</div><div class="v">${Views.statusBadge(a.status)}</div>
              <div class="k">Dibuat</div><div class="v">${UI.fmtDateTime(a.created_at)} oleh ${UI.esc(a.creator || '-')}</div>
            </div>
            <div>
              <div class="kvp"><div class="k">Perihal</div><div class="v">${UI.esc(a.perihal || '-')}</div></div>
              ${a.file_path ? `<div class="mt-3"><a class="btn btn-primary btn-block" href="${API.download(a.id)}"><i class="fas fa-download"></i> Unduh Lampiran</a></div>` : `<div class="text-muted text-small mt-3"><i class="fas fa-circle-info"></i> Tidak ada lampiran</div>`}
              <div class="mt-4"><b class="text-small">Riwayat Disposisi</b>${a.disposisi_list.length ? a.disposisi_list.map((d) => `<div class="flex items-center gap-2 mt-2" style="gap:10px;background:var(--slate-50);padding:8px 12px;border-radius:8px"><i class="fas fa-right-left text-muted"></i><div class="text-small"><b>${UI.esc(d.dari_nama || '')}</b> → <b>${UI.esc(d.ke_nama || '')}</b><div class="text-muted">${UI.esc(d.instruksi || '')}</div></div><span class="badge ${d.status === 'selesai' ? 'badge-green' : d.status === 'ditolak' ? 'badge-red' : 'badge-gold'}">${d.status}</span></div>`).join('') : '<div class="empty" style="padding:18px">Belum ada disposisi</div>'}</div>
            </div>
          </div>`,
        footer: `<button class="btn btn-outline" onclick="Modal.close()">Tutup</button><button class="btn btn-ghost" onclick="App.modalEditArsip(${a.id})"><i class="fas fa-pen"></i> Ubah</button>`,
      });
    } catch (e) { UI.toastError(e); }
  },
  async modalEditArsip(id) {
    const [a, kats, insts, loks, unit] = await Promise.all([API.arsipDetail(id), API.masterKategori(), API.masterInstansi(), API.masterLokasi(), API.masterUnit()]);
    Modal.open({
      title: 'Ubah Arsip', lg: true,
      body: `
        <form id="edit-arsip-form" onsubmit="return false">
          <div class="form-2col">
            <div class="form-row"><label>Jenis</label><select class="field" name="jenis">${['surat-masuk', 'surat-keluar', 'sertifikat', 'sk', 'laporan', 'lainnya'].map((j) => `<option value="${j}" ${a.jenis === j ? 'selected' : ''}>${j == 'surat-masuk' ? 'Surat Masuk' : j == 'surat-keluar' ? 'Surat Keluar' : j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Kategori</label><select class="field" name="kategori_id"><option value="">-</option>${kats.map((x) => `<option value="${x.id}" ${String(a.kategori_id) === String(x.id) ? 'selected' : ''}>${UI.esc(x.kode)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Tahun</label><input class="field" type="number" name="tahun_arsip" value="${a.tahun_arsip || new Date().getFullYear()}"></div>
            <div class="form-row"><label>Nomor Arsip</label><input class="field" name="nomor_arsip_manual" value="${UI.esc(a.nomor_arsip)}"></div>
            <div class="form-row" style="grid-column:span 2"><label>Judul</label><input class="field" name="judul" value="${UI.esc(a.judul)}"></div>
            <div class="form-row" style="grid-column:span 2"><label>Perihal</label><input class="field" name="perihal" value="${UI.esc(a.perihal || '')}"></div>
            <div class="form-row"><label>Tanggal</label><input class="field" type="date" name="tanggal" value="${a.tanggal || ''}"></div>
            <div class="form-row"><label>Status</label><select class="field" name="status">${['aktif', 'arsip', 'dipinjam', 'hilang', 'rusak'].map((s) => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="form-row"><label>Instansi</label><select class="field" name="instansi_id"><option value="">-</option>${insts.map((x) => `<option value="${x.id}" ${String(a.instansi_id) === String(x.id) ? 'selected' : ''}>${UI.esc(x.nama_instansi)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Unit</label><select class="field" name="unit_id"><option value="">-</option>${unit.map((x) => `<option value="${x.id}" ${String(a.unit_id) === String(x.id) ? 'selected' : ''}>${UI.esc(x.nama_unit)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Lokasi</label><select class="field" name="lokasi_id"><option value="">-</option>${loks.map((x) => `<option value="${x.id}" ${String(a.lokasi_id) === String(x.id) ? 'selected' : ''}>${UI.esc(x.nama_lokasi)}</option>`).join('')}</select></div>
            <div class="form-row"><label>Keterangan</label><textarea class="field" name="keterangan">${UI.esc(a.keterangan || '')}</textarea></div>
            <div class="form-row" style="grid-column:span 2"><label class="flex items-center" style="gap:8px"><input type="checkbox" id="edit-keep-file" checked> <span>Pertahankan lampiran yang ada</span></label><label class="drop-zone mt-2"><input type="file" name="file" style="display:none"><i class="fas fa-cloud-arrow-up"></i> Ganti dengan berkas baru</label></div>
          </div>
        </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitArsip(event, ${a.id})"><i class="fas fa-save"></i> Simpan Perubahan</button>`,
    });
  },
  async modalHapus(id, ctx) {
    Modal.open({
      title: 'Konfirmasi Hapus',
      body: `<p>Arsip akan dipindahkan ke <b>Tempat Sampah</b> (dapat dipulihkan). Lanjutkan?</p>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.hapusArsip(${id})"><i class="fas fa-trash-can"></i> Ya, Hapus</button>`,
    });
  },
  async hapusArsip(id) {
    try { await API.arsipSoftDelete(id); UI.toast('Arsip dipindah ke tempat sampah.'); Modal.close(); Views.go('arsip', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  async restoreArsip(id) {
    try { await API.arsipRestore(id); UI.toast('Arsip dipulihkan.'); Views.go('trash', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  async hapusArsipPermanen(id) {
    Modal.open({ title: 'Hapus Permanen', body: '<p>Tindakan ini <b>tidak dapat dibatalkan</b>. Arsip dan lampirannya akan dihapus permanen.</p>', footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.permanenDo(${id})"><i class="fas fa-trash-can"></i> Hapus Permanen</button>` });
  },
  async permanenDo(id) {
    try { await API.arsipPermanen(id); UI.toast('Arsip dihapus permanen.'); Modal.close(); Views.go('trash', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  async hapusSemuaTrash() {
    let rows = []; try { rows = await API.trash(); } catch (e) {}
    if (!rows.length) return UI.toast('Tempat sampah kosong.', 'info');
    Modal.open({ title: 'Kosongkan Tempat Sampah', body: `<p>Menghapus permanen <b>${rows.length}</b> arsip. Tindakan ini tidak dapat dibatalkan.</p>`, footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.permanenSemua()"><i class="fas fa-trash-can"></i> Kosongkan Semua</button>` });
  },
  async permanenSemua() {
    try { const rows = await API.trash(); for (const r of rows) await API.arsipPermanen(r.id).catch(() => {}); UI.toast('Tempat sampah dikosongkan.'); Modal.close(); Views.go('trash', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  async modalQR(id, nomor) {
    Modal.open({ title: 'Kode QR Arsip · ' + nomor, body: `<div class="text-center"><img src="${API.qr(id)}?t=${Date.now()}" style="width:240px;height:240px;image-rendering:pixelated"><p class="text-muted text-small mt-2">${UI.esc(nomor)}</p><p class="text-muted text-small">Cocok untuk penandaan fisik arsip.</p></div>`, footer: `<button class="btn btn-outline" onclick="Modal.close()">Tutup</button><a class="btn btn-primary" href="${API.qr(id)}" download="${nomor}.png"><i class="fas fa-download"></i> Unduh QR</a>` });
  },
  setStatus(id, status) { API.arsipStatus(id, status).then(() => { UI.toast('Status diperbarui.'); Views.go('arsip', document.getElementById('content')); }).catch(UI.toastError); },

  // ================= MODAL DISPOSISI =================
  async modalTambahDisposisi() {
    const [arsips, users] = await Promise.all([API.arsip('limit=100'), API.users().catch(() => [])]);
    const aktifUsers = users.filter((u) => u.status === 1 && String(u.id) !== String(App.user.id));
    Modal.open({
      title: 'Buat Disposisi', lg: true,
      body: `
        <form id="disp-form" onsubmit="return false">
          <div class="form-row"><label>Arsip <span class="req">*</span></label><select class="field" name="arsip_id" required><option value="">Pilih arsip...</option>${arsips.rows.map((a) => `<option value="${a.id}">${UI.esc(a.nomor_arsip)} - ${UI.esc(a.judul)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Ditujukan ke <span class="req">*</span></label><select class="field" name="ke_user_id" required><option value="">Pilih pejabat/petugas...</option>${aktifUsers.map((u) => `<option value="${u.id}">${UI.esc(u.nama_lengkap)} (${UI.esc(u.username)})</option>`).join('')}</select>${!aktifUsers.length ? '<div class="text-danger text-small mt-1">Tidak ada pengguna lain selain Anda.</div>' : ''}</div>
          <div class="form-row"><label>Instruksi</label><input class="field" name="instruksi" placeholder="contoh: Mohon ditindaklanjuti"></div>
          <div class="form-row"><label>Catatan</label><textarea class="field" name="catatan"></textarea></div>
        </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitDisposisi()"><i class="fas fa-right-left"></i> Kirim Disposisi</button>`,
    });
  },
  async submitDisposisi() {
    const f = document.getElementById('disp-form');
    const b = Object.fromEntries(new FormData(f));
    if (!b.arsip_id || !b.ke_user_id) return UI.toast('Arsip dan tujuan wajib diisi.', 'error');
    try { await API.disposisiCreate(b); UI.toast('Disposisi berhasil dikirim.'); Modal.close(); Views.go('disposisi', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  bacaDisposisi(id) { API.disposisiBaca(id).then(() => Views.go('disposisi', document.getElementById('content'))).catch(UI.toastError); },
  statusDisposisi(id, s) { API.disposisiStatus(id, s).then(() => { UI.toast('Status disposisi: ' + s); Views.go('disposisi', document.getElementById('content')); }).catch(UI.toastError); },

  // ================= MODAL PEMINJAMAN =================
  async modalTambahPinjam() {
    const arsips = await API.arsip('limit=100');
    Modal.open({
      title: 'Catat Peminjaman',
      body: `
        <form id="pinjam-form" onsubmit="return false">
          <div class="form-row"><label>Arsip <span class="req">*</span></label><select class="field" name="arsip_id" required><option value="">Pilih arsip...</option>${arsips.rows.map((a) => `<option value="${a.id}">${UI.esc(a.nomor_arsip)} - ${UI.esc(a.judul)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Nama Peminjam <span class="req">*</span></label><input class="field" name="peminjam" required></div>
          <div class="form-2col"><div class="form-row"><label>Unit/Lembaga Peminjam</label><input class="field" name="unit_peminjam"></div><div class="form-row"><label>Tanggal Pinjam</label><input class="field" type="date" name="tanggal_pinjam" value="${new Date().toISOString().slice(0, 10)}"></div></div>
          <div class="form-row"><label>Jatuh Tempo <span class="req">*</span></label><input class="field" type="date" name="jatuh_tempo" value="${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Keterangan</label><textarea class="field" name="keterangan"></textarea></div>
        </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitPinjam()"><i class="fas fa-hand-holding"></i> Catat Pinjaman</button>`,
    });
  },
  async submitPinjam() {
    const b = Object.fromEntries(new FormData(document.getElementById('pinjam-form')));
    if (!b.arsip_id || !b.peminjam || !b.jatuh_tempo) return UI.toast('Arsip, peminjam, dan jatuh tempo wajib.', 'error');
    try { await API.pinjamCreate(b); UI.toast('Peminjaman dicatat.'); Modal.close(); Views.go('peminjaman', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  kembalikanPinjam(id) { API.pinjamKembalikan(id).then(() => { UI.toast('Pengembalian dicatat.'); Views.go('peminjaman', document.getElementById('content')); }).catch(UI.toastError); },
  hapusPinjam(id) { API.pinjamHapus(id).then(() => { UI.toast('Catatan peminjaman dihapus.'); Views.go('peminjaman', document.getElementById('content')); }).catch(UI.toastError); },

  // ================= MODAL KEGIATAN =================
  modalTambahKegiatan(tgl) {
    Modal.open({
      title: 'Tambah Kegiatan',
      body: `
        <form id="keg-form" onsubmit="return false">
          <div class="form-2col">
            <div class="form-row"><label>Tanggal <span class="req">*</span></label><input class="field" type="date" name="tanggal" value="${tgl || new Date().toISOString().slice(0, 10)}" required></div>
            <div class="form-row"><label>Jenis</label><select class="field" name="jenis"><option value="rapat">Rapat</option><option value="verifikasi">Verifikasi</option><option value="pelayanan">Pelayanan</option><option value="sosialisasi">Sosialisasi</option><option value="lainnya">Lainnya</option></select></div>
            <div class="form-row"><label>Jam Mulai</label><input class="field" type="time" name="jam_mulai"></div>
            <div class="form-row"><label>Jam Selesai</label><input class="field" type="time" name="jam_selesai"></div>
          </div>
          <div class="form-row"><label>Judul Kegiatan <span class="req">*</span></label><input class="field" name="judul" required></div>
          <div class="form-row"><label>Lokasi</label><input class="field" name="lokasi"></div>
          <div class="form-row"><label>Keterangan</label><textarea class="field" name="keterangan"></textarea></div>
        </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitKegiatan()"><i class="fas fa-calendar-plus"></i> Simpan</button>`,
    });
  },
  async submitKegiatan(editId) {
    const b = Object.fromEntries(new FormData(document.getElementById('keg-form')));
    if (!b.tanggal || !b.judul) return UI.toast('Tanggal dan judul wajib.', 'error');
    try { editId ? await API.kegiatanUpdate(editId, b) : await API.kegiatanCreate(b); UI.toast('Kegiatan disimpan.'); Modal.close(); Views.go('kalender', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  async modalEditKegiatan(id) {
    const list = await API.kegiatan(); const k2 = list.find((x) => String(x.id) === String(id));
    if (!k2) return UI.toast('Kegiatan tidak ditemukan.', 'error');
    this.openKegiatanModal(k2);
  },
  openKegiatanModal(k2) {
    this.modalTambahKegiatan(k2.tanggal);
    const f = document.getElementById('keg-form');
    f.querySelector('[name=jenis]').value = k2.jenis || 'rapat';
    f.querySelector('[name=jam_mulai]').value = k2.jam_mulai || '';
    f.querySelector('[name=jam_selesai]').value = k2.jam_selesai || '';
    f.querySelector('[name=judul]').value = k2.judul || '';
    f.querySelector('[name=lokasi]').value = k2.lokasi || '';
    f.querySelector('[name=keterangan]').value = k2.keterangan || '';
    document.getElementById('modal-foot').innerHTML = `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.submitKegiatan(${k2.id})"><i class="fas fa-save"></i> Simpan Perubahan</button>`;
  },
  async modalDetailKegiatan(id) {
    const list = await API.kegiatan(); const k2 = list.find((x) => String(x.id) === String(id));
    if (!k2) return;
    Modal.open({ title: 'Detail Kegiatan', body: `<div class="kvp"><div class="k">Tanggal</div><div class="v">${UI.fmtDate(k2.tanggal)}</div><div class="k">Jam</div><div class="v">${UI.esc(k2.jam_mulai || '')}${k2.jam_selesai ? ' - ' + UI.esc(k2.jam_selesai) : ''}</div><div class="k">Kegiatan</div><div class="v">${UI.esc(k2.judul)}</div><div class="k">Jenis</div><div class="v">${UI.esc(k2.jenis)}</div><div class="k">Lokasi</div><div class="v">${UI.esc(k2.lokasi || '-')}</div><div class="k">Keterangan</div><div class="v">${UI.esc(k2.keterangan || '-')}</div><div class="k">Status</div><div class="v">${k2.selesai ? 'Selesai' : 'Terjadwal'}</div></div>`, footer: `<button class="btn btn-outline" onclick="Modal.close()">Tutup</button><button class="btn btn-ghost" onclick="App.modalEditKegiatan(${k2.id})"><i class="fas fa-pen"></i> Ubah</button>` });
  },
  toggleKegiatSelesai(id, s) { API.kegiatanSelesai(id, s).then(() => { UI.toast(s ? 'Ditandai selesai.' : 'Dibuka kembali.'); Views.go('kalender', document.getElementById('content')); }).catch(UI.toastError); },
  hapusKegiatan(id) { Modal.open({ title: 'Hapus Kegiatan', body: '<p>Hapus kegiatan ini?</p>', footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.hapusKegiatanDo(${id})"><i class="fas fa-trash-can"></i> Hapus</button>` }); },
  async hapusKegiatanDo(id) { try { await API.kegiatanDelete(id); UI.toast('Kegiatan dihapus.'); Modal.close(); Views.go('kalender', document.getElementById('content')); } catch (e) { UI.toastError(e); } },

  // ================= MASTER =================
  modalMaster(section, id) {
    if (section === 'kategori') {
      Modal.open({ title: id ? 'Ubah Kategori' : 'Tambah Kategori',
        body: '<form id="mform" onsubmit="return false"><div class="form-row"><label>Kode</label><input class="field" name="kode" required></div><div class="form-row"><label>Nama Kategori</label><input class="field" name="nama_kategori" required></div><div class="form-row"><label>Keterangan</label><textarea class="field" name="keterangan"></textarea></div></form>',
        footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.saveMaster('kategori', ${id ? id : 'null'})"><i class="fas fa-save"></i> Simpan</button>` });
      this.prepMaster('kategori', id);
    } else {
      UI.toast('Gunakan halaman Master Data untuk mengelola ini.', 'info');
    }
  },
  async prepMaster(section, id) {
    if (section !== 'kategori' || !id) return;
    const lists = await API.masterKategori(); const x = lists.find((k) => String(k.id) === String(id));
    if (!x) return;
    const f = document.getElementById('mform');
    f.querySelector('[name=kode]').value = x.kode || '';
    f.querySelector('[name=nama_kategori]').value = x.nama_kategori || '';
    f.querySelector('[name=keterangan]').value = x.keterangan || '';
  },
  async saveMaster(section, id) {
    const b = Object.fromEntries(new FormData(document.getElementById('mform')));
    try {
      id ? await API.masterKategoriUpdate(id, b) : await API.masterKategoriCreate(b);
      UI.toast('Master data disimpan.'); Modal.close(); Views.go('master', document.getElementById('content'));
    } catch (e) { UI.toastError(e); }
  },
  hapusMaster(section, id, label) {
    Modal.open({ title: 'Hapus', body: `<p>Hapus <b>${UI.esc(label)}</b>? Arsip dengan kategori ini akan kehilangan kategorinya.</p>`, footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.hapusMasterDo('${section}', ${id})"><i class="fas fa-trash-can"></i> Hapus</button>` });
  },
  async hapusMasterDo(section, id) {
    try {
      if (section === 'kategori') await API.masterKategoriDelete(id);
      UI.toast('Dihapus.'); Modal.close(); Views.go('master', document.getElementById('content'));
    } catch (e) { UI.toastError(e); if (Modal.el && !Modal.el.classList.contains('hidden')) Views.go('master', document.getElementById('content')); }
  },

  // ================= USERS =================
  async modalUser(id) {
    let u = null;
    if (id) { const rows = await API.users(); u = rows.find((x) => String(x.id) === String(id)); }
    Modal.open({ title: u ? 'Ubah Pengguna' : 'Tambah Pengguna',
      body: `<form id="user-form" onsubmit="return false">
        <div class="text-muted text-small mb-3">${u ? 'Ubah data akun pengguna.' : 'Akun baru akan menggunakan password sementara.'}</div>
        <div class="form-2col">
          <div class="form-row"><label>Username <span class="req">*</span></label><input class="field" name="username" value="${u ? UI.esc(u.username) : ''}" ${u ? 'readonly style="background:#f1f5f9"' : 'required'}></div>
          <div class="form-row"><label>Peran</label><select class="field" name="role"><option value="staf" ${u && u.role === 'staf' ? 'selected' : ''}>Staf</option><option value="kepala" ${u && u.role === 'kepala' ? 'selected' : ''}>Kepala</option><option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
          <div class="form-row" style="grid-column:span 2"><label>Nama Lengkap <span class="req">*</span></label><input class="field" name="nama_lengkap" value="${u ? UI.esc(u.nama_lengkap) : ''}" required></div>
          <div class="form-row"><label>NIP</label><input class="field" name="nip" value="${u ? UI.esc(u.nip || '') : ''}"></div>
          <div class="form-row"><label>Jabatan</label><input class="field" name="jabatan" value="${u ? UI.esc(u.jabatan || '') : ''}"></div>
          <div class="form-row"><label>Status</label><select class="field" name="status"><option value="1" ${!u || u.status === 1 ? 'selected' : ''}>Aktif</option><option value="0" ${u && u.status === 0 ? 'selected' : ''}>Nonaktif</option></select></div>
          <div class="form-row"><label>Password ${u ? '(kosongkan jika tetap)' : '(default: ' + u ? '' : 'password123' + ')'}</label><input class="field" type="password" name="password" ${u ? '' : 'value="password123"'}></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="App.saveUser(${u ? u.id : 'null'})"><i class="fas fa-save"></i> Simpan</button>` });
  },
  async saveUser(id) {
    const b = Object.fromEntries(new FormData(document.getElementById('user-form')));
    if (!b.username || !b.nama_lengkap) return UI.toast('Username dan nama lengkap wajib.', 'error');
    try { id ? await API.userUpdate(id, b) : await API.userCreate(b); UI.toast('Pengguna disimpan.'); Modal.close(); Views.go('pengguna', document.getElementById('content')); } catch (e) { UI.toastError(e); }
  },
  hapusUser(id, uname) { Modal.open({ title: 'Nonaktifkan Pengguna', body: `<p>Hapus akun <b>@${UI.esc(uname)}</b>? Riwayat akan tetap tersimpan.</p>`, footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="App.hapusUserDo(${id})"><i class="fas fa-user-slash"></i> Hapus</button>` }); },
  async hapusUserDo(id) { try { await API.userDelete(id); UI.toast('Pengguna dihapus.'); Modal.close(); Views.go('pengguna', document.getElementById('content')); } catch (e) { UI.toastError(e); } },

  // ================= PROFIL & IMPORT =================
  async saveProfil(e) { e.preventDefault(); const b = Object.fromEntries(new FormData(document.getElementById('prof-form'))); try { await API.pengaturanUpdate(b); UI.toast('Profil kantor disimpan.'); } catch (err) { UI.toastError(err); } },
  async importCSV(e) {
    e && e.preventDefault();
    const inp = e.target.querySelector('input[type=file]');
    const el = e.target;
    Modal.open({ title: 'Import CSV', body: '<div class="text-center" style="padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:26px;color:var(--hijau-600)"></i><p class="mt-2">Memproses berkas...</p></div>', footer: '' });
    const fd = new FormData(); fd.append('file', inp.files[0]);
    try {
      const r = await API.importCsv(fd);
      Modal.close();
      if (r.sukses > 0) UI.toast(`Import selesai: ${r.sukses} berhasil, ${r.gagal} gagal.`);
      else UI.toast('Tidak ada baris berhasil diimpor.', 'error');
      if (r.log && r.log.length) { UI.toast('Sebagian baris gagal: ' + r.log.slice(0, 3).join(' | '), 'error'); }
      Views.go('laporan', document.getElementById('content'));
    } catch (err) { Modal.close(); UI.toastError(err); }
  },
  modalCetak() { Views.modalCetak(); },
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach((m) => m.classList.add('hidden'));
  }
});

window.App = App;
window.Modal = Modal;

document.addEventListener('DOMContentLoaded', () => App.init());