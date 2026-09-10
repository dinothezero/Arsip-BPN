'use strict';
/* UI helpers */
const UI = (() => {
  function toast(msg, type = 'success') {
    const wrap = document.getElementById('toast-wrap');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type]} toast-ic"></i><span>${msg}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, type === 'error' ? 5000 : 3200);
  }
  function toastError(e) {
    const msg = (e && e.message) ? e.message : 'Terjadi kesalahan.';
    toast(msg, 'error');
  }
  function fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d.indexOf('T') > -1 ? d : d.replace(' ', 'T'));
    if (isNaN(dt)) return d;
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
  }
  function fmtDateTime(d) {
    if (!d) return '-';
    const dt = new Date(d.indexOf('T') > -1 ? d : d.replace(' ', 'T'));
    if (isNaN(dt)) return d;
    let h = dt.getHours(), m = dt.getMinutes();
    if (h < 10) h = '0' + h;
    if (m < 10) m = '0' + m;
    return `${fmtDate(d)} ${h}:${m}`;
  }
  function fmtNumber(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function relTime(d) {
    if (!d) return '-';
    const dt = new Date(d.indexOf('T') > -1 ? d : d.replace(' ', 'T'));
    const s = Math.floor((Date.now() - dt) / 1000);
    if (s < 60) return 'baru saja';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' menit lalu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    const dd = Math.floor(h / 24);
    if (dd < 30) return dd + ' hari lalu';
    return fmtDate(d);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function badge(text, kind) {
    const cls = {
      green: 'badge-green', teal: 'badge-teal', gold: 'badge-gold', red: 'badge-red', gray: 'badge-gray', blue: 'badge-blue',
    };
    return `<span class="badge ${cls[kind] || 'badge-gray'}">${esc(text)}</span>`;
  }
  function jenisArsip(j) {
    const map = {
      'surat-masuk': ['Surat Masuk', 'fa-file-import', 'badge-teal'],
      'surat-keluar': ['Surat Keluar', 'fa-file-export', 'badge-blue'],
      sertifikat: ['Sertifikat', 'fa-certificate', 'badge-gold'],
      sk: ['Surat Keputusan', 'fa-scroll', 'badge-green'],
      laporan: ['Laporan', 'fa-file-lines', 'badge-gray'],
      lainnya: ['Lainnya', 'fa-folder-open', 'badge-gray'],
    };
    return map[j] || [j || 'Lainnya', 'fa-file-circle-question', 'badge-gray'];
  }
  function statusArsip(s) {
    const map = { aktif: ['Aktif', 'badge-green'], arsip: ['Arsip', 'badge-teal'], dipinjam: ['Dipinjam', 'badge-gold'], hilang: ['Hilang', 'badge-red'], rusak: ['Rusak', 'badge-gold'] };
    const x = map[s] || [s, 'badge-gray'];
    return { text: x[0], cls: x[1] };
  }
  function iconOf(familyFallback) {
    // jika FontAwesome gagal dimuat, gunakan emoji sederhana dari data
    return (elm) => elm;
  }
  return { toast, toastError, fmtDate, fmtDateTime, fmtNumber, relTime, esc, badge, jenisArsip, statusArsip, iconOf };
})();
window.UI = UI;