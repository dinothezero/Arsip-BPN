/* Arsip BPN - App Shell, Router, Auth */
const App = (() => {
  let currentRoute = '';
  const NAV = [
    { href: '#/dashboard', icon: 'fa-gauge-high', label: 'Dashboard', roles: 'all' },
    { href: '#/surat-masuk', icon: 'fa-inbox', label: 'Surat Masuk', roles: 'all' },
    { href: '#/surat-keluar', icon: 'fa-paper-plane', label: 'Surat Keluar', roles: 'all' },
    { href: '#/disposisi', icon: 'fa-share-nodes', label: 'Disposisi Surat', roles: 'all' },
    { href: '#/arsip', icon: 'fa-box-archive', label: 'Arsip Dokumen', roles: 'all' },
    { href: '#/sertifikat', icon: 'fa-file-contract', label: 'Sertifikat Tanah', roles: 'all' },
    { href: '#/laporan', icon: 'fa-chart-column', label: 'Laporan', roles: 'all' },
    { href: '#/profil', icon: 'fa-user-circle', label: 'Profil Saya', roles: 'all' }
  ];
  const NAV_ADMIN = [
    { href: '#/logs', icon: 'fa-clock-rotate-left', label: 'Log Aktivitas', roles: ['admin'] },
    { href: '#/pengaturan', icon: 'fa-gear', label: 'Pengaturan', roles: ['admin'] }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function toast(msg, type) {
    const t = document.getElementById('toast');
    t.className = 'fixed bottom-5 right-5 z-[60] px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium text-white ' +
      (type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800');
    t.innerHTML = (type === 'success' ? '<i class="fas fa-check-circle mr-2"></i>' : type === 'error' ? '<i class="fas fa-exclamation-circle mr-2"></i>' : '') + esc(msg);
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function flash(msg, type) {
    const f = document.getElementById('flash-message');
    f.classList.remove('hidden');
    f.className = 'mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ' +
      (type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200');
    f.innerHTML = (type === 'success' ? '<i class="fas fa-check-circle mr-2"></i>' : '<i class="fas fa-exclamation-circle mr-2"></i>') + esc(msg);
    setTimeout(() => f.classList.add('hidden'), 4000);
  }

  function confirmDlg(message, onYes) {
    const modalBox = document.getElementById('modal-box');
    modalBox.innerHTML = `
      <div class="p-6 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <i class="fas fa-triangle-exclamation text-2xl text-amber-500"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-2">Konfirmasi</h3>
        <p class="text-sm text-slate-500 mb-6">${esc(message)}</p>
        <div class="flex justify-center gap-3">
          <button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Batal</button>
          <button id="confirm-yes" class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition">
            <i class="fas fa-trash mr-1.5"></i>Ya, Lanjutkan
          </button>
        </div>
      </div>`;
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('confirm-yes').onclick = () => { App.closeModal(); onYes(); };
  }

  function openModal(html) {
    document.getElementById('modal-box').innerHTML = html;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  function badge(status) {
    const map = {
      'Baru': 'bg-sky-50 text-sky-700 border-sky-200', 'Diproses': 'bg-amber-50 text-amber-700 border-amber-200',
      'Selesai': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Diteruskan': 'bg-violet-50 text-violet-700 border-violet-200',
      'Disetujui': 'bg-blue-50 text-blue-700 border-blue-200', 'Dikirim': 'bg-teal-50 text-teal-700 border-teal-200',
      'Aktif': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Nonaktif': 'bg-slate-100 text-slate-600 border-slate-200',
      'Selesai': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Menunggu': 'bg-slate-100 text-slate-600 border-slate-200',
      'Segera': 'bg-red-50 text-red-700 border-red-200', 'Penting': 'bg-amber-50 text-amber-700 border-amber-200', 'Biasa': 'bg-slate-100 text-slate-600 border-slate-200',
      'Draft': 'bg-slate-100 text-slate-600 border-slate-200'
    };
    const cls = map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}">${esc(status)}</span>`;
  }

  function statCards(items) {
    return items.map(i => `
      <div class="stat-card bg-white rounded-2xl shadow-lg p-5 border-b-4 ${i.border}">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">${i.label}</p>
            <p class="text-2xl font-extrabold text-slate-800 mt-1">${i.value}</p>
            ${i.sub ? `<p class="text-[11px] text-slate-500 mt-1">${i.sub}</p>` : ''}
          </div>
          <div class="w-11 h-11 rounded-xl ${i.bg} flex items-center justify-center">
            <i class="fas ${i.icon} ${i.color}"></i>
          </div>
        </div>
      </div>`).join('');
  }

  function renderSidebar(user) {
    const nav = document.getElementById('sidebar-nav');
    const cur = (location.hash || '#/dashboard').split('?')[0];
    let html = `<div class="px-4 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Menu Utama</div>`;
    NAV.forEach(n => {
      const active = n.href === cur ? ' active' : '';
      html += `<a href="${n.href}" class="nav-link flex items-center gap-3 px-5 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition ${active}">
        <i class="fas ${n.icon} w-5 text-center text-slate-400"></i><span>${n.label}</span></a>`;
    });
    if (user.role === 'admin') {
      html += `<div class="px-4 pt-5 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Administrasi</div>`;
      NAV_ADMIN.forEach(n => {
        const active = n.href === cur ? ' active' : '';
        html += `<a href="${n.href}" class="nav-link flex items-center gap-3 px-5 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition ${active}">
          <i class="fas ${n.icon} w-5 text-center text-slate-400"></i><span>${n.label}</span></a>`;
      });
    }
    nav.innerHTML = html;
  }

  function setHeader(subtitle) {
    document.getElementById('header-flex').textContent = subtitle || fullPath2Title(currentRoute);
    document.getElementById('header-month').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fullPath2Title(p) {
    return p.split('?')[0].replace(/^\//, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function parseRoute(hash) {
    const h = (hash || '').replace(/^#/, '');
    const parts = h.split('?');
    const path = parts[0] || '/dashboard';
    const params = new URLSearchParams(parts[1] || '');
    return { path, params };
  }

  function route() {
    const { path, params } = parseRoute(location.hash);
    currentRoute = path;

    const user = Store.currentUser();
    if (!user) { showLogin(); return; }

    const appShell = document.getElementById('app-shell');
    appShell.classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');

    const seg = path.split('/').filter(Boolean); // e.g. ['surat-masuk'], ['surat-masuk','create']
    renderSidebar(user);

    const routes = Views.routes();
    const key = seg[0];
    const sub = seg[1] || '';
    if (!routes[key]) { render404(); return; }

    const allowed = routes[key].roles;
    if (!allowed.includes('all') && !allowed.includes(user.role)) { render403(); return; }

    const el = document.getElementById('app-content');
    el.classList.remove('view-enter');
    void el.offsetWidth;
    el.classList.add('view-enter');
    const view = routes[key].render({ user, sub, params });

    if (typeof view === 'string') {
      el.innerHTML = view;
      if (routes[key].onload) routes[key].onload({ user, sub, params, el });
    } else if (view && view.then) {
      el.innerHTML = '<div class="flex justify-center py-24"><div class="animate-spin rounded-full h-10 w-10 border-4 border-bpn-500 border-t-transparent"></div></div>';
      view.then(html => { el.innerHTML = html; if (routes[key].onload) routes[key].onload({ user, sub, params, el }); });
    }
  }

  function render404() {
    document.getElementById('app-content').innerHTML = `
      <div class="min-h-[60vh] flex items-center justify-center">
        <div class="text-center">
          <div class="text-7xl text-bpn-400 mb-4"><i class="fas fa-compass"></i></div>
          <h1 class="text-4xl font-bold text-slate-700">404</h1>
          <p class="text-slate-500 mt-2 mb-6">Halaman yang Anda cari tidak ditemukan</p>
          <a href="#/dashboard" class="inline-block px-6 py-3 bg-bpn-600 text-white rounded-xl text-sm font-semibold hover:bg-bpn-700 transition">Kembali ke Dashboard</a>
        </div>
      </div>`;
  }

  function render403() {
    document.getElementById('app-content').innerHTML = `
      <div class="min-h-[60vh] flex items-center justify-center">
        <div class="text-center">
          <div class="text-7xl mb-4" style="color:#fbbf24;"><i class="fas fa-hand"></i></div>
          <h1 class="text-4xl font-bold text-slate-700">403</h1>
          <p class="text-slate-500 mt-2 mb-6">Anda tidak memiliki akses ke halaman ini</p>
          <a href="#/dashboard" class="inline-block px-6 py-3 bg-bpn-600 text-white rounded-xl text-sm font-semibold hover:bg-bpn-700 transition">Kembali ke Dashboard</a>
        </div>
      </div>`;
  }

  function showLogin() {
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('header-flex').textContent = 'Masuk';
  }

  function applyUserChrome(user) {
    document.getElementById('side-avatar').textContent = Store.userInitial(user.nama_lengkap);
    document.getElementById('side-name').textContent = user.nama_lengkap;
    document.getElementById('side-role').innerHTML = `<span class="capitalize">${esc(user.role)}</span> · ${esc(user.jabatan)}`;
    document.getElementById('header-avatar').textContent = Store.userInitial(user.nama_lengkap);
  }

  function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const r = Store.login(username, password);
    if (r.ok) {
      applyUserChrome(r.user);
      location.hash = '#/dashboard';
      route();
    } else {
      document.getElementById('login-error-text').textContent = r.message;
      document.getElementById('login-error').classList.remove('hidden');
    }
  }

  function logout() {
    const u = Store.currentUser();
    if (u) Store.addLog(u.id, 'Logout dari sistem', 'Auth', 'User logout');
    Store.clearSession();
    location.hash = '#/login';
    showLogin();
    toast('Berhasil logout', 'success');
  }

  function togglePassword() {
    const inp = document.getElementById('login-password');
    const icon = document.getElementById('login-eye');
    if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash'; }
    else { inp.type = 'password'; icon.className = 'fas fa-eye'; }
  }

  function money(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

  function init() {
    document.getElementById('login-year').textContent = new Date().getFullYear();
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      const sb = document.getElementById('sidebar');
      if (window.innerWidth < 1024) sb.classList.toggle('-translate-x-full');
    });

    if (!location.hash) location.hash = '#/login';
    window.addEventListener('hashchange', route);
    route();

    setInterval(() => { const u = Store.currentUser(); if (u) applyUserChrome(u); }, 5000);
  }

  return { init, login, logout, togglePassword, route, closeModal, openModal, confirmDlg, toast, flash, esc, badge, statCards, money, showLogin, applyUserChrome };
})();

document.addEventListener('DOMContentLoaded', () => App.init());