/* Arsip BPN - Views */
const Views = (() => {
  const d = () => Store.data;
  const { esc, badge, statCards, money, confirmDlg, flash, toast, openModal, closeModal } = App;
  const fmt = Store.fmt;

  const STATUS_MASUK = ['Baru', 'Diproses', 'Diteruskan', 'Selesai'];
  const STATUS_KELUAR = ['Draft', 'Disetujui', 'Dikirim', 'Selesai'];
  const STATUS_ARSIP = ['Aktif', 'Nonaktif'];
  const STATUS_SERTIFIKAT = ['Aktif', 'Pinjam', 'Blokir'];

  const KATEGORI_MASUK = ['Sertifikat & Buku Tanah', 'Peta & Ukur', 'Hak Tanggungan', 'Peralihan & Peningkatan', 'Legalitas Tanah', 'Sengketa & Konflik', 'Koordinasi & Kerjasama', 'Kepegawaian', 'Keuangan', 'Umum'];
  const JENIS_SERTIFIKAT = ['Hak Milik (HM)', 'Hak Guna Bangunan (HGB)', 'Hak Guna Usaha (HGU)', 'Hak Pakai (HP)', 'Hak Pengelolaan (HPL)', 'Wakaf'];
  const SATUAN_LUAS = ['m2', 'ha', 'are'];

  function pageHead(title, sub, actions) {
    return `<div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">${title}</h1>
        <p class="text-slate-500 text-sm mt-1">${sub}</p>
      </div>
      ${actions || ''}
    </div>`;
  }

  function tableCard(title, icon, color, headCols, rowsHtml, footer) {
    return `<div class="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-semibold text-slate-700"><i class="fas ${icon} ${color} mr-2"></i>${title}</h3>
      </div>
      <div class="table-scroll overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            ${headCols.map(c => `<th class="px-4 py-3 text-left font-semibold whitespace-nowrap">${c}</th>`).join('')}
          </tr></thead>
          <tbody class="divide-y divide-slate-100">${rowsHtml || `<tr><td colspan="${headCols.length}" class="px-4 py-10 text-center text-slate-400">Belum ada data</td></tr>`}</tbody>
        </table>
      </div>
      ${footer || ''}
    </div>`;
  }

  function filterBar(html) { return `<div class="bg-white rounded-2xl shadow-lg p-4 mb-6 flex flex-wrap gap-3 items-end">${html}</div>`; }
  function fld(label, input) { return `<div class="flex-1 min-w-[140px]"><label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">${label}</label>${input}</div>`; }

  /* ============ DASHBOARD ============ */
  function viewDashboard() {
    const data = d();
    const sm = data.suratMasuk, sk = data.suratKeluar;
    const stats = [
      { label: 'Surat Masuk', value: sm.length, icon: 'fa-inbox', bg: 'bg-sky-50', color: 'text-sky-600', border: 'border-sky-500' },
      { label: 'Surat Keluar', value: sk.length, icon: 'fa-paper-plane', bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-500' },
      { label: 'Arsip Dokumen', value: data.arsip.length, icon: 'fa-box-archive', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-500' },
      { label: 'Sertifikat Tanah', value: data.sertifikat.length, icon: 'fa-file-contract', bg: 'bg-violet-50', color: 'text-violet-600', border: 'border-violet-500' }
    ];
    const byStatus = {};
    STATUS_MASUK.forEach(s => byStatus[s] = 0);
    sm.forEach(x => byStatus[x.status] = (byStatus[x.status] || 0) + 1);

    let html = pageHead('Dashboard', 'Ringkasan aktivitas arsip kantor pertanahan', '');
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">${statCards(stats)}</div>`;

    html += `<div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <div class="xl:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-chart-line text-bpn-500 mr-2"></i>Grafik Surat 6 Bulan Terakhir</h3>
        <canvas id="chart-surat" height="120"></canvas>
      </div>
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-chart-pie text-bpn-500 mr-2"></i>Status Surat Masuk</h3>
        <div class="space-y-3">`;
    STATUS_MASUK.forEach(s => {
      const total = sm.length || 1;
      const pct = Math.round((byStatus[s] / total) * 100);
      html += `<div>
        <div class="flex justify-between text-xs font-medium text-slate-600 mb-1"><span>${s}</span><span>${byStatus[s]} (${pct}%)</span></div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full ${s === 'Baru' ? 'bg-sky-500' : s === 'Diproses' ? 'bg-amber-500' : s === 'Diteruskan' ? 'bg-violet-500' : 'bg-emerald-500'}" style="width:${pct}%"></div>
        </div>
      </div>`;
    });
    html += `</div></div></div>`;

    html += `<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-700"><i class="fas fa-clock-rotate-left text-bpn-500 mr-2"></i>Aktivitas Terbaru</h3>
          <a href="#/logs" class="text-xs font-semibold text-bpn-600 hover:underline" data-no="1">Lihat Semua</a>
        </div>
        <div class="divide-y divide-slate-100">`;
    (data.log.slice(0, 6)).forEach(l => {
      html += `<div class="py-3 flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-bpn-50 flex items-center justify-center text-xs font-bold text-bpn-600 shrink-0">${Store.userInitial(l.username)}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-700"><b>${esc(l.aktivitas)}</b> <span class="text-slate-400">· ${esc(l.modul)}</span></p>
          <p class="text-xs text-slate-400">${esc(l.detail || '')} · ${fmt(l.created_at, true)}</p>
        </div>
      </div>`;
    });
    html += `</div></div>

      <div class="bg-white rounded-2xl shadow-lg p-6">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-tags text-bpn-500 mr-2"></i>Kategori Paling Banyak</h3>
        <div class="space-y-2.5">`;
    const catCount = {};
    sm.forEach(x => { const k = Store.kategoriName(x.kategori_id); catCount[k] = (catCount[k] || 0) + 1; });
    const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) html += `<p class="text-sm text-slate-400">Belum ada data surat masuk</p>`;
    sorted.slice(0, 6).forEach(([k, v]) => {
      const max = sorted[0][1] || 1;
      html += `<div class="flex items-center gap-3">
        <span class="w-28 truncate text-xs text-slate-600">${esc(k)}</span>
        <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-bpn-500 rounded-full" style="width:${Math.round(v / max * 100)}%"></div></div>
        <span class="text-xs font-semibold text-slate-600 w-6 text-right">${v}</span>
      </div>`;
    });
    html += `</div></div></div>`;
    return html;
  }

  function setupDashboard() {
    const data = d();
    const labels = [], masuk = [], keluar = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - i);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      const label = dt.toLocaleDateString('id-ID', { month: 'short' });
      labels.push(label);
      masuk.push(data.suratMasuk.filter(x => (x.tanggal_diterima || '').startsWith(ym)).length);
      keluar.push(data.suratKeluar.filter(x => (x.tanggal_surat || '').startsWith(ym)).length);
    }
    const c = document.getElementById('chart-surat');
    if (!c) return;
    if (Views._chart) Views._chart.destroy();
    Views._chart = new Chart(c, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Surat Masuk', data: masuk, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#2563eb' },
        { label: 'Surat Keluar', data: keluar, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#f59e0b' }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  /* ============ SURAT MASUK ============ */
  function kategoriOptions(selected, tipe) {
    const list = d().kategori.filter(k => tipe ? k.tipe === tipe || k.tipe === 'semua' : true);
    return list.map(k => `<option value="${k.id}" ${Number(selected) === k.id ? 'selected' : ''}>${esc(k.nama_kategori)}</option>`).join('');
  }

  function smForm(sm) {
    sm = sm || {};
    return `<form onsubmit="Views.saveSuratMasuk(event, ${sm.id || 'null'})">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${[['nomor_surat', 'Nomor Surat', 'text', sm.nomor_surat || '', true],
           ['pengirim', 'Pengirim / Asal Surat', 'text', sm.pengirim || '', true],
           ['tanggal_surat', 'Tanggal Surat', 'date', sm.tanggal_surat || '', true],
           ['tanggal_diterima', 'Tanggal Diterima', 'date', sm.tanggal_diterima || new Date().toISOString().slice(0, 10), true],
           ['perihal', 'Perihal', 'text', sm.perihal || '', true],
           ['keterangan', 'Keterangan', 'text', sm.keterangan || '', false],
           ['lampiran', 'Lampiran', 'text', sm.lampiran || '', false]].map(f => `
          <div class="${f[4] && f[0] === 'perihal' ? 'sm:col-span-2' : ''}">
            <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">${f[1]}${f[4] ? '<span class="text-red-500">*</span>' : ''}</label>
            <input type="${f[2]}" name="${f[0]}" value="${esc(f[3])}" ${f[4] ? 'required' : ''} class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
          </div>`).join('')}
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Kategori</label>
          <select name="kategori_id" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">${kategoriOptions(sm.kategori_id)}</select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Status</label>
          <select name="status" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${STATUS_MASUK.map(s => `<option ${sm.status === s || (!sm.status && s === 'Baru') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Batal</button>
        <button type="submit" class="px-6 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-save mr-1.5"></i>Simpan</button>
      </div>
    </form>`;
  }

  function viewSuratMasuk(ctx) {
    const data = d();
    const q = (ctx.params.get('q') || '').toLowerCase();
    const status = ctx.params.get('status') || '';
    let list = data.suratMasuk.slice().sort((a, b) => b.id - a.id);
    if (q) list = list.filter(x => [x.nomor_surat, x.pengirim, x.perihal].join(' ').toLowerCase().includes(q));
    if (status) list = list.filter(x => x.status === status);

    let html = pageHead('Surat Masuk', 'Registrasi & pengelolaan surat yang diterima kantor',
      `<button onclick="Views.openSuratMasukForm()" class="px-5 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-bpn-600/25"><i class="fas fa-plus mr-1.5"></i>Tambah Surat</button>`);
    html += filterBar(`
      ${fld('Cari', `<div class="relative"><i class="fas fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i><input id="sm-q" value="${esc(q)}" onchange="Views.setSmFilter()" placeholder="Nomor / pengirim / perihal" class="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>`)}
      ${fld('Status', `<select id="sm-status" onchange="Views.setSmFilter()" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none"><option value="">Semua</option>${STATUS_MASUK.map(s => `<option ${status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
      <button onclick="Views.setSmFilter()" class="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"><i class="fas fa-filter mr-1"></i>Terapkan</button>
      <span class="text-xs text-slate-400 self-center">${list.length} data</span>`);

    const rows = list.map(x => `<tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-medium text-slate-800">${esc(x.nomor_surat)}<div class="text-[11px] text-slate-400 font-normal">${esc(Store.kategoriName(x.kategori_id))}</div></td>
      <td class="px-4 py-3 text-slate-600">${esc(x.pengirim)}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.perihal)}</td>
      <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmt(x.tanggal_surat)}</td>
      <td class="px-4 py-3">${badge(x.status)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          <button onclick="Views.smDetail(${x.id})" title="Detail" class="p-2 rounded-lg text-bpn-600 hover:bg-bpn-50 transition"><i class="fas fa-eye text-xs"></i></button>
          <button onclick="Views.openSuratMasukForm(${x.id})" title="Edit" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="Views.openDisposisi(${x.id})" title="Disposisi" class="p-2 rounded-lg text-violet-600 hover:bg-violet-50 transition"><i class="fas fa-share-nodes text-xs"></i></button>
          <button onclick="App.confirmDlg('Hapus surat masuk ini?', () => Views.deleteSuratMasuk(${x.id}))" title="Hapus" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </td></tr>`).join('');

    html += tableCard('Daftar Surat Masuk', 'fa-inbox', 'text-sky-600', ['Nomor Surat', 'Pengirim', 'Perihal', 'Tanggal', 'Status', 'Aksi'], rows);
    return html;
  }

  function setSmFilter() {
    const q = document.getElementById('sm-q').value;
    const status = document.getElementById('sm-status').value;
    location.hash = '#/surat-masuk?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status);
  }

  function openSuratMasukForm(id) {
    const sm = id ? d().suratMasuk.find(x => x.id === id) : null;
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-inbox text-bpn-500 mr-2"></i>${id ? 'Edit Surat Masuk' : 'Tambah Surat Masuk'}</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      ${smForm(sm)}</div>`);
  }

  function saveSuratMasuk(e, id) {
    e.preventDefault();
    const f = new FormData(e.target);
    const pv = Object.fromEntries(f.entries());
    const data = Store.data;
    if (id) {
      const x = data.suratMasuk.find(k => k.id === id);
      Object.assign(x, pv, { updated_at: Date.now() });
      Store.addLog(Store.currentUser().id, 'Edit surat masuk', 'Surat Masuk', `Mengubah surat #${id}`);
    } else {
      data.suratMasuk.push(Object.assign({ id: Store.uid('suratMasuk'), created_at: Date.now(), created_by: Store.currentUser().id }, pv));
      Store.addLog(Store.currentUser().id, 'Tambah surat masuk', 'Surat Masuk', `Menambahkan surat ${pv.nomor_surat}`);
    }
    Store.save(); closeModal(); App.route(); flash('Surat masuk tersimpan', 'success');
  }

  function deleteSuratMasuk(id) {
    const data = Store.data;
    data.suratMasuk = data.suratMasuk.filter(x => x.id !== id);
    data.disposisi = data.disposisi.filter(x => x.surat_masuk_id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus surat masuk', 'Surat Masuk', `Menghapus surat #${id}`);
    Store.save(); App.route(); flash('Surat masuk dihapus', 'success');
  }

  function smDetail(id) {
    const x = d().suratMasuk.find(k => k.id === id);
    if (!x) return;
    const rows = [
      ['Nomor Surat', x.nomor_surat], ['Pengirim', x.pengirim], ['Tanggal Surat', fmt(x.tanggal_surat)],
      ['Tanggal Diterima', fmt(x.tanggal_diterima)], ['Perihal', x.perihal],
      ['Kategori', Store.kategoriName(x.kategori_id)], ['Status', badge(x.status)],
      ['Lampiran', x.lampiran || '-'], ['Keterangan', x.keterangan || '-'], ['Input Oleh', Store.userName(x.created_by)]
    ];
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-inbox text-bpn-500 mr-2"></i>Detail Surat Masuk</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="space-y-3">${rows.map(r => `<div class="flex justify-between gap-6 text-sm py-2.5 border-b border-slate-100"><span class="text-slate-500 shrink-0">${r[0]}</span><span class="text-slate-800 text-right font-medium">${r[1]}</span></div>`).join('')}</div>
      <div class="flex justify-end mt-6"><button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Tutup</button></div>
    </div>`);
  }

  /* ============ DISPOSISI ============ */
  function openDisposisi(smId) {
    const x = d().suratMasuk.find(k => k.id === smId);
    const dps = d().disposisi.filter(x2 => x2.surat_masuk_id === smId);
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-share-nodes text-violet-500 mr-2"></i>Disposisi Surat</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      <p class="text-sm text-slate-500 mb-4">${esc(x.nomor_surat)} — ${esc(x.perihal)}</p>
      <form onsubmit="Views.saveDisposisi(event, ${smId})" class="space-y-3 bg-slate-50 rounded-xl p-4 mb-4">
        <input name="diteruskan_ke" placeholder="Diteruskan ke (seksi/unit)" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" required>
        <input name="catatan" placeholder="Catatan disposisi" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none">
        <select name="prioritas" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none">
          <option>Biasa</option><option>Penting</option><option>Segera</option>
        </select>
        <button type="submit" class="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-paper-plane mr-1.5"></i>Kirim Disposisi</button>
      </form>
      ${dps.length ? `<div class="space-y-2.5">${dps.map(dp => `
        <div class="border border-slate-100 rounded-xl p-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold text-slate-700"><i class="fas fa-user text-xs text-violet-500 mr-1.5"></i>${esc(dp.diteruskan_ke)}</span>${badge(dp.prioritas)}
          </div>
          <p class="text-xs text-slate-500 mb-1.5">${esc(dp.catatan || '-')}</p>
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-slate-400">${fmt(dp.created_at, true)} · ${esc(dp.oleh || '')}</span>
            ${badge(dp.status)}
          </div>
        </div>`).join('')}</div>` : '<p class="text-sm text-slate-400 text-center py-2">Belum ada disposisi</p>'}
    </div>`);
  }

  function saveDisposisi(e, smId) {
    e.preventDefault();
    const f = new FormData(e.target);
    const pv = Object.fromEntries(f.entries());
    const data = Store.data;
    data.disposisi.push(Object.assign({ id: Store.uid('disposisi'), surat_masuk_id: smId, status: 'Menunggu', oleh: Store.currentUser().nama_lengkap, created_at: Date.now() }, pv));
    const sm = data.suratMasuk.find(x => x.id === smId);
    if (sm) sm.status = 'Diteruskan';
    Store.addLog(Store.currentUser().id, 'Disposisi surat', 'Surat Masuk', `Disposisi ke ${pv.diteruskan_ke}`);
    Store.save(); closeModal(); App.route(); flash('Disposisi terkirim', 'success');
  }

  /* ============ SURAT KELUAR ============ */
  function skForm(sk) {
    sk = sk || {};
    return `<form onsubmit="Views.saveSuratKeluar(event, ${sk.id || 'null'})">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${[['nomor_surat', 'Nomor Surat', 'text', sk.nomor_surat || '', true],
           ['tujuan', 'Ditujukan Kepada', 'text', sk.tujuan || '', true],
           ['tanggal_surat', 'Tanggal Surat', 'date', sk.tanggal_surat || new Date().toISOString().slice(0, 10), true],
           ['perihal', 'Perihal', 'text', sk.perihal || '', true],
           ['keterangan', 'Keterangan', 'text', sk.keterangan || '', false],
           ['lampiran', 'Lampiran', 'text', sk.lampiran || '', false]].map(f => `
          <div class="${f[4] && f[0] === 'perihal' ? 'sm:col-span-2' : ''}">
            <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">${f[1]}${f[4] ? '<span class="text-red-500">*</span>' : ''}</label>
            <input type="${f[2]}" name="${f[0]}" value="${esc(f[3])}" ${f[4] ? 'required' : ''} class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
          </div>`).join('')}
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Kategori</label>
          <select name="kategori_id" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">${kategoriOptions(sk.kategori_id)}</select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Status</label>
          <select name="status" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${STATUS_KELUAR.map(s => `<option ${sk.status === s || (!sk.status && s === 'Draft') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Batal</button>
        <button type="submit" class="px-6 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-save mr-1.5"></i>Simpan</button>
      </div>
    </form>`;
  }

  function viewSuratKeluar(ctx) {
    const data = d();
    const q = (ctx.params.get('q') || '').toLowerCase();
    const status = ctx.params.get('status') || '';
    let list = data.suratKeluar.slice().sort((a, b) => b.id - a.id);
    if (q) list = list.filter(x => [x.nomor_surat, x.tujuan, x.perihal].join(' ').toLowerCase().includes(q));
    if (status) list = list.filter(x => x.status === status);

    let html = pageHead('Surat Keluar', 'Registrasi & pengelolaan surat yang dikirim kantor',
      `<button onclick="Views.openSuratKeluarForm()" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-amber-600/25"><i class="fas fa-plus mr-1.5"></i>Tambah Surat</button>`);
    html += filterBar(`
      ${fld('Cari', `<div class="relative"><i class="fas fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i><input id="sk-q" value="${esc(q)}" placeholder="Nomor / tujuan / perihal" class="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>`)}
      ${fld('Status', `<select id="sk-status" onchange="Views.setSkStatus()" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none"><option value="">Semua</option>${STATUS_KELUAR.map(s => `<option ${status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
      <button onclick="Views.setSkStatus()" class="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"><i class="fas fa-filter mr-1"></i>Terapkan</button>
      <span class="text-xs text-slate-400 self-center">${list.length} data</span>`);

    const rows = list.map(x => `<tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-medium text-slate-800">${esc(x.nomor_surat)}<div class="text-[11px] text-slate-400 font-normal">${esc(Store.kategoriName(x.kategori_id))}</div></td>
      <td class="px-4 py-3 text-slate-600">${esc(x.tujuan)}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.perihal)}</td>
      <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmt(x.tanggal_surat)}</td>
      <td class="px-4 py-3">${badge(x.status)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          <button onclick="Views.skDetail(${x.id})" title="Detail" class="p-2 rounded-lg text-bpn-600 hover:bg-bpn-50 transition"><i class="fas fa-eye text-xs"></i></button>
          <button onclick="Views.openSuratKeluarForm(${x.id})" title="Edit" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="Views.advanceSuratKeluar(${x.id})" title="Perbarui Status" class="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"><i class="fas fa-arrow-right-arrow-left text-xs"></i></button>
          <button onclick="App.confirmDlg('Hapus surat keluar ini?', () => Views.deleteSuratKeluar(${x.id}))" title="Hapus" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </td></tr>`).join('');

    html += tableCard('Daftar Surat Keluar', 'fa-paper-plane', 'text-amber-600', ['Nomor Surat', 'Tujuan', 'Perihal', 'Tanggal', 'Status', 'Aksi'], rows);
    return html;
  }

  function setSkStatus() {
    const q = (document.getElementById('sk-q') || {}).value || '';
    const status = document.getElementById('sk-status').value;
    location.hash = '#/surat-keluar?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status);
  }

  function openSuratKeluarForm(id) {
    const sk = id ? d().suratKeluar.find(x => x.id === id) : null;
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-paper-plane text-amber-600 mr-2"></i>${id ? 'Edit Surat Keluar' : 'Tambah Surat Keluar'}</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>${skForm(sk)}</div>`);
  }

  function saveSuratKeluar(e, id) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const data = Store.data;
    if (id) {
      Object.assign(data.suratKeluar.find(x => x.id === id), pv, { updated_at: Date.now() });
      Store.addLog(Store.currentUser().id, 'Edit surat keluar', 'Surat Keluar', `Mengubah surat #${id}`);
    } else {
      data.suratKeluar.push(Object.assign({ id: Store.uid('suratKeluar'), created_at: Date.now(), created_by: Store.currentUser().id }, pv));
      Store.addLog(Store.currentUser().id, 'Tambah surat keluar', 'Surat Keluar', `Menambahkan surat ${pv.nomor_surat}`);
    }
    Store.save(); closeModal(); App.route(); flash('Surat keluar tersimpan', 'success');
  }

  function deleteSuratKeluar(id) {
    const data = Store.data;
    data.suratKeluar = data.suratKeluar.filter(x => x.id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus surat keluar', 'Surat Keluar', `Menghapus surat #${id}`);
    Store.save(); App.route(); flash('Surat keluar dihapus', 'success');
  }

  function advanceSuratKeluar(id) {
    const sk = d().suratKeluar.find(x => x.id === id);
    if (!sk) return;
    const next = { Draft: 'Disetujui', Disetujui: 'Dikirim', Dikirim: 'Selesai' }[sk.status];
    if (!next) { toast('Surat sudah berstatus Selesai', 'error'); return; }
    confirmDlg(`Perbarui surat "${sk.nomor_surat}" dari <b>${sk.status}</b> menjadi <b>${next}</b>?`, () => {
      sk.status = next;
      Store.addLog(Store.currentUser().id, 'Update status surat keluar', 'Surat Keluar', `${sk.nomor_surat} → ${next}`);
      Store.save(); App.route(); flash(`Status menjadi ${next}`, 'success');
    });
  }

  function skDetail(id) {
    const x = d().suratKeluar.find(k => k.id === id);
    if (!x) return;
    const rows = [
      ['Nomor Surat', x.nomor_surat], ['Ditujukan Kepada', x.tujuan], ['Tanggal Surat', fmt(x.tanggal_surat)],
      ['Perihal', x.perihal], ['Kategori', Store.kategoriName(x.kategori_id)], ['Status', badge(x.status)],
      ['Lampiran', x.lampiran || '-'], ['Keterangan', x.keterangan || '-'], ['Input Oleh', Store.userName(x.created_by)]
    ];
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-paper-plane text-amber-600 mr-2"></i>Detail Surat Keluar</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="space-y-3">${rows.map(r => `<div class="flex justify-between gap-6 text-sm py-2.5 border-b border-slate-100"><span class="text-slate-500 shrink-0">${r[0]}</span><span class="text-slate-800 text-right font-medium">${r[1]}</span></div>`).join('')}</div>
      <div class="flex justify-end mt-6"><button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Tutup</button></div>
    </div>`);
  }

  /* ============ ARSIP ============ */
  function arsipForm(ar) {
    ar = ar || {};
    return `<form onsubmit="Views.saveArsip(event, ${ar.id || 'null'})">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${[['kode_arsip', 'Kode Arsip', 'text', ar.kode_arsip || '', true],
           ['judul', 'Judul Dokumen', 'text', ar.judul || '', true],
           ['deskripsi', 'Deskripsi', 'text', ar.deskripsi || '', false],
           ['tahun', 'Tahun', 'text', ar.tahun || new Date().getFullYear(), true],
           ['lokasi_rak', 'Lokasi Rak/Box', 'text', ar.lokasi_rak || '', false]].map(f => `
          <div class="${f[4] && f[0] === 'judul' ? 'sm:col-span-2' : ''}">
            <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">${f[1]}${f[4] ? '<span class="text-red-500">*</span>' : ''}</label>
            <input type="${f[2]}" name="${f[0]}" value="${esc(f[3])}" ${f[4] ? 'required' : ''} class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
          </div>`).join('')}
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Kategori</label>
          <select name="kategori" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${KATEGORI_MASUK.map(k => `<option ${ar.kategori === k ? 'selected' : ''}>${k}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Status</label>
          <select name="status" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${STATUS_ARSIP.map(s => `<option ${ar.status === s || (!ar.status && s === 'Aktif') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Batal</button>
        <button type="submit" class="px-6 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-save mr-1.5"></i>Simpan</button>
      </div>
    </form>`;
  }

  function viewArsip(ctx) {
    const data = d();
    const q = (ctx.params.get('q') || '').toLowerCase();
    let list = data.arsip.slice().sort((a, b) => b.id - a.id);
    if (q) list = list.filter(x => [x.kode_arsip, x.judul, x.kategori, x.deskripsi].join(' ').toLowerCase().includes(q));

    let html = pageHead('Arsip Dokumen', 'Pengelolaan arsip dokumen kantor',
      `<button onclick="Views.openArsipForm()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-600/25"><i class="fas fa-plus mr-1.5"></i>Tambah Arsip</button>`);
    html += filterBar(`
      ${fld('Cari', `<div class="relative"><i class="fas fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i><input id="ar-q" value="${esc(q)}" placeholder="Kode / judul / kategori" onchange="Views.setArsipFilter()" class="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>`)}
      <span class="text-xs text-slate-400 self-center">${list.length} data</span>`);

    const rows = list.map(x => `<tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-mono font-semibold text-bpn-700">${esc(x.kode_arsip)}</td>
      <td class="px-4 py-3 text-slate-700 font-medium">${esc(x.judul)}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.kategori)}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.tahun || '-')}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.lokasi_rak || '-')}</td>
      <td class="px-4 py-3">${badge(x.status)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          <button onclick="Views.arDetail(${x.id})" title="Detail" class="p-2 rounded-lg text-bpn-600 hover:bg-bpn-50 transition"><i class="fas fa-eye text-xs"></i></button>
          <button onclick="Views.openArsipForm(${x.id})" title="Edit" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="App.confirmDlg('Hapus arsip ini?', () => Views.deleteArsip(${x.id}))" title="Hapus" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </td></tr>`).join('');

    html += tableCard('Daftar Arsip Dokumen', 'fa-box-archive', 'text-emerald-600', ['Kode', 'Judul', 'Kategori', 'Tahun', 'Lokasi', 'Status', 'Aksi'], rows);
    return html;
  }

  function openArsipForm(id) {
    const ar = id ? d().arsip.find(x => x.id === id) : null;
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-box-archive text-emerald-600 mr-2"></i>${id ? 'Edit Arsip' : 'Tambah Arsip'}</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>${arsipForm(ar)}</div>`);
  }

  function saveArsip(e, id) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const data = Store.data;
    if (id) { Object.assign(data.arsip.find(x => x.id === id), pv, { updated_at: Date.now() }); Store.addLog(Store.currentUser().id, 'Edit arsip', 'Arsip', `Mengubah arsip #${id}`); }
    else { data.arsip.push(Object.assign({ id: Store.uid('arsip'), created_at: Date.now(), created_by: Store.currentUser().id }, pv)); Store.addLog(Store.currentUser().id, 'Tambah arsip', 'Arsip', `Menambahkan ${pv.kode_arsip}`); }
    Store.save(); closeModal(); App.route(); flash('Arsip tersimpan', 'success');
  }

  function deleteArsip(id) {
    const data = Store.data;
    data.arsip = data.arsip.filter(x => x.id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus arsip', 'Arsip', `Menghapus arsip #${id}`);
    Store.save(); App.route(); flash('Arsip dihapus', 'success');
  }

  function arDetail(id) {
    const x = d().arsip.find(k => k.id === id);
    if (!x) return;
    const rows = [
      ['Kode Arsip', x.kode_arsip], ['Judul', x.judul], ['Kategori', x.kategori], ['Tahun', x.tahun || '-'],
      ['Lokasi Rak/Box', x.lokasi_rak || '-'], ['Status', badge(x.status)], ['Deskripsi', x.deskripsi || '-'], ['Input Oleh', Store.userName(x.created_by)]
    ];
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-box-archive text-emerald-600 mr-2"></i>Detail Arsip</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="space-y-3">${rows.map(r => `<div class="flex justify-between gap-6 text-sm py-2.5 border-b border-slate-100"><span class="text-slate-500 shrink-0">${r[0]}</span><span class="text-slate-800 text-right font-medium">${r[1]}</span></div>`).join('')}</div>
      <div class="flex justify-end mt-6"><button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Tutup</button></div>
    </div>`);
  }

  /* ============ SERTIFIKAT ============ */
  function sertForm(sr) {
    sr = sr || {};
    return `<form onsubmit="Views.saveSertifikat(event, ${sr.id || 'null'})">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${[['nomor_sertifikat', 'Nomor Sertifikat', 'text', sr.nomor_sertifikat || '', true],
           ['nama_pemilik', 'Nama Pemilik', 'text', sr.nama_pemilik || '', true],
           ['letak_tanah', 'Letak Tanah', 'text', sr.letak_tanah || '', false],
           ['nik', 'NIK Pemilik', 'text', sr.nik || '', false],
           ['letter_c', 'Letter C', 'text', sr.letter_c || '', false],
           ['alas_hak', 'Alas Hak', 'text', sr.alas_hak || '', false]].map(f => `
          <div class="${f[4] && f[0] === 'nama_pemilik' ? 'sm:col-span-2' : ''}">
            <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">${f[1]}${f[4] ? '<span class="text-red-500">*</span>' : ''}</label>
            <input type="${f[2]}" name="${f[0]}" value="${esc(f[3])}" ${f[4] ? 'required' : ''} class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
          </div>`).join('')}
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Jenis Sertifikat</label>
          <select name="jenis_sertifikat" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${JENIS_SERTIFIKAT.map(j => `<option ${sr.jenis_sertifikat === j ? 'selected' : ''}>${j}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Status Sertifikat</label>
          <select name="status_sertifikat" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
            ${STATUS_SERTIFIKAT.map(s => `<option ${sr.status_sertifikat === s || (!sr.status_sertifikat && s === 'Aktif') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Luas Tanah</label>
          <div class="flex gap-2">
            <input type="number" step="0.01" name="luas_tanah" value="${esc(sr.luas_tanah || '')}" placeholder="0.00" class="flex-1 w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
            <select name="satuan_luas" class="w-24 px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">
              ${SATUAN_LUAS.map(s => `<option ${sr.satuan_luas === s || (!sr.satuan_luas && s === 'm2') ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Keterangan</label>
          <input type="text" name="keterangan" value="${esc(sr.keterangan || '')}" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Batal</button>
        <button type="submit" class="px-6 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-save mr-1.5"></i>Simpan</button>
      </div>
    </form>`;
  }

  function viewSertifikat(ctx) {
    const data = d();
    const q = (ctx.params.get('q') || '').toLowerCase();
    let list = data.sertifikat.slice().sort((a, b) => b.id - a.id);
    if (q) list = list.filter(x => [x.nomor_sertifikat, x.nama_pemilik, x.letak_tanah].join(' ').toLowerCase().includes(q));

    let html = pageHead('Sertifikat Tanah', 'Data sertifikat hak atas tanah yang dikelola',
      `<button onclick="Views.openSertifikatForm()" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-violet-600/25"><i class="fas fa-plus mr-1.5"></i>Tambah Sertifikat</button>`);
    html += filterBar(`
      ${fld('Cari', `<div class="relative"><i class="fas fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i><input id="sr-q" value="${esc(q)}" placeholder="Nomor / pemilik / letak" onchange="Views.setSertiFilter()" class="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>`)}
      <span class="text-xs text-slate-400 self-center">${list.length} data</span>`);

    const rows = list.map(x => `<tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-mono font-semibold text-bpn-700 whitespace-nowrap">${esc(x.nomor_sertifikat)}</td>
      <td class="px-4 py-3 text-slate-700 font-medium">${esc(x.nama_pemilik)}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.jenis_sertifikat)}</td>
      <td class="px-4 py-3 text-slate-600">${Number(x.luas_tanah || 0).toLocaleString('id-ID')} ${esc(x.satuan_luas || 'm2')}</td>
      <td class="px-4 py-3 text-slate-600">${esc(x.letak_tanah || '-')}</td>
      <td class="px-4 py-3">${badge(x.status_sertifikat)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          <button onclick="Views.sertDetail(${x.id})" title="Detail" class="p-2 rounded-lg text-bpn-600 hover:bg-bpn-50 transition"><i class="fas fa-eye text-xs"></i></button>
          <button onclick="Views.openSertifikatForm(${x.id})" title="Edit" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="App.confirmDlg('Hapus sertifikat ini?', () => Views.deleteSertifikat(${x.id}))" title="Hapus" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </td></tr>`).join('');

    html += tableCard('Daftar Sertifikat Tanah', 'fa-file-contract', 'text-violet-600', ['Nomor', 'Pemilik', 'Jenis', 'Luas', 'Letak', 'Status', 'Aksi'], rows);
    return html;
  }

  function openSertifikatForm(id) {
    const sr = id ? d().sertifikat.find(x => x.id === id) : null;
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-file-contract text-violet-600 mr-2"></i>${id ? 'Edit Sertifikat' : 'Tambah Sertifikat'}</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>${sertForm(sr)}</div>`);
  }

  function saveSertifikat(e, id) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const data = Store.data;
    if (id) { Object.assign(data.sertifikat.find(x => x.id === id), pv, { updated_at: Date.now() }); Store.addLog(Store.currentUser().id, 'Edit sertifikat', 'Sertifikat', `Mengubah sertifikat #${id}`); }
    else { data.sertifikat.push(Object.assign({ id: Store.uid('sertifikat'), created_at: Date.now(), created_by: Store.currentUser().id }, pv)); Store.addLog(Store.currentUser().id, 'Tambah sertifikat', 'Sertifikat', `Menambahkan ${pv.nomor_sertifikat}`); }
    Store.save(); closeModal(); App.route(); flash('Sertifikat tersimpan', 'success');
  }

  function deleteSertifikat(id) {
    const data = Store.data;
    data.sertifikat = data.sertifikat.filter(x => x.id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus sertifikat', 'Sertifikat', `Menghapus sertifikat #${id}`);
    Store.save(); App.route(); flash('Sertifikat dihapus', 'success');
  }

  function sertDetail(id) {
    const x = d().sertifikat.find(k => k.id === id);
    if (!x) return;
    const rows = [
      ['Nomor Sertifikat', x.nomor_sertifikat], ['Jenis', x.jenis_sertifikat], ['Pemilik', x.nama_pemilik],
      ['NIK', x.nik || '-'], ['Letak Tanah', x.letak_tanah || '-'], ['Luas', (Number(x.luas_tanah || 0).toLocaleString('id-ID')) + ' ' + (x.satuan_luas || 'm2')],
      ['Letter C', x.letter_c || '-'], ['Alas Hak', x.alas_hak || '-'], ['Status', badge(x.status_sertifikat)],
      ['Keterangan', x.keterangan || '-'], ['Input Oleh', Store.userName(x.created_by)]
    ];
    openModal(`<div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-800"><i class="fas fa-file-contract text-violet-600 mr-2"></i>Detail Sertifikat</h3>
        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="space-y-3">${rows.map(r => `<div class="flex justify-between gap-6 text-sm py-2.5 border-b border-slate-100"><span class="text-slate-500 shrink-0">${r[0]}</span><span class="text-slate-800 text-right font-medium">${r[1]}</span></div>`).join('')}</div>
      <div class="flex justify-end mt-6"><button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Tutup</button></div>
    </div>`);
  }

  /* ============ DISPOSISI LIST ============ */
  function viewDisposisi() {
    const data = d();
    const list = data.disposisi.slice().sort((a, b) => b.id - a.id);
    let html = pageHead('Disposisi Surat', 'Daftar penerusan surat ke seksi/unit');

    const rows = list.map(x => {
      const sm = data.suratMasuk.find(s => s.id === x.surat_masuk_id);
      return `<tr class="hover:bg-slate-50 transition">
        <td class="px-4 py-3 font-medium text-slate-800">${sm ? esc(sm.nomor_surat) : '#' + x.surat_masuk_id}</td>
        <td class="px-4 py-3 text-slate-600">${sm ? esc(sm.perihal) : '-'}</td>
        <td class="px-4 py-3 text-slate-700"><i class="fas fa-user text-xs text-violet-500 mr-1.5"></i>${esc(x.diteruskan_ke)}</td>
        <td class="px-4 py-3 text-slate-600">${esc(x.catatan || '-')}</td>
        <td class="px-4 py-3">${badge(x.prioritas)}</td>
        <td class="px-4 py-3">${badge(x.status)}</td>
        <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">${fmt(x.created_at, true)}</td>
        <td class="px-4 py-3">
          <button onclick="Views.updateDisposisiStatus(${x.id})" title="Ubah Status" class="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"><i class="fas fa-arrow-right-arrow-left text-xs"></i></button>
        </td></tr>`;
    }).join('');

    html += tableCard('Daftar Disposisi', 'fa-share-nodes', 'text-violet-600', ['Nomor Surat', 'Perihal', 'Diteruskan Ke', 'Catatan', 'Prioritas', 'Status', 'Waktu', 'Aksi'], rows);
    return html;
  }

  function updateDisposisiStatus(id) {
    const x = d().disposisi.find(k => k.id === id);
    const next = { Menunggu: 'Diproses', Diproses: 'Selesai' }[x.status];
    if (!next) { toast('Disposisi sudah Selesai', 'error'); return; }
    confirmDlg(`Perbarui status disposisi ke ${next}?`, () => {
      x.status = next;
      Store.addLog(Store.currentUser().id, 'Update status disposisi', 'Disposisi', `#${id} → ${next}`);
      Store.save(); App.route(); flash(`Status menjadi ${next}`, 'success');
    });
  }

  /* ============ LAPORAN ============ */
  function viewLaporan(ctx) {
    const jenis = ctx.params.get('jenis') || 'rekap';
    const dari = ctx.params.get('dari') || (new Date().getFullYear() + '-01-01');
    const sampai = ctx.params.get('sampai') || (new Date().getFullYear() + '-12-31');
    const data = d();

    const inRange = ts => ts && ts >= dari && ts <= sampai;
    const dariY = parseInt(dari, 10) || 0;
    const sampaiY = parseInt(sampai, 10) || 9999;
    const sm = data.suratMasuk.filter(x => inRange(x.tanggal_surat));
    const sk = data.suratKeluar.filter(x => inRange(x.tanggal_surat));
    const sr = data.sertifikat.filter(x => inRange(new Date(x.created_at || Date.now()).toISOString().slice(0, 10)));
    const ar = data.arsip.filter(x => x.tahun && +x.tahun >= dariY && +x.tahun <= sampaiY);

    const jenisBtn = (j, label) => `<button onclick="location.hash='#/laporan?jenis=${j}&dari=${dari}&sampai=${sampai}'" class="px-4 py-2 rounded-xl text-sm font-medium transition ${jenis === j ? 'bg-bpn-600 text-white shadow-lg shadow-bpn-600/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">${label}</button>`;

    let html = pageHead('Laporan', 'Rekap dan laporan arsip kantor',
      `<button onclick="window.print()" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-slate-800/20 no-print"><i class="fas fa-print mr-1.5"></i>Cetak</button>`);

    html += `<div class="flex flex-wrap gap-2 mb-4 no-print">${jenisBtn('rekap', 'Rekap Tahunan')}${jenisBtn('surat-masuk', 'Surat Masuk')}${jenisBtn('surat-keluar', 'Surat Keluar')}${jenisBtn('sertifikat', 'Sertifikat')}${jenisBtn('arsip', 'Arsip')}</div>`;

    html += `<div class="bg-white rounded-2xl shadow-lg p-5 mb-6 no-print">
      <form onsubmit="return false">
        <div class="flex flex-wrap gap-3 items-end">
          ${fld('Dari', `<input id="lp-dari" type="date" value="${dari}" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">`)}
          ${fld('Sampai', `<input id="lp-sampai" type="date" value="${sampai}" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none">`)}
          <button onclick="location.hash='#/laporan?jenis=${jenis}&dari='+document.getElementById('lp-dari').value+'&sampai='+document.getElementById('lp-sampai').value" class="px-5 py-2.5 text-sm font-semibold text-bpn-700 bg-bpn-50 border border-bpn-200 rounded-xl hover:bg-bpn-100 transition"><i class="fas fa-filter mr-1"></i>Terapkan</button>
        </div>
      </form>
    </div>`;

    const kop = `<div class="text-center mb-6">
      <h2 class="text-2xl font-extrabold text-slate-800">${esc(data.pengaturan.nama_kantor)}</h2>
      <p class="text-sm text-slate-500">${esc(data.pengaturan.alamat_kantor)}</p>
      <h3 class="text-lg font-bold text-slate-700 mt-4 underline decoration-2 underline-offset-4">LAPORAN ${jenis === 'rekap' ? 'REKAP TAHUNAN' : jenis.toUpperCase().replace('-', ' ')}</h3>
      <p class="text-xs text-slate-400 mt-1">Periode: ${fmt(dari)} — ${fmt(sampai)}</p>
      <hr class="border-slate-300 border-t-2 my-4">
    </div>`;

    html += `<div id="print-area" class="hidden print-block">${kop}</div>`;

    if (jenis === 'rekap') {
      html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${
        [['fa-inbox', 'Surat Masuk', sm.length, 'text-sky-600 bg-sky-50'], ['fa-paper-plane', 'Surat Keluar', sk.length, 'text-amber-600 bg-amber-50'],
         ['fa-file-contract', 'Sertifikat', sr.length, 'text-violet-600 bg-violet-50'], ['fa-box-archive', 'Arsip', ar.length, 'text-emerald-600 bg-emerald-50']].map(c =>
        `<div class="bg-white rounded-2xl shadow-lg p-5 text-center">
          <div class="w-12 h-12 mx-auto rounded-xl ${c[3]} flex items-center justify-center mb-3"><i class="fas ${c[0]}"></i></div>
          <p class="text-3xl font-extrabold text-slate-800">${c[2]}</p>
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">${c[1]}</p>
        </div>`).join('')}</div>`;

      html += `<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">`;
      html += tableCard('Rekap Surat Masuk', 'fa-inbox', 'text-sky-600', ['Nomor', 'Perihal', 'Pengirim', 'Tanggal'],
        sm.slice().sort((a, b) => a.tanggal_surat < b.tanggal_surat ? 1 : -1).map(x => `<tr><td class="px-4 py-2.5">${esc(x.nomor_surat)}</td><td class="px-4 py-2.5">${esc(x.perihal)}</td><td class="px-4 py-2.5">${esc(x.pengirim)}</td><td class="px-4 py-2.5">${fmt(x.tanggal_surat)}</td></tr>`).join(''));
      html += tableCard('Rekap Surat Keluar', 'fa-paper-plane', 'text-amber-600', ['Nomor', 'Perihal', 'Tujuan', 'Tanggal'],
        sk.slice().sort((a, b) => a.tanggal_surat < b.tanggal_surat ? 1 : -1).map(x => `<tr><td class="px-4 py-2.5">${esc(x.nomor_surat)}</td><td class="px-4 py-2.5">${esc(x.perihal)}</td><td class="px-4 py-2.5">${esc(x.tujuan)}</td><td class="px-4 py-2.5">${fmt(x.tanggal_surat)}</td></tr>`).join(''));
      html += `</div>`;
    } else if (jenis === 'surat-masuk') {
      html += tableCard('Laporan Surat Masuk', 'fa-inbox', 'text-sky-600', ['No', 'Nomor', 'Perihal', 'Pengirim', 'Kategori', 'Tanggal', 'Status'],
        sm.map((x, i) => `<tr><td class="px-4 py-2.5">${i + 1}</td><td class="px-4 py-2.5">${esc(x.nomor_surat)}</td><td class="px-4 py-2.5">${esc(x.perihal)}</td><td class="px-4 py-2.5">${esc(x.pengirim)}</td><td class="px-4 py-2.5">${esc(Store.kategoriName(x.kategori_id))}</td><td class="px-4 py-2.5">${fmt(x.tanggal_surat)}</td><td class="px-4 py-2.5">${x.status}</td></tr>`).join(''));
    } else if (jenis === 'surat-keluar') {
      html += tableCard('Laporan Surat Keluar', 'fa-paper-plane', 'text-amber-600', ['No', 'Nomor', 'Perihal', 'Tujuan', 'Kategori', 'Tanggal', 'Status'],
        sk.map((x, i) => `<tr><td class="px-4 py-2.5">${i + 1}</td><td class="px-4 py-2.5">${esc(x.nomor_surat)}</td><td class="px-4 py-2.5">${esc(x.perihal)}</td><td class="px-4 py-2.5">${esc(x.tujuan)}</td><td class="px-4 py-2.5">${esc(Store.kategoriName(x.kategori_id))}</td><td class="px-4 py-2.5">${fmt(x.tanggal_surat)}</td><td class="px-4 py-2.5">${x.status}</td></tr>`).join(''));
    } else if (jenis === 'sertifikat') {
      html += tableCard('Laporan Sertifikat Tanah', 'fa-file-contract', 'text-violet-600', ['No', 'Nomor', 'Pemilik', 'Jenis', 'Luas', 'Letak', 'Status'],
        sr.slice().sort((a, b) => b.id - a.id).map((x, i) => `<tr><td class="px-4 py-2.5">${i + 1}</td><td class="px-4 py-2.5">${esc(x.nomor_sertifikat)}</td><td class="px-4 py-2.5">${esc(x.nama_pemilik)}</td><td class="px-4 py-2.5">${esc(x.jenis_sertifikat)}</td><td class="px-4 py-2.5">${Number(x.luas_tanah || 0).toLocaleString('id-ID')} ${esc(x.satuan_luas || 'm2')}</td><td class="px-4 py-2.5">${esc(x.letak_tanah || '-')}</td><td class="px-4 py-2.5">${x.status_sertifikat}</td></tr>`).join(''));
    } else if (jenis === 'arsip') {
      html += tableCard('Laporan Arsip Dokumen', 'fa-box-archive', 'text-emerald-600', ['No', 'Kode', 'Judul', 'Kategori', 'Tahun', 'Lokasi', 'Status'],
        ar.map((x, i) => `<tr><td class="px-4 py-2.5">${i + 1}</td><td class="px-4 py-2.5">${esc(x.kode_arsip)}</td><td class="px-4 py-2.5">${esc(x.judul)}</td><td class="px-4 py-2.5">${esc(x.kategori)}</td><td class="px-4 py-2.5">${esc(x.tahun || '-')}</td><td class="px-4 py-2.5">${esc(x.lokasi_rak || '-')}</td><td class="px-4 py-2.5">${x.status}</td></tr>`).join(''));
    }
    return html;
  }

  /* ============ LOG AKTIVITAS ============ */
  function viewLogs(ctx) {
    const data = d();
    const modul = ctx.params.get('modul') || '';
    const userSel = ctx.params.get('user') || '';
    let page = Math.max(1, parseInt(ctx.params.get('page') || '1', 10));
    const PER = 15;
    let list = data.log.slice();
    if (modul) list = list.filter(x => x.modul === modul);
    if (userSel) list = list.filter(x => x.username === userSel);

    const totalPages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, totalPages);
    const paged = list.slice((page - 1) * PER, page * PER);
    const modules = ['Semua', ...new Set(data.log.map(x => x.modul))];
    const users = ['Semua', ...new Set(data.log.map(x => x.username))];

    let html = pageHead('Log Aktivitas', 'Rekam jejak seluruh aktivitas pengguna');

    html += `<div class="bg-white rounded-2xl shadow-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
      ${fld('Modul', `<select id="lg-modul" onchange="Views.setLogFilter()" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">${modules.map(m => `<option ${m === modul || (m === 'Semua' && !modul) ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
      ${fld('User', `<select id="lg-user" onchange="Views.setLogFilter()" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-bpn-500 outline-none">${users.map(u => `<option ${u === userSel || (u === 'Semua' && !userSel) ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}
      <span class="text-xs text-slate-400 self-center">${list.length} entri</span>
    </div>`;

    const rows = paged.map(x => `<tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">${fmt(x.created_at, true)}</td>
      <td class="px-4 py-3"><span class="font-medium text-slate-700">@${esc(x.username)}</span></td>
      <td class="px-4 py-3"><span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-bpn-50 text-bpn-700 border border-bpn-200">${esc(x.modul)}</span></td>
      <td class="px-4 py-3 text-slate-700">${esc(x.aktivitas)}</td>
      <td class="px-4 py-3 text-slate-500 text-xs">${esc(x.detail || '-')}</td>
      <td class="px-4 py-3 text-slate-400 text-xs">${esc(x.ip_address)}</td></tr>`).join('');

    html += tableCard('Riwayat Aktivitas', 'fa-clock-rotate-left', 'text-bpn-600', ['Waktu', 'User', 'Modul', 'Aktivitas', 'Detail', 'IP'], rows);
    html += `<div class="flex justify-center gap-2 mt-5">`;
    if (page > 1) html += `<a href="#/logs?page=${page - 1}&modul=${encodeURIComponent(modul)}&user=${encodeURIComponent(userSel)}" class="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition no-print">« Sebelumnya</a>`;
    html += `<span class="px-4 py-2 text-sm text-slate-500">Halaman ${page} dari ${totalPages}</span>`;
    if (page < totalPages) html += `<a href="#/logs?page=${page + 1}&modul=${encodeURIComponent(modul)}&user=${encodeURIComponent(userSel)}" class="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition no-print">Berikutnya »</a>`;
    html += `</div>`;
    return html;
  }

  function setLogFilter() {
    const modul = document.getElementById('lg-modul').value;
    const user = document.getElementById('lg-user').value;
    location.hash = '#/logs?modul=' + encodeURIComponent(modul === 'Semua' ? '' : modul) + '&user=' + encodeURIComponent(user === 'Semua' ? '' : user);
  }

  /* ============ PROFIL ============ */
  function viewProfil(ctx) {
    const u = Store.currentUser();
    const rows = [['Username', '@' + u.username], ['NIP', u.nip || '-'], ['Email', u.email || '-'], ['Telepon', u.telepon || '-'], ['Terdaftar', fmt(u.created_at)]];
    return `<div class="max-w-4xl mx-auto">
      ${pageHead('Profil Saya', 'Kelola informasi akun dan keamanan')}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl shadow-lg p-6">
          <div class="flex flex-col items-center text-center">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-bpn-500 to-bpn-700 flex items-center justify-center text-3xl font-bold text-white mb-4">${Store.userInitial(u.nama_lengkap)}</div>
            <h2 class="text-lg font-bold text-slate-800">${esc(u.nama_lengkap)}</h2>
            <p class="text-sm text-slate-500"><span class="capitalize">${esc(u.role)}</span> · ${esc(u.jabatan)}</p>
            <div class="w-full mt-6 space-y-3 text-sm">${rows.map(r => `<div class="flex justify-between items-center py-2 border-b border-slate-100"><span class="text-slate-500">${r[0]}</span><span class="font-medium text-slate-700">${r[1]}</span></div>`).join('')}</div>
          </div>
        </div>
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-1"><i class="fas fa-id-badge text-bpn-500 mr-2"></i>Data Profil</h3>
            <p class="text-sm text-slate-500 mb-5">Perbarui informasi diri Anda</p>
            <form onsubmit="Views.saveProfil(event)" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Nama Lengkap <span class="text-red-500">*</span></label>
                <input name="nama_lengkap" value="${esc(u.nama_lengkap)}" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                <input name="email" value="${esc(u.email || '')}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Telepon</label>
                <input name="telepon" value="${esc(u.telepon || '')}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">NIP</label>
                <input name="nip" value="${esc(u.nip || '')}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-600 mb-1.5">Jabatan</label>
                <input name="jabatan" value="${esc(u.jabatan || '')}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div class="md:col-span-2 flex justify-end"><button type="submit" class="px-6 py-2.5 bg-bpn-600 text-white rounded-xl text-sm font-semibold hover:bg-bpn-700 transition shadow-lg shadow-bpn-600/20"><i class="fas fa-save mr-2"></i>Simpan Perubahan</button></div>
            </form>
          </div>
          <div class="bg-white rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-1"><i class="fas fa-lock text-bpn-500 mr-2"></i>Ganti Password</h3>
            <p class="text-sm text-slate-500 mb-5">Gunakan minimal 6 karakter untuk password baru</p>
            <form onsubmit="Views.changePassword(event)" class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Password Lama <span class="text-red-500">*</span></label>
                <input type="password" name="old_password" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Password Baru <span class="text-red-500">*</span></label>
                <input type="password" name="new_password" required minlength="6" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Konfirmasi <span class="text-red-500">*</span></label>
                <input type="password" name="confirm_password" required minlength="6" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-bpn-500 outline-none text-sm"></div>
              <div class="md:col-span-3 flex justify-end"><button type="submit" class="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition"><i class="fas fa-key mr-2"></i>Ganti Password</button></div>
            </form>
          </div>
        </div>
      </div>
    </div>`;
  }

  function saveProfil(e) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const u = Store.currentUser();
    Object.assign(u, pv, { updated_at: Date.now() });
    Store.addLog(u.id, 'Ubah profil', 'Profil', 'Memperbarui data profil sendiri');
    Store.save(); App.route(); App.applyUserChrome(u); toast('Profil diperbarui', 'success');
  }

  function changePassword(e) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const u = Store.currentUser();
    if (u.password !== Store.hash(pv.old_password)) { toast('Password lama salah!', 'error'); return; }
    if (!pv.new_password || pv.new_password.length < 6) { toast('Password baru minimal 6 karakter!', 'error'); return; }
    if (pv.new_password !== pv.confirm_password) { toast('Konfirmasi password tidak cocok!', 'error'); return; }
    u.password = Store.hash(pv.new_password);
    Store.addLog(u.id, 'Ubah password', 'Profil', 'Mengganti password akun sendiri');
    Store.save(); toast('Password berhasil diganti', 'success');
    e.target.reset();
  }

  /* ============ PENGATURAN ============ */
  function viewPengaturan() {
    const data = d();
    const p = data.pengaturan;
    return `<div class="max-w-5xl mx-auto">
      ${pageHead('Pengaturan', 'Konfigurasi sistem, pengguna & kategori')}
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 class="font-semibold text-slate-700"><i class="fas fa-building text-bpn-600 mr-2"></i>Profil Kantor</h3>
          </div>
          <form onsubmit="Views.saveKantor(event)" class="p-5 space-y-3">
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Nama Kantor</label>
              <input name="nama_kantor" value="${esc(p.nama_kantor)}" class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Alamat</label>
              <input name="alamat_kantor" value="${esc(p.alamat_kantor)}" class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Telepon</label>
              <input name="telepon_kantor" value="${esc(p.telepon_kantor)}" class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Email</label>
              <input name="email_kantor" value="${esc(p.email_kantor)}" class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Website</label>
              <input name="website" value="${esc(p.website || '')}" class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-bpn-500 outline-none"></div>
            <div class="flex justify-end"><button type="submit" class="px-6 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-save mr-2"></i>Simpan Profil</button></div>
          </form>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 class="font-semibold text-slate-700"><i class="fas fa-users text-emerald-600 mr-2"></i>Pengguna</h3>
          </div>
          <form onsubmit="Views.addUser(event)" class="p-5 border-b border-slate-100 bg-slate-50/50">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tambah Pengguna Baru</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="username" placeholder="Username" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required>
              <input name="nama_lengkap" placeholder="Nama Lengkap" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required>
              <input name="password" type="password" placeholder="Password (default: 123456)" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <input name="nip" placeholder="NIP" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <select name="jabatan" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                <option>Staff</option><option>Sub Koordinator</option><option>Koordinator</option><option>Kepala Kantor</option>
              </select>
              <select name="role" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                <option value="user">User</option><option value="kepala">Kepala</option><option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" class="mt-3 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition"><i class="fas fa-user-plus mr-1"></i>Tambah Pengguna</button>
          </form>
          <div class="p-5">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Daftar Pengguna (${data.users.length})</p>
            <div class="space-y-2.5">${data.users.map(u => {
              const isYou = u.id === Store.currentUser().id;
              return `<div class="rounded-xl border border-slate-100">
                <div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-bpn-500 to-bpn-700 flex items-center justify-center text-xs font-bold text-white shrink-0">${Store.userInitial(u.nama_lengkap)}</div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-slate-700 truncate">${esc(u.nama_lengkap)}${isYou ? '<span class="text-[10px] text-bpn-600 bg-bpn-50 px-1.5 py-0.5 rounded ml-1">Anda</span>' : ''}</p>
                    <p class="text-[11px] text-slate-400">@${esc(u.username)} · ${esc(u.jabatan)} <span class="capitalize ${u.role === 'admin' ? 'text-rose-600' : u.role === 'kepala' ? 'text-amber-600' : 'text-emerald-600'}">${esc(u.role)}</span>${u.status === 0 ? ' <span class="text-red-500">· Nonaktif</span>' : ''}</p>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <button onclick="Views.resetUserPw(${u.id})" title="Reset Password" class="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition"><i class="fas fa-key text-xs"></i></button>
                    <button onclick="Views.toggleUserEdit(${u.id})" title="Edit" class="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"><i class="fas fa-pen text-xs"></i></button>
                    ${isYou ? '' : `<button onclick="App.confirmDlg('Hapus user ini?', () => Views.deleteUser(${u.id}))" title="Hapus" class="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"><i class="fas fa-trash text-xs"></i></button>`}
                  </div>
                </div>
                <div id="user-edit-${u.id}" class="hidden border-t border-blue-100 bg-blue-50/60 rounded-b-xl p-4">
                  <form onsubmit="Views.editUser(event, ${u.id})" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p class="text-xs font-semibold text-blue-700 uppercase tracking-wide sm:col-span-2">Edit Pengguna #${u.id} · @${esc(u.username)}</p>
                    <input name="nama_lengkap" value="${esc(u.nama_lengkap)}" placeholder="Nama Lengkap" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" required>
                    <input name="nip" value="${esc(u.nip || '')}" placeholder="NIP" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <select name="jabatan" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option ${u.jabatan === 'Staff' ? 'selected' : ''}>Staff</option><option ${u.jabatan === 'Sub Koordinator' ? 'selected' : ''}>Sub Koordinator</option><option ${u.jabatan === 'Koordinator' ? 'selected' : ''}>Koordinator</option><option ${u.jabatan === 'Kepala Kantor' ? 'selected' : ''}>Kepala Kantor</option>
                    </select>
                    <select name="role" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option><option value="kepala" ${u.role === 'kepala' ? 'selected' : ''}>Kepala</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <input name="email" value="${esc(u.email || '')}" placeholder="Email (opsional)" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <input name="telepon" value="${esc(u.telepon || '')}" placeholder="Telepon (opsional)" class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="status" value="1" ${u.status === 1 ? 'checked' : ''} class="w-4 h-4 rounded text-blue-600"> Akun Aktif</label>
                    <div class="flex justify-end gap-2 sm:col-span-2">
                      <button type="button" onclick="Views.toggleUserEdit(${u.id})" class="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Batal</button>
                      <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"><i class="fas fa-save mr-1"></i>Simpan</button>
                    </div>
                  </form>
                </div>
              </div>`;
            }).join('')}</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 class="font-semibold text-slate-700"><i class="fas fa-tags text-amber-600 mr-2"></i>Kategori Surat</h3>
        </div>
        <div class="p-6">
          <form onsubmit="Views.addKategori(event)" class="flex gap-2 mb-5">
            <input name="nama_kategori" placeholder="Nama kategori baru" class="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" required>
            <select name="tipe" class="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white">
              <option value="semua">Semua</option><option value="masuk">Masuk</option><option value="keluar">Keluar</option>
            </select>
            <button type="submit" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition whitespace-nowrap"><i class="fas fa-plus mr-1"></i>Tambah</button>
          </form>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">${data.kategori.map(k => `
            <div class="flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition group">
              <i class="fas fa-tag text-xs text-amber-500"></i>
              <span class="text-sm text-slate-700 flex-1">${esc(k.nama_kategori)}</span>
              <span class="text-[10px] uppercase text-slate-400">${esc(k.tipe)}</span>
              <button onclick="App.confirmDlg('Hapus kategori ${esc(k.nama_kategori)}?', () => Views.deleteKategori(${k.id}))" class="p-1.5 rounded-lg text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"><i class="fas fa-trash text-[10px]"></i></button>
            </div>`).join('')}</div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 class="font-semibold text-slate-700"><i class="fas fa-database text-bpn-600 mr-2"></i>Data & Penyimpanan</h3>
        </div>
        <div class="p-6 flex flex-wrap gap-4 items-center justify-between">
          <div class="text-sm text-slate-500">
            <p><b class="text-slate-700">${data.suratMasuk.length}</b> surat masuk · <b class="text-slate-700">${data.suratKeluar.length}</b> surat keluar · <b class="text-slate-700">${data.arsip.length}</b> arsip · <b class="text-slate-700">${data.sertifikat.length}</b> sertifikat</p>
            <p class="mt-1 text-xs">Semua data tersimpan otomatis di browser ini (LocalStorage).<br>Untuk memindahkan data ke perangkat lain, gunakan Ekspor/Impor.</p>
          </div>
          <div class="flex gap-2">
            <button onclick="Views.exportData()" class="px-5 py-2.5 bg-bpn-600 hover:bg-bpn-700 text-white rounded-xl text-sm font-semibold transition"><i class="fas fa-download mr-1.5"></i>Ekspor Data (JSON)</button>
            <button onclick="Views.importData()" class="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition"><i class="fas fa-upload mr-1.5"></i>Impor Data</button>
            <button onclick="App.confirmDlg('Reset semua data ke kondisi awal?', Views.resetAll)" class="px-5 py-2.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition"><i class="fas fa-rotate-left mr-1.5"></i>Reset</button>
          </div>
          <input type="file" id="import-file" accept=".json" class="hidden" onchange="Views.doImport(event)">
        </div>
      </div>
    </div>`;
  }

  function saveKantor(e) {
    e.preventDefault();
    Object.assign(Store.data.pengaturan, Object.fromEntries(new FormData(e.target).entries()));
    Store.addLog(Store.currentUser().id, 'Ubah pengaturan', 'Pengaturan', 'Menyimpan profil kantor');
    Store.save(); App.route(); toast('Pengaturan kantor tersimpan', 'success');
  }

  function toggleUserEdit(id) { const el = document.getElementById('user-edit-' + id); if (el) el.classList.toggle('hidden'); }

  function addUser(e) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const data = Store.data;
    if (data.users.some(u => u.username === pv.username)) { toast('Username sudah digunakan!', 'error'); return; }
    data.users.push({
      id: Store.uid('user'), username: pv.username, password: Store.hash(pv.password || '123456'),
      nama_lengkap: pv.nama_lengkap, nip: pv.nip || '', jabatan: pv.jabatan, role: pv.role || 'user',
      email: pv.email || '', telepon: pv.telepon || '', status: 1, created_at: Date.now()
    });
    Store.addLog(Store.currentUser().id, 'Tambah user', 'Pengaturan', `Menambahkan user ${pv.username}`);
    Store.save(); App.route(); toast('User berhasil ditambahkan', 'success');
  }

  function editUser(e, id) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    const u = Store.data.users.find(x => x.id === id);
    if (!u) return;
    Object.assign(u, { nama_lengkap: pv.nama_lengkap, nip: pv.nip || '', jabatan: pv.jabatan, role: pv.role, email: pv.email || '', telepon: pv.telepon || '', status: pv.status ? 1 : 0, updated_at: Date.now() });
    Store.addLog(Store.currentUser().id, 'Edit user', 'Pengaturan', `Mengubah user #${id}`);
    Store.save(); App.route(); toast('User diperbarui', 'success');
  }

  function deleteUser(id) {
    const data = Store.data;
    if (id === Store.currentUser().id) { toast('Tidak dapat menghapus akun sendiri!', 'error'); return; }
    data.users = data.users.filter(x => x.id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus user', 'Pengaturan', `Menghapus user #${id}`);
    Store.save(); App.route(); toast('User dihapus', 'success');
  }

  function resetUserPw(id) {
    const u = Store.data.users.find(x => x.id === id);
    confirmDlg(`Reset password <b>${esc(u.nama_lengkap)}</b> menjadi <b>123456</b>?`, () => {
      u.password = Store.hash('123456');
      Store.addLog(Store.currentUser().id, 'Reset password', 'Pengaturan', `Reset password user #${id}`);
      Store.save(); toast('Password direset menjadi 123456', 'success');
    });
  }

  function addKategori(e) {
    e.preventDefault();
    const pv = Object.fromEntries(new FormData(e.target).entries());
    Store.data.kategori.push({ id: Store.uid('kategori'), nama_kategori: pv.nama_kategori, keterangan: '', tipe: pv.tipe || 'semua' });
    Store.addLog(Store.currentUser().id, 'Tambah kategori', 'Pengaturan', `Menambahkan ${pv.nama_kategori}`);
    Store.save(); App.route(); toast('Kategori ditambahkan', 'success');
  }
  function deleteKategori(id) {
    Store.data.kategori = Store.data.kategori.filter(x => x.id !== id);
    Store.addLog(Store.currentUser().id, 'Hapus kategori', 'Pengaturan', `Menghapus kategori #${id}`);
    Store.save(); App.route(); toast('Kategori dihapus', 'success');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arsip-bpn-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Data berhasil diekspor', 'success');
  }

  function importData() { document.getElementById('import-file').click(); }

  function doImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!parsed.users || !parsed.suratMasuk) throw new Error('invalid');
        Store.data = parsed;
        Store.save();
        location.hash = '#/dashboard';
        App.route();
        toast('Data berhasil diimpor', 'success');
      } catch (err) { toast('File impor tidak valid!', 'error'); }
      e.target.value = '';
    };
    r.readAsText(f);
  }

  function resetAll() {
    Store.resetDemo();
    location.hash = '#/login';
    toast('Data di-reset ke kondisi awal', 'success');
  }

  /* ============ ROUTES ============ */
  function routes() {
    return {
      'dashboard': { roles: ['all'], render: () => viewDashboard(), onload: () => setupDashboard() },
      'surat-masuk': { roles: ['all'], render: c => viewSuratMasuk(c) },
      'surat-keluar': { roles: ['all'], render: c => viewSuratKeluar(c) },
      'arsip': { roles: ['all'], render: c => viewArsip(c) },
      'sertifikat': { roles: ['all'], render: c => viewSertifikat(c) },
      'disposisi': { roles: ['all'], render: () => viewDisposisi() },
      'laporan': { roles: ['all'], render: c => viewLaporan(c) },
      'pengaturan': { roles: ['admin'], render: () => viewPengaturan() },
      'logs': { roles: ['admin'], render: c => viewLogs(c) },
      'profil': { roles: ['all'], render: () => viewProfil() }
    };
  }

  /* ============ SETTER HELPERS EXPOSED TO HTML ============ */
  return {
    routes, viewDashboard, openSuratMasukForm, saveSuratMasuk, deleteSuratMasuk, smDetail,
    openDisposisi, saveDisposisi, setSmFilter,
    openSuratKeluarForm, saveSuratKeluar, deleteSuratKeluar, advanceSuratKeluar, skDetail, setSkStatus,
    openArsipForm, saveArsip, deleteArsip, arDetail, setArsipFilter: viewArsip,
    openSertifikatForm, saveSertifikat, deleteSertifikat, sertDetail, setSertiFilter: viewSertifikat,
    updateDisposisiStatus,
    saveProfil, changePassword,
    saveKantor, addUser, editUser, deleteUser, resetUserPw, toggleUserEdit, addKategori, deleteKategori,
    exportData, importData, doImport, resetAll, setLogFilter
  };
})();