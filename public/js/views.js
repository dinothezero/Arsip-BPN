'use strict';
/* Semua view/render. Views.go(name, el) dipanggil oleh router. */

const Views = (() => {
  const store = {
    arsip: { query: '', page: 1, jenis: '', status: '', kategori: '', instansi: '' },
    trash: {},
    disposisi: { filter: '' },
    peminjaman: { filter: '' },
    agenda: { tahun: '', jenis: 'all' },
    laporan: { dari: '', sampai: '', jenis: '' },
    master: { tab: 'kategori' },
    pinjamRef: [],
  };

  // ---------- bucket umum ----------
  const charts = [];
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (e) {} } }
  async function loadPengaturan() { try { return await API.pengaturan(); } catch (e) { return {}; } }
  async function loadKategori() { try { return await API.masterKategori(); } catch (e) { return []; } }
  async function loadInstansi() { try { return await API.masterInstansi(); } catch (e) { return []; } }
  async function loadLokasi() { try { return await API.masterLokasi(); } catch (e) { return []; } }
  async function loadUnit() { try { return await API.masterUnit(); } catch (e) { return []; } }

  function numToMonth(m) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][parseInt(m, 10) - 1] || m;
  }
  function jenisBadge(j) { const x = UI.jenisArsip(j); return `<span class="badge ${x[2]}"><i class="fas ${x[1]}"></i> ${x[0]}</span>`; }
  function statusBadge(s) { const x = UI.statusArsip(s); return `<span class="badge ${x.cls}">${x.text}</span>`; }

  function pageHead(title, sub, toolbar) {
    return `<div class="page-head"><div><h1>${title}</h1><div class="sub">${sub}</div></div>${toolbar ? `<div class="page-toolbar">${toolbar}</div>` : ''}</div><div class="gov-stripe"><span class="gs1"></span><span class="gs2"></span><span class="gs3"></span><span class="gs4"></span></div>`;
  }

  // ================= DASHBOARD =================
  async function renderDashboard(el) {
    const d = await API.dashboard();
    const myRole = App.roleOf();
    const s = d.stats;
    const now = new Date();
    let greet = 'Selamat datang';
    const h = now.getHours();
    if (h < 11) greet = 'Selamat pagi';
    else if (h < 15) greet = 'Selamat siang';
    else if (h < 18) greet = 'Selamat sore';
    else greet = 'Selamat malam';
    const name = App.user ? App.user.nama_lengkap.split(' ').slice(0, 2).join(' ') : '';

    const statCards = [
      ['fa-book-open', 'ic-teal', UI.fmtNumber(s.total_arsip), 'Total Arsip', 'semua dokumen'],
      ['fa-file-import', 'ic-green', UI.fmtNumber(s.surat_masuk), 'Surat Masuk', 'tercatat'],
      ['fa-file-export', 'ic-blue', UI.fmtNumber(s.surat_keluar), 'Surat Keluar', 'tercatat'],
      ['fa-certificate', 'ic-gold', UI.fmtNumber(s.dokumen), 'Sertifikat & SK', 'tercatat'],
      ['fa-hand-holding', 'ic-gold', UI.fmtNumber(s.peminjaman_aktif), 'Dipinjam', 'arsip sedang dipinjam'],
      ['fa-right-left', 'ic-green', UI.fmtNumber(s.disposisi_proses), 'Disposisi Menunggu', 'proses berjalan'],
      ['fa-folder-tree', 'ic-teal', UI.fmtNumber(s.total_kategori), 'Kategori', 'master arsip'],
      ['fa-user-check', 'ic-blue', UI.fmtNumber(s.total_user), 'Pengguna Aktif', 'akun staf'],
    ].map((c) => `<div class="stat-card"><div class="st-icon ${c[1]}"><i class="fas ${c[0]}"></i></div><div class="st-label">${c[2]}</div><div class="st-value" data-count="${c[2]}" data-raw="${c[2].replace(/\./g, '')}">0</div><div class="st-delta">${c[4]}</div></div>`).join('');

    // tren pasang chart
    el.innerHTML = `
      ${pageHead(`${greet}, ${UI.esc(name)}`, 'Berikut ringkasan pengelolaan arsip kantor Anda.')}
      <div class="stats-grid">${statCards}</div>

      <div class="grid grid-3" style="margin-bottom:20px">
        <div class="card" style="grid-column:span 2">
          <div class="card-head"><h3><i class="fas fa-chart-line text-emas mr-1"></i>Tren Arsip 12 Bulan Terakhir</h3><span class="badge badge-green">bulanan</span></div>
          <div class="card-pad"><div class="chart-box"><canvas id="ch-trend"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-chart-pie text-emas mr-1"></i>Status Arsip</h3></div>
          <div class="card-pad"><div class="chart-sm"><canvas id="ch-status"></canvas></div></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:2fr 1fr;margin-bottom:20px">
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-calendar-day text-emas mr-1"></i>Agenda Kegiatan Hari Ini</h3><a href="#/kalender" class="text-small">Lihat kalender <i class="fas fa-arrow-right"></i></a></div>
          <div class="card-body">
            ${d.agendaHariIni.length ? d.agendaHariIni.map((k) => `
              <div class="flex items-center justify-between mb-2" style="padding:10px 14px;background:var(--slate-50);border-radius:10px">
                <div class="flex items-center" style="gap:12px">
                  <div style="width:38px;height:38px;border-radius:10px;background:var(--hijau-100);color:var(--hijau-700);display:flex;align-items:center;justify-content:center"><i class="fas ${k.selesai ? 'fa-check' : 'fa-clock'}"></i></div>
                  <div><b class="text-small">${UI.esc(k.judul)}</b><div class="text-muted text-small">${UI.esc(k.jam_mulai || '-')} ${k.lokasi ? '· ' + UI.esc(k.lokasi) : ''}</div></div>
                </div>
                <span class="badge ${k.selesai ? 'badge-gray' : 'badge-green'}">${k.selesai ? 'Selesai' : 'Terjadwal'}</span>
              </div>`).join('') : `<div class="empty"><i class="fas fa-calendar-check"></i><b>Tidak ada agenda hari ini</b>Kegiatan yang terjadwal akan tampil di sini.</div>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-hand-holding text-emas mr-1"></i>Peminjaman Aktif</h3><a href="#/peminjaman" class="text-small"><i class="fas fa-arrow-right"></i></a></div>
          <div class="card-body">
            ${d.pinjamAktif.length ? d.pinjamAktif.map((p) => `<div class="flex items-center justify-between mb-2" style="padding:9px 12px;background:var(--slate-50);border-radius:10px"><div class="text-small"><b>${UI.esc(p.nomor_arsip)}</b><div class="text-muted">${UI.esc(p.peminjam)} · ${UI.esc(p.jatuh_tempo)}</div></div><span class="badge ${p.status_efektif === 'terlambat' ? 'badge-red' : 'badge-gold'}">${p.status_efektif}</span></div>`).join('') : `<div class="empty"><i class="fas fa-hand-holding"></i><b>Sedang tidak ada peminjaman</b></div>`}
          </div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:3fr 2fr">
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-folder-closed text-emas mr-1"></i>Arsip per Kategori</h3></div>
          <div class="card-pad"><div class="chart-box" style="height:250px"><canvas id="ch-kategori"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-right-left text-emas mr-1"></i>Disposisi Terbaru</h3><a href="#/disposisi" class="text-small"><i class="fas fa-arrow-right"></i></a></div>
          <div class="card-body">
            ${d.disposisiTerbaru.length ? d.disposisiTerbaru.map((dd) => `<div class="flex items-center gap-2 mb-2" style="gap:12px;padding:9px 12px;background:var(--slate-50);border-radius:10px"><div style="width:34px;height:34px;border-radius:10px;background:var(--hijau-100);color:var(--hijau-700);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-right-left"></i></div><div class="text-small"><b>${UI.esc(dd.nomor_arsip || '')}</b><div class="text-muted">→ ${UI.esc(dd.ke_nama || '')}</div></div></div>`).join('') : `<div class="empty"><i class="fas fa-right-left"></i><b>Belum ada disposisi</b></div>`}
          </div>
        </div>
      </div>`;

    renderCharts(d);

    // count-up
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-raw]').forEach((node) => {
        const t = parseInt(node.dataset.raw, 10) || 0;
        const dur = 900; const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / dur, 1);
          node.textContent = UI.fmtNumber(Math.floor(t * (0.2 + p * 0.8 * (1 - Math.pow(1 - p, 3)))).toString());
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      // reveal
      document.querySelectorAll('.reveal').forEach((n) => n.classList.add('in'));
    });
  }

  function renderCharts(d) {
    destroyCharts();
    const colors = {
      tile: { green: '#0b6e4f', teal: '#14b8a6', gold: '#c9a227', red: '#ef4444' },
    };
    if (d.tren12 && Array.isArray(d.tren12)) {
      // isi 12 bulan terakhir berurutan
      const labels = []; const last = new Date();
      for (let i = 11; i >= 0; i--) { const dt = new Date(last.getFullYear(), last.getMonth() - i, 1); labels.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); }
      const vals = labels.map((lb) => { const f = d.tren12.find((t) => t.bulan === lb); return f ? f.n : 0; });
      const ch = new Chart(document.getElementById('ch-trend'), {
        type: 'line',
        data: { labels: labels.map((lb) => `${numToMonth(lb.slice(5))} '${lb.slice(2, 4)}`), datasets: [{ label: 'Arsip', data: vals, borderColor: '#0b6e4f', backgroundColor: 'rgba(11,110,79,.12)', fill: true, tension: .35, pointBackgroundColor: '#0b6e4f', pointRadius: 3, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a' } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(203,213,225,.4)' }, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
      }); charts.push(ch);
    }
    if (d.perStatus && Array.isArray(d.perStatus)) {
      const map = { aktif: ['Aktif', '#0b6e4f'], arsip: ['Arsip', '#14b8a6'], dipinjam: ['Dipinjam', '#c9a227'], hilang: ['Hilang', '#ef4444'], rusak: ['Rusak', '#f97316'] };
      const dd = d.perStatus.map((x) => (map[x.status] || [x.status, '#94a3b8']));
      const ch = new Chart(document.getElementById('ch-status'), {
        type: 'doughnut',
        data: { labels: dd.map((x) => x[0]), datasets: [{ data: d.perStatus.map((x) => x.n), backgroundColor: dd.map((x) => x[1]), borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', animation: { animateRotate: true, duration: 1000 }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } } },
      }); charts.push(ch);
    }
    if (d.perKategori && Array.isArray(d.perKategori)) {
      const ch = new Chart(document.getElementById('ch-kategori'), {
        type: 'bar',
        data: { labels: d.perKategori.map((x) => x.kode), datasets: [{ data: d.perKategori.map((x) => x.n), backgroundColor: d.perKategori.map((_, i) => (i % 2 ? '#14b8a6' : '#0b6e4f')), borderRadius: 5 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 700, easing: 'easeOutQuart' }, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(203,213,225,.4)' } }, y: { grid: { display: false } } } },
      }); charts.push(ch);
    }
  }

  // ================= ARSIP =================
  async function renderArsip(el) {
    const [kats, insts, loks, unit] = await Promise.all([loadKategori(), loadInstansi(), loadLokasi(), loadUnit()]);
    const k = store.arsip;
    const q = [
      k.query ? 'q=' + encodeURIComponent(k.query) : '',
      k.jenis ? 'jenis=' + k.jenis : '',
      k.status ? 'status=' + k.status : '',
      k.kategori ? 'kategori_id=' + k.kategori : '',
      k.instansi ? 'instansi_id=' + k.instansi : '',
      'limit=50', 'offset=' + ((k.page - 1) * 50),
    ].filter(Boolean).join('&');
    let r = { total: 0, rows: [] };
    try { r = await API.arsip(q); } catch (e) { UI.toastError(e); }
    const opts = (arr) => `<option value="">Semua</option>` + (arr || []).map((x) => `<option value="${x.id}" ${String(k.kategori) === String(x.id) ? 'selected' : ''}>${UI.esc(x.nama_kategori || x.nama_instansi || x.nama_lokasi || x.nama_unit || '')}</option>`).join('');
    const totalPages = Math.ceil(r.total / 50);

    el.innerHTML = `
      ${pageHead('Arsip Dokumen', `${UI.fmtNumber(r.total)} arsip ditemukan`, `<button class="btn btn-primary" onclick="App.modalTambahArsip()"><i class="fas fa-plus"></i> Tambah Arsip</button><button class="btn btn-outline" onclick="App.modalImport()" data-role="admin" style="${App.roleOf() === 'admin' ? '' : 'display:none'}"><i class="fas fa-file-csv"></i> Import CSV</button>`)}
      <div class="filters card card-pad">
        <div class="search"><i class="fas fa-magnifying-glass"></i><input class="field" id="f-q" placeholder="Cari nomor, judul, perihal..." value="${UI.esc(k.query)}" oninput="debounce(() => { store('arsip','query',this.value); store('arsip','page',1); Views.refreshArsip(); })"></div>
        <select class="field" onchange="storeAs('jenis',this.value)">${['', 'Surat Masuk'].map(() => '').join('')}<option value="">Semua Jenis</option><option value="surat-masuk" ${k.jenis === 'surat-masuk' ? 'selected' : ''}>Surat Masuk</option><option value="surat-keluar" ${k.jenis === 'surat-keluar' ? 'selected' : ''}>Surat Keluar</option><option value="sertifikat" ${k.jenis === 'sertifikat' ? 'selected' : ''}>Sertifikat</option><option value="sk" ${k.jenis === 'sk' ? 'selected' : ''}>Surat Keputusan</option><option value="laporan" ${k.jenis === 'laporan' ? 'selected' : ''}>Laporan</option><option value="lainnya" ${k.jenis === 'lainnya' ? 'selected' : ''}>Lainnya</option></select>
        <select class="field" onchange="storeAs('status',this.value)"><option value="">Semua Status</option><option value="aktif" ${k.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="arsip" ${k.status === 'arsip' ? 'selected' : ''}>Arsip</option><option value="dipinjam" ${k.status === 'dipinjam' ? 'selected' : ''}>Dipinjam</option><option value="hilang" ${k.status === 'hilang' ? 'selected' : ''}>Hilang</option><option value="rusak" ${k.status === 'rusak' ? 'selected' : ''}>Rusak</option></select>
        <select class="field" onchange="storeAs('kategori',this.value)">${opts(kats)}</select>
        <select class="field" onchange="storeAs('instansi',this.value)">${opts(insts)}</select>
        <button class="btn btn-ghost btn-sm" onclick="resetArsipFilter()" ${k.query || k.jenis || k.status || k.kategori || k.instansi ? '' : 'disabled'}><i class="fas fa-rotate-left"></i> Reset</button>
      </div>
      <div class="card">
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>Nomor Arsip</th><th>Judul / Perihal</th><th>Jenis</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${renderArsipRows(r.rows, (k.page - 1) * 50)}</tbody>
        </table></div>
        ${totalPages > 1 ? `<div class="pagination">Halaman ${k.page}/${totalPages} <button ${k.page <= 1 ? 'disabled' : ''} onclick="pageArsip(${k.page - 1})"><i class="fas fa-chevron-left"></i></button><button ${k.page >= totalPages ? 'disabled' : ''} onclick="pageArsip(${k.page + 1})"><i class="fas fa-chevron-right"></i></button></div>` : ''}
      </div>`;
    el.querySelectorAll('[data-role]').forEach((n) => { if (App.roleOf() !== 'admin') n.style.display = 'none'; });
  }
  function renderArsipRows(rows, base) {
    if (!rows || !rows.length) return `<tr><td colspan="8"><div class="empty"><i class="fas fa-folder-open"></i><b>Belum ada arsip</b>Klik "Tambah Arsip" untuk membuat data pertama.</div></td></tr>`;
    return rows.map((a, i) => `
      <tr>
        <td class="row-num">${base + i + 1}</td>
        <td class="wrap-main"><a class="link-arsip" onclick="App.modalDetail(${a.id})">${UI.esc(a.nomor_arsip)}</a><div class="wrap-sub">${a.kode_kategori ? UI.esc(a.kode_kategori) : '-'}</div></td>
        <td><div class="wrap-main">${UI.esc(a.judul)}</div>${a.perihal ? `<div class="wrap-sub">${UI.esc(a.perihal)}</div>` : ''}</td>
        <td>${jenisBadge(a.jenis)}</td>
        <td>${a.nama_kategori ? UI.esc(a.nama_kategori) : '-'}</td>
        <td>${a.tanggal ? UI.fmtDate(a.tanggal) : '-'}</td>
        <td>${statusBadge(a.status)}</td>
        <td><div class="flex" style="gap:4px">
          <button class="icon-btn" title="Detail" onclick="App.modalDetail(${a.id})"><i class="fas fa-eye"></i></button>
          ${a.file_path ? `<a class="icon-btn" title="Unduh lampiran" href="${API.download(a.id)}"><i class="fas fa-paperclip"></i></a>` : ''}
          <button class="icon-btn" title="QR" onclick="App.modalQR(${a.id}, '${UI.esc(a.nomor_arsip)}')"><i class="fas fa-qrcode"></i></button>
          <button class="icon-btn" title="Ubah" onclick="App.modalEditArsip(${a.id})"><i class="fas fa-pen"></i></button>
          <button class="icon-btn danger" title="Hapus" onclick="App.modalHapus(${a.id}, 'arsip')"><i class="fas fa-trash-can"></i></button>
        </div></td>
      </tr>`).join('');
  }

  // ================= TRASH =================
  async function renderTrash(el) {
    let rows = [];
    try { rows = await API.trash(); } catch (e) { UI.toastError(e); }
    el.innerHTML = `
      ${pageHead('Tempat Sampah', 'Arsip yang dihapus lunak. Dapat dipulihkan atau dihapus permanen.', `${App.roleOf() === 'admin' ? `<button class="btn btn-danger" onclick="App.hapusSemuaTrash()"><i class="fas fa-trash-can"></i> Kosongkan</button>` : ''}`)}
      <div class="card">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nomor Arsip</th><th>Judul</th><th>Jenis</th><th>Dihapus</th><th>Aksi</th></tr></thead>
        <tbody>${rows.length ? rows.map((a, i) => `<tr><td class="row-num">${i + 1}</td><td class="wrap-main">${UI.esc(a.nomor_arsip)}</td><td>${UI.esc(a.judul)}</td><td>${jenisBadge(a.jenis)}</td><td>${UI.fmtDateTime(a.deleted_at)}</td><td><div class="flex" style="gap:4px"><button class="icon-btn" title="Pulihkan" onclick="App.restoreArsip(${a.id})"><i class="fas fa-rotate-left"></i></button><button class="icon-btn danger" title="Hapus permanen" onclick="App.hapusArsipPermanen(${a.id})"><i class="fas fa-trash-can"></i></button></div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty"><i class="fas fa-trash-can"></i><b>Tempat sampah kosong</b>Arsip yang dihapus akan tampil di sini.</div></td></tr>`}</tbody></table></div>
      </div>`;
  }

  // ================= DISPOSISI =================
  async function renderDisposisi(el) {
    const [rows, users] = await Promise.all([API.disposisi(), API.users().catch(() => [])]);
    const k = store.disposisi = store.disposisi || { filter: '' };
    const filtered = k.filter ? rows.filter((r) => r.status === k.filter) : rows;
    // pill jumlah menunggu utk saya
    const utkSaya = rows.filter((r) => String(r.ke_user_id) === String(App.user.id));
    el.innerHTML = `
      ${pageHead('Disposisi', `Alihkan arsip kepada pejabat atau petugas.`, `<button class="btn btn-primary" onclick="App.modalTambahDisposisi()"><i class="fas fa-right-left"></i> Buat Disposisi</button>`)}
      <div class="filters card card-pad">
        <select class="field" onchange="dispFilter(this.value)"><option value="">Semua Status</option><option value="proses" ${k.filter === 'proses' ? 'selected' : ''}>Proses</option><option value="selesai" ${k.filter === 'selesai' ? 'selected' : ''}>Selesai</option><option value="ditolak" ${k.filter === 'ditolak' ? 'selected' : ''}>Ditolak</option></select>
        <span class="badge badge-gold"><i class="fas fa-bell"></i> ${utkSaya.length} untuk saya</span>
      </div>
      <div class="card">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Arsip</th><th>Dari</th><th>Ke</th><th>Instruksi</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${filtered.length ? filtered.map((d2, i) => `
          <tr class="${!d2.dibaca && String(d2.ke_user_id) === String(App.user.id) ? '' : ''}">
            <td class="row-num">${i + 1}</td>
            <td><div class="wrap-main">${UI.esc(d2.nomor_arsip || '-')}</div><div class="wrap-sub">${UI.esc(d2.judul_arsip || '')}</div></td>
            <td>${UI.esc(d2.dari_nama || '-')}</td>
            <td>${UI.esc(d2.ke_nama || '-')}${String(d2.ke_user_id) === String(App.user.id) && !d2.dibaca ? ' <span class="badge badge-red text-small">baru</span>' : ''}</td>
            <td style="max-width:240px">${UI.esc(d2.instruksi || '-')}${d2.catatan ? `<div class="wrap-sub"><i class="fa-solid fa-plus"></i> ${UI.esc(d2.catatan)}</div>` : ''}</td>
            <td>${UI.fmtDate(d2.tanggal)}</td>
            <td>${dispStatus(d2.status)}</td>
            <td><div class="flex" style="gap:4px">
              ${String(d2.ke_user_id) === String(App.user.id) && !d2.dibaca ? `<button class="icon-btn" title="Tandai dibaca" onclick="App.bacaDisposisi(${d2.id})"><i class="fas fa-envelope-open"></i></button>` : ''}
              ${d2.status === 'proses' ? `<button class="icon-btn" title="Tandai selesai" onclick="App.statusDisposisi(${d2.id},'selesai')"><i class="fas fa-check"></i></button><button class="icon-btn danger" title="Tolak" onclick="App.statusDisposisi(${d2.id},'ditolak')"><i class="fas fa-xmark"></i></button>` : ''}
            </div></td>
          </tr>`).join('') : `<tr><td colspan="8"><div class="empty"><i class="fas fa-right-left"></i><b>Belum ada disposisi</b></div></td></tr>`}</tbody></table></div>
      </div>
      ${!rows.length ? `<div class="mt-3 text-center text-muted text-small">Pengguna aktif: ${users.map((u) => UI.esc(u.nama_lengkap)).join(', ')}</div>` : ''}`;
  }
  function dispStatus(s) {
    const m = { proses: ['badge-gold', 'Proses'], selesai: ['badge-green', 'Selesai'], ditolak: ['badge-red', 'Ditolak'] };
    const x = m[s] || ['badge-gray', s]; return `<span class="badge ${x[0]}"><i class="fas ${s === 'proses' ? 'fa-gear fa-spin' : s === 'selesai' ? 'fa-check' : 'fa-xmark'}"></i> ${x[1]}</span>`;
  }

  // ================= PEMINJAMAN =================
  async function renderPeminjaman(el) {
    let rows = [];
    try { rows = await API.pinjam(); } catch (e) { UI.toastError(e); }
    const k = store.peminjaman = store.peminjaman || { filter: '' };
    const filtered = k.filter ? rows.filter((r) => (r.status_efektif || r.status) === k.filter) : rows;
    const terlambat = rows.filter((r) => (r.status_efektif || r.status) === 'terlambat').length;
    el.innerHTML = `
      ${pageHead('Peminjaman Arsip', terlambat ? `<span class="badge badge-red"><i class="fas fa-triangle-exclamation"></i> ${terlambat} peminjaman terlambat</span>` : 'Catat peminjaman, jatuh tempo, dan pengembalian arsip.', `<button class="btn btn-primary" onclick="App.modalTambahPinjam()"><i class="fas fa-hand-holding"></i> Catat Peminjaman</button>`)}
      <div class="filters card card-pad">
        <span class="badge badge-gold"><i class="fas fa-clock-rotate-left"></i> ${rows.length} total</span>
        <select class="field" onchange="pinjamFilter(this.value)"><option value="">Semua</option><option value="dipinjam" ${k.filter === 'dipinjam' ? 'selected' : ''}>Dipinjam</option><option value="terlambat" ${k.filter === 'terlambat' ? 'selected' : ''}>Terlambat</option><option value="dikembalikan" ${k.filter === 'dikembalikan' ? 'selected' : ''}>Dikembalikan</option></select>
      </div>
      <div class="card">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Arsip</th><th>Peminjam</th><th>Tanggal Pinjam</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${filtered.length ? rowsToRows(filtered) : `<tr><td colspan="7"><div class="empty"><i class="fas fa-hand-holding"></i><b>Belum ada data peminjaman</b></div></td></tr>`}</tbody></table></div>
      </div>`;
  }
  function rowsToRows(rows) {
    return rows.map((p, i) => {
      const st = p.status_efektif || p.status;
      return `<tr>
        <td class="row-num">${i + 1}</td>
        <td><div class="wrap-main">${UI.esc(p.nomor_arsip || '-')}</div><div class="wrap-sub">${UI.esc(p.judul_arsip || '')}</div></td>
        <td><b class="text-small">${UI.esc(p.peminjam)}</b>${p.unit_peminjam ? `<div class="wrap-sub">${UI.esc(p.unit_peminjam)}</div>` : ''}</td>
        <td>${UI.fmtDate(p.tanggal_pinjam)}</td>
        <td>${UI.fmtDate(p.jatuh_tempo)}${st === 'terlambat' ? `<div class="wrap-sub text-danger"><i class="fas fa-triangle-exclamation"></i> terlambat</div>` : ''}</td>
        <td>${p.status === 'dikembalikan' ? `<span class="badge badge-green">Dikembalikan${p.tanggal_kembali ? '<br>' + UI.esc(UI.fmtDate(p.tanggal_kembali)) : ''}</span>` : st === 'terlambat' ? `<span class="badge badge-red">Terlambat</span>` : `<span class="badge badge-gold">Dipinjam</span>`}</td>
        <td><div class="flex" style="gap:4px">${st === 'dipinjam' || st === 'terlambat' ? `<button class="icon-btn" title="Catat pengembalian" onclick="App.kembalikanPinjam(${p.id})"><i class="fas fa-rotate-left" style="color:#0b6e4f"></i></button>` : ''}<button class="icon-btn danger" title="Hapus catatan" onclick="App.hapusPinjam(${p.id})"><i class="fas fa-trash-can"></i></button></div></td>
      </tr>`;
    }).join('');
  }

  // ================= AGENDA =================
  async function renderAgenda(el) {
    const rows = await API.agenda().catch(() => []);
    const k = store.agenda;
    const years = [...new Set(rows.map((r) => r.tahun))].sort((a, b) => b - a);
    let y = k.tahun || (years[0] || new Date().getFullYear());
    let ft = rows.filter((r) => r.tahun === y);
    if (k.jenis !== 'all') ft = ft.filter((r) => r.jenis === k.jenis);
    const masuk = ft.filter((r) => r.jenis === 'masuk');
    const keluar = ft.filter((r) => r.jenis === 'keluar');
    el.innerHTML = `
      ${pageHead('Buku Agenda', 'Nomor urut otomatis per tahun untuk surat masuk & keluar.', ``)}
      <div class="filters card card-pad">
        <select class="field" onchange="agendaTahun(this.value)">${years.map((yy) => `<option value="${yy}" ${yy === y ? 'selected' : ''}>Tahun ${yy}</option>`).join('')}</select>
        <select class="field" onchange="agendaJenis(this.value)"><option value="all">Masuk & Keluar</option><option value="masuk" ${k.jenis === 'masuk' ? 'selected' : ''}>Surat Masuk</option><option value="keluar" ${k.jenis === 'keluar' ? 'selected' : ''}>Surat Keluar</option></select>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h3><i class="fas fa-file-import text-emas mr-1"></i>Agenda Surat Masuk</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>No Urut</th><th>Tanggal</th><th>Nomor</th><th>Perihal</th></tr></thead><tbody>${masuk.length ? masuk.map((r) => `<tr><td class="row-num">${r.nomor_urut}</td><td>${UI.fmtDate(r.tanggal)}</td><td class="wrap-main">${UI.esc(r.nomor_arsip || '-')}</td><td>${UI.esc(r.perihal || r.judul || '')}</td></tr>`).join('') : `<tr><td colspan="4"><div class="empty" style="padding:28px"><b>Kosong</b></div></td></tr>`}</tbody></table></div>
        </div>
        <div class="card"><div class="card-head"><h3><i class="fas fa-file-export text-emas mr-1"></i>Agenda Surat Keluar</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>No Urut</th><th>Tanggal</th><th>Nomor</th><th>Perihal</th></tr></thead><tbody>${keluar.length ? keluar.map((r) => `<tr><td class="row-num">${r.nomor_urut}</td><td>${UI.fmtDate(r.tanggal)}</td><td class="wrap-main">${UI.esc(r.nomor_arsip || '-')}</td><td>${UI.esc(r.perihal || r.judul || '')}</td></tr>`).join('') : `<tr><td colspan="4"><div class="empty" style="padding:28px"><b>Kosong</b></div></td></tr>`}</tbody></table></div>
        </div>
      </div>
      <div class="text-muted text-small mt-3"><i class="fas fa-circle-info"></i> Agenda tercatat otomatis ketika surat masuk/keluar dibuat dengan opsi "Catat ke buku agenda".</div>`;
  }

  // ================= KALENDER =================
  async function renderKalender(el) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    let bln = store.kalenderBln || `${y}-${String(m + 1).padStart(2, '0')}`;
    let items = [];
    try { items = await API.kegiatan(bln); } catch (e) { UI.toastError(e); }
    const [cy, cm] = bln.split('-').map(Number);
    const first = new Date(cy, cm - 1, 1);
    const startDow = first.getDay();
    const last = new Date(cy, cm, 0).getDate();
    const bulanNama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][cm - 1];
    const todayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<td class="other"></td>';
    for (let d = 1; d <= last; d++) {
      const dayStr = `${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const evs = items.filter((e) => e.tanggal === dayStr);
      const isToday = dayStr === todayStr;
      cells += `<td class="${isToday ? 'today' : ''}"><span class="dnum">${d}</span>${evs.map((e) => `<span class="ev ev-${e.jenis || 'lainnya'} ${e.selesai ? 'done' : ''}" onclick="App.modalDetailKegiatan(${e.id})" title="${UI.esc(e.judul)}${e.jam_mulai ? ' ' + UI.esc(e.jam_mulai) : ''}">${UI.esc(e.jam_mulai || '')} ${UI.esc(e.judul)}</span>`).join('')}</td>`;
      if ((startDow + d) % 7 === 0 && d < last) cells += '</tr><tr>';
    }
    el.innerHTML = `
      ${pageHead('Kalender Kegiatan', 'Agenda rapat, verifikasi, pelayanan, dan kegiatan lainnya.', `<button class="btn btn-primary" onclick="App.modalTambahKegiatan('${todayStr}')" id="btn-tambah-keg">+ Tambah Kegiatan</button>`)}
      <div class="card card-pad">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center" style="gap:10px"><button class="btn btn-outline btn-sm" onclick="kalBulan(-1)"><i class="fas fa-chevron-left"></i></button><h3 style="font-size:17px">${UI.esc(bulanNama)} ${cy}</h3><button class="btn btn-outline btn-sm" onclick="kalBulan(1)"><i class="fas fa-chevron-right"></i></button></div>
          <button class="btn btn-ghost btn-sm" onclick="kalHariIni()">Hari ini</button>
        </div>
        <table class="calendar"><thead><tr><th>Min</th><th>Sen</th><th>Sel</th><th>Rab</th><th>Kam</th><th>Jum</th><th>Sab</th></tr></thead><tbody><tr>${cells}</tr></tbody></table>
      </div>
      <div class="card mt-4"><div class="card-head"><h3><i class="fas fa-list text-emas mr-1"></i>Daftar Kegiatan</h3></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Tanggal</th><th>Jam</th><th>Kegiatan</th><th>Jenis</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${items.length ? items.map((k2, i) => `<tr><td class="row-num">${i + 1}</td><td>${UI.fmtDate(k2.tanggal)}</td><td>${UI.esc(k2.jam_mulai || '')}${k2.jam_selesai ? ' - ' + UI.esc(k2.jam_selesai) : ''}</td><td class="wrap-main">${UI.esc(k2.judul)}${k2.keterangan ? `<div class="wrap-sub">${UI.esc(k2.keterangan)}</div>` : ''}</td><td>${kegJenis(k2.jenis)}</td><td>${UI.esc(k2.lokasi || '-')}</td><td>${k2.selesai ? '<span class="badge badge-green">Selesai</span>' : '<span class="badge badge-gold">Terjadwal</span>'}</td><td><div class="flex" style="gap:4px"><button class="icon-btn" onclick="App.toggleKegiatSelesai(${k2.id}, ${k2.selesai ? '0' : '1'})"><i class="fas fa-user-check"></i></button><button class="icon-btn" onclick="App.modalEditKegiatan(${k2.id})"><i class="fas fa-pen"></i></button><button class="icon-btn danger" onclick="App.hapusKegiatan(${k2.id})"><i class="fas fa-trash-can"></i></button></div></td></tr>`).join('') : `<tr><td colspan="8"><div class="empty"><i class="fas fa-calendar-days"></i><b>Tidak ada kegiatan bulan ini</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    el.querySelector('#btn-tambah-keg').setAttribute('onclick', `App.modalTambahKegiatan('${todayStr}')`);
  }
  function kegJenis(j) {
    const m = { rapat: ['badge-blue', 'Rapat'], verifikasi: ['badge-red', 'Verifikasi'], pelayanan: ['badge-gold', 'Pelayanan'], sosialisasi: ['badge-green', 'Sosialisasi'], lainnya: ['badge-gray', 'Lainnya'] };
    const x = m[j] || ['badge-gray', j]; return `<span class="badge ${x[0]}">${x[1]}</span>`;
  }

  // ================= LAPORAN =================
  async function renderLaporan(el) {
    const k = store.laporan;
    let rows = [];
    try {
      const q = [k.jenis ? 'jenis=' + k.jenis : '', k.dari ? 'dari=' + k.dari : '', k.sampai ? 'sampai=' + k.sampai : ''].filter(Boolean).join('&');
      rows = await API.rekap(q);
    } catch (e) { UI.toastError(e); }
    const urlQ = [k.jenis ? 'jenis=' + encodeURIComponent(k.jenis) : '', k.dari ? 'dari=' + k.dari : '', k.sampai ? 'sampai=' + k.sampai : ''].filter(Boolean).join('&');
    el.innerHTML = `
      ${pageHead('Laporan & Ekspor', 'Rekap arsip, cetak laporan ber-kop, ekspor Excel & CSV, impor massal, dan cadangan database.', ``)}
      <div class="filters card card-pad">
        <input type="date" class="field" value="${k.dari}" onchange="laporanField('dari',this.value)"><span class="text-muted">s/d</span>
        <input type="date" class="field" value="${k.sampai}" onchange="laporanField('sampai',this.value)">
        <select class="field" onchange="laporanField('jenis',this.value)"><option value="">Semua Jenis</option><option value="surat-masuk" ${k.jenis === 'surat-masuk' ? 'selected' : ''}>Surat Masuk</option><option value="surat-keluar" ${k.jenis === 'surat-keluar' ? 'selected' : ''}>Surat Keluar</option><option value="sertifikat" ${k.jenis === 'sertifikat' ? 'selected' : ''}>Sertifikat</option><option value="sk" ${k.jenis === 'sk' ? 'selected' : ''}>Surat Keputusan</option><option value="laporan" ${k.jenis === 'laporan' ? 'selected' : ''}>Laporan</option><option value="lainnya" ${k.jenis === 'lainnya' ? 'selected' : ''}>Lainnya</option></select>
      </div>

      <div class="grid grid-3" style="margin-bottom:20px">
        <div class="card"><div class="card-pad text-center"><i class="fas fa-magnifying-glass-chart" style="font-size:34px;color:var(--hijau-600);margin-bottom:10px;display:block"></i><h3 style="margin-bottom:6px">Rekap Terfilter</h3><p class="text-muted text-small mb-3">${UI.fmtNumber(rows.length)} arsip sesuai filter</p><button class="btn btn-ghost btn-block" onclick="App.modalCetak()"><i class="fas fa-print"></i> Lihat / Cetak</button></div></div>
        <div class="card"><div class="card-pad text-center"><i class="fas fa-file-excel" style="font-size:34px;color:#0b6e4f;margin-bottom:10px;display:block"></i><h3 style="margin-bottom:6px">Ekspor Excel</h3><p class="text-muted text-small mb-3">Format .xlsx bergaya resmi BPN</p><a class="btn btn-primary btn-block" href="${API.exportXlsx(urlQ ? '?' + urlQ : '')}"><i class="fas fa-file-arrow-down"></i> Download .xlsx</a></div></div>
        <div class="card"><div class="card-pad text-center"><i class="fas fa-file-csv" style="font-size:34px;color:#1d4ed8;margin-bottom:10px;display:block"></i><h3 style="margin-bottom:6px">Export CSV</h3><p class="text-muted text-small mb-3">Untuk dibuka di aplikasi lain</p><a class="btn btn-ghost btn-block" href="${API.exportCsv(urlQ ? '?' + urlQ : '')}"><i class="fas fa-file-arrow-down"></i> Download .csv</a></div></div>
      </div>

      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h3><i class="fas fa-file-import text-emas mr-1"></i>Import CSV Massal</h3></div><div class="card-body">
          <p class="text-muted text-small mb-3">Impor banyak arsip sekaligus dari berkas CSV dengan kolom: <b>Nomor Arsip; Judul; Perihal; Tanggal; Kategori; Jenis; Instansi; Lokasi; Status</b>.</p>
          <form onsubmit="App.importCSV(event)" data-role="admin">
            <input type="file" name="file" accept=".csv,.txt" class="field" style="padding:8px" required>
            <button class="btn btn-primary btn-block mt-2" type="submit" data-role="admin"><i class="fas fa-upload"></i> Import</button>
          </form>
        </div></div>
        ${App.roleOf() === 'admin' ? `<div class="card"><div class="card-head"><h3><i class="fas fa-database text-emas mr-1"></i>Cadangan Database (Backup)</h3></div><div class="card-body text-center">
          <p class="text-muted text-small mb-3">Unduh seluruh data (profil, pengguna, arsip, disposisi, peminjaman, agenda, log) dalam satu berkas JSON.</p>
          <a class="btn btn-gold" href="${API.backup()}"><i class="fas fa-download"></i> Unduh Backup JSON</a>
        </div></div>` : ''}
      </div>

      <div class="card mt-4"><div class="card-head"><h3><i class="fas fa-table text-emas mr-1"></i>Pratinjau Rekap (${UI.fmtNumber(rows.length)})</h3></div>
        <div class="card-body"><table class="tbl"><thead><tr><th>#</th><th>No Arsip</th><th>Judul</th><th>Tanggal</th><th>Kategori</th><th>Jenis</th><th>Instansi</th><th>Status</th></tr></thead><tbody>${rows.slice(0, 100).map((r, i) => `<tr><td class="row-num">${i + 1}</td><td class="wrap-main">${UI.esc(r.nomor_arsip)}</td><td>${UI.esc(r.judul)}${r.perihal ? '<div class="wrap-sub">' + UI.esc(r.perihal) + '</div>' : ''}</td><td>${r.tanggal ? UI.fmtDate(r.tanggal) : '-'}</td><td>${UI.esc(r.kategori || '-')}</td><td>${jenisBadge(r.jenis)}</td><td>${UI.esc(r.nama_instansi || '-')}</td><td>${statusBadge(r.status)}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty"><b>Tidak ada data</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    el.querySelectorAll('[data-role]').forEach((n) => { if (App.roleOf() !== 'admin') n.style.display = 'none'; });
  }

  // ---- cetak laporan ber-kop surat ----
  function modalCetak() {
    cetakDo();
  }
  async function cetakDo() {
    const [rows, p] = await Promise.all([(async () => { const k = store.laporan; const q = [k.jenis ? 'jenis=' + k.jenis : '', k.dari ? 'dari=' + k.dari : '', k.sampai ? 'sampai=' + k.sampai : ''].filter(Boolean).join('&'); return API.rekap(q); })(), loadPengaturan()]);
    if (!rows.length) return UI.toast('Tidak ada data untuk dicetak.', 'error');
    const dariS = store.laporan.dari ? UI.fmtDate(store.laporan.dari) : '-';
    const sppS = store.laporan.sampai ? UI.fmtDate(store.laporan.sampai) : '-';
    const now = new Date();
    const footer = document.createElement('div');
    const mk = `di <b>${UI.esc(p.kota || '')}</b>, tanggal ${now.getDate()} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][now.getMonth()]} ${now.getFullYear()}`;
    let rowsHtml = rows.map((r, i) => `<tr><td style="border:1px solid #000;padding:6px">${i + 1}</td><td style="border:1px solid #000;padding:6px">${UI.esc(r.nomor_arsip)}</td><td style="border:1px solid #000;padding:6px">${UI.esc(r.perihal || r.judul)}</td><td style="border:1px solid #000;padding:6px">${r.tanggal ? UI.esc(r.tanggal) : '-'}</td><td style="border:1px solid #000;padding:6px">${UI.esc(r.kategori || '-')}</td><td style="border:1px solid #000;padding:6px">${UI.esc(r.status)}</td></tr>`).join('');
    footer.innerHTML = `
    <div class="card"><div class="card-body">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px">
        <div style="font-size:20px;font-weight:800;letter-spacing:.3px">${UI.esc(p.nama_kantor || 'KANTOR PERTANAHAN')}</div>
        ${p.alamat ? `<div style="font-size:12px">${UI.esc(p.alamat)}</div>` : ''}
        ${p.email || p.telepon ? `<div style="font-size:12px">${UI.esc(p.email || '')} ${p.telepon ? '· Telp. ' + UI.esc(p.telepon) : ''}</div>` : ''}
      </div>
      <div style="text-align:center;margin-bottom:16px;font-weight:600">REKAP ARSIP</div>
      <div style="font-size:12px;margin-bottom:8px">Periode: ${UI.esc(dariS)} s/d ${UI.esc(sppS)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="border:1px solid #000;padding:6px">No</th><th style="border:1px solid #000;padding:6px">Nomor Arsip</th><th style="border:1px solid #000;padding:6px">Perihal / Judul</th><th style="border:1px solid #000;padding:6px">Tanggal</th><th style="border:1px solid #000;padding:6px">Kategori</th><th style="border:1px solid #000;padding:6px">Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div style="text-align:right;margin-top:32px;font-size:12px">${mk}<br><br><div style="height:48px"></div><b>${UI.esc(p.nama_kepala || '')}</b><br>${UI.esc(p.jabatan_kepala || '')}<br>NIP. ${UI.esc(p.nip_kepala || '-')}</div>
    </div></div>`;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Rekap Arsip</title><style>@media print{body{-webkit-print-color-adjust:exact}}body{font-family:Arial,sans-serif;padding:20px}</style></head><body></body></html>`);
    win.document.body.appendChild(footer.firstElementChild);
    setTimeout(() => { win.print(); }, 300);
  }

  // ================= MASTER =================
  async function renderMaster(el) {
    const tab = store.master.tab;
    const [kats, loks, unit, insts] = await Promise.all([loadKategori(), loadLokasi(), loadUnit(), loadInstansi()]);
    const tabBtn = (id, ico, label) => `<button class="${tab === id ? 'active' : ''}" onclick="masterTab('${id}')"><i class="fas ${ico}"></i> ${label}</button>`;
    let body = '';
    if (tab === 'kategori') {
      body = `<div class="card">
        <div class="card-head"><h3>Kategori Arsip</h3>${App.roleOf() === 'admin' ? `<button class="btn btn-primary btn-sm" onclick="App.modalMaster('kategori',null)"><i class="fas fa-plus"></i> Tambah</button>` : ''}</div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama Kategori</th><th>Keterangan</th><th>Arsip</th>${App.roleOf() === 'admin' ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${kats.map((x) => `<tr><td class="wrap-main">${UI.esc(x.kode)}</td><td>${UI.esc(x.nama_kategori)}</td><td>${UI.esc(x.keterangan || '-')}</td><td><span class="badge badge-teal">${x.jumlah}</span></td>${App.roleOf() === 'admin' ? `<td><div class="flex" style="gap:4px"><button class="icon-btn" onclick="App.modalMaster('kategori',${x.id})"><i class="fas fa-pen"></i></button><button class="icon-btn danger" onclick="App.hapusMaster('kategori',${x.id},'${UI.esc(x.kode)}')"><i class="fas fa-trash-can"></i></button></div></td>` : ''}</tr>`).join('') || `<tr><td colspan="5"><div class="empty"><b>Belum ada kategori</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    } else if (tab === 'lokasi') {
      body = `<div class="card"><div class="card-head"><h3>Lokasi Penyimpanan</h3></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama Lokasi</th><th>Keterangan</th><th>Arsip</th></tr></thead><tbody>${loks.map((x, i) => `<tr><td class="row-num">${i + 1}</td><td class="wrap-main">${UI.esc(x.nama_lokasi)}</td><td>${UI.esc(x.keterangan || '-')}</td><td><span class="badge badge-teal">${x.jumlah}</span></td></tr>`).join('') || `<tr><td colspan="4"><div class="empty"><b>Kosong</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    } else if (tab === 'unit') {
      body = `<div class="card"><div class="card-head"><h3>Unit / Bidang</h3></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama Unit</th><th>Arsip</th></tr></thead><tbody>${unit.map((x, i) => `<tr><td class="row-num">${i + 1}</td><td class="wrap-main">${UI.esc(x.nama_unit)}</td><td><span class="badge badge-teal">${x.jumlah}</span></td></tr>`).join('') || `<tr><td colspan="3"><div class="empty"><b>Kosong</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    } else if (tab === 'instansi') {
      body = `<div class="card"><div class="card-head"><h3>Instansi Pengirim / Penerima</h3></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nama Instansi</th><th>Jenis</th><th>Alamat</th><th>Arsip</th></tr></thead><tbody>${insts.map((x, i) => `<tr><td class="row-num">${i + 1}</td><td class="wrap-main">${UI.esc(x.nama_instansi)}</td><td>${UI.esc(x.jenis)}</td><td class="wrap-sub">${UI.esc(x.alamat || '-')}</td><td><span class="badge badge-teal">${x.jumlah}</span></td></tr>`).join('') || `<tr><td colspan="5"><div class="empty"><b>Kosong</b></div></td></tr>`}</tbody></table></div>
      </div>`;
    }
    el.innerHTML = `
      ${pageHead('Master Data', 'Referensi kategori, lokasi, unit, dan instansi.', ``)}
      <div class="tabs">${tabBtn('kategori', 'fa-folder-tree', 'Kategori')}${tabBtn('lokasi', 'fa-box-archive', 'Lokasi')}${tabBtn('unit', 'fa-building', 'Unit')}${tabBtn('instansi', 'fa-building-columns', 'Instansi')}</div>
      ${body}`;
    el.querySelectorAll('.card-head .icon-btn').forEach(() => {});
  }

  // ================= PENGGUNA =================
  async function renderPengguna(el) {
    let rows = [];
    try { rows = await API.users(); } catch (e) { UI.toastError(e); }
    const roleLbl = { admin: ['Administrator', 'badge-gold'], staf: ['Staf', 'badge-teal'], kepala: ['Kepala', 'badge-green'] };
    el.innerHTML = `
      ${pageHead('Manajemen Pengguna', 'Kelola akun pengguna sistem.', `<button class="btn btn-primary" onclick="App.modalUser(null)"><i class="fas fa-user-plus"></i> Tambah Pengguna</button>`)}
      <div class="card">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Pengguna</th><th>Peran</th><th>Jabatan</th><th>Status</th><th>Terakhir Login</th><th>Aksi</th></tr></thead>
        <tbody>${rows.map((u, i) => `<tr><td class="row-num">${i + 1}</td><td><div class="flex items-center" style="gap:10px"><div style="width:34px;height:34px;border-radius:50%;background:var(--hijau-100);color:var(--hijau-700);display:flex;align-items:center;justify-content:center;font-weight:700">${UI.esc((u.nama_lengkap || '?').charAt(0))}</div><div><b class="text-small">${UI.esc(u.nama_lengkap)}</b><div class="wrap-sub">@${UI.esc(u.username)}</div></div></div></td><td><span class="badge ${(roleLbl[u.role] || [u.role, 'badge-gray'])[1]}">${(roleLbl[u.role] || [u.role, 'badge-gray'])[0]}</span></td><td>${UI.esc(u.jabatan || '-')}</td><td>${u.status === 1 ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td><td>${UI.relTime(u.last_login)}</td><td><div class="flex" style="gap:4px">${u.username !== 'admin' ? `<button class="icon-btn" onclick="App.modalUser(${u.id})"><i class="fas fa-pen"></i></button><button class="icon-btn danger" onclick="App.hapusUser(${u.id}, '${UI.esc(u.username)}')"><i class="fas fa-user-slash"></i></button>` : '<span class="badge badge-gray">akun utama</span>'}</div></td></tr>`).join('')}</tbody></table></div>
      </div>`;
  }

  // ================= LOG =================
  async function renderLog(el) {
    let rows = [];
    try { rows = await API.log(); } catch (e) { UI.toastError(e); }
    const modIco = { auth: 'fa-key', arsip: 'fa-folder-open', disposisi: 'fa-right-left', peminjaman: 'fa-hand-holding', kegiatan: 'fa-calendar', master: 'fa-database', pengaturan: 'fa-building-columns', pengguna: 'fa-users', laporan: 'fa-file-chart-column', sistem: 'fa-gear' };
    el.innerHTML = `
      ${pageHead('Log Aktivitas', 'Riwayat seluruh aktivitas pengguna dalam sistem.', ``)}
      <div class="card">
        <div class="card-head"><h3><i class="fas fa-list-check text-emas mr-1"></i>Riwayat (${UI.fmtNumber(rows.length)})</h3>${App.roleOf() === 'admin' ? '' : ''}</div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Waktu</th><th>Pengguna</th><th>Modul</th><th>Aksi</th><th>Detail</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td class="row-num">${i + 1}</td><td>${UI.fmtDateTime(r.created_at)}</td><td>${UI.esc(r.username || 'sistem')}</td><td><span class="badge badge-gray"><i class="fas ${modIco[r.modul] || 'fa-gear'}"></i> ${UI.esc(r.modul || 'sistem')}</span></td><td class="wrap-main">${UI.esc(r.aksi)}</td><td class="wrap-sub">${UI.esc(r.detail || '')}</td></tr>`).join('') || `<tr><td colspan="6"><div class="empty"><i class="fas fa-list-check"></i><b>Belum ada aktivitas</b></div></td></tr>`}</tbody></table></div>
      </div>`;
  }

  // ================= PROFIL =================
  async function renderProfil(el) {
    let p = {};
    try { p = await API.pengaturan(); } catch (e) { /* ignore */ }
    const fval = (v) => UI.esc(v || '');
    el.innerHTML = `
      ${pageHead('Profil Kantor & Kop Surat', 'Identitas instansi yang dipakai pada cetakan laporan ber-kop.', ``)}
      <div class="card" style="max-width:860px">
        <div class="card-pad">
          <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:14px;margin-bottom:20px;color:#000">
            <div style="font-size:22px;font-weight:800;letter-spacing:.4px">${fval(p.nama_kantor)}</div>
            <div style="font-size:12px;color:#555">${fval(p.alamat)}</div>
            <div style="font-size:12px;color:#555">${fval(p.email)} ${p.telepon ? '· Telp. ' + fval(p.telepon) : ''} ${p.website ? '· ' + fval(p.website) : ''}</div>
          </div>
          <form id="prof-form" onsubmit="App.saveProfil(event)">
            <div class="form-2col">
              <div class="form-row"><label>Nama Kantor</label><input class="field" name="nama_kantor" value="${fval(p.nama_kantor)}"></div>
              <div class="form-row"><label>Singkatan / Kode</label><input class="field" name="singkatan" value="${fval(p.singkatan)}"></div>
              <div class="form-row" style="grid-column:span 2"><label>Alamat</label><input class="field" name="alamat" value="${fval(p.alamat)}"></div>
              <div class="form-row"><label>Kota</label><input class="field" name="kota" value="${fval(p.kota)}"></div>
              <div class="form-row"><label>Kode Kantor</label><input class="field" name="kode_kantor" value="${fval(p.kode_kantor)}"></div>
              <div class="form-row"><label>Telepon</label><input class="field" name="telepon" value="${fval(p.telepon)}"></div>
              <div class="form-row"><label>Email</label><input class="field" name="email" value="${fval(p.email)}"></div>
              <div class="form-row"><label>Website</label><input class="field" name="website" value="${fval(p.website)}"></div>
              <div class="form-row" style="grid-column:span 2"><hr></div>
              <div class="form-row"><label>Nama Kepala Kantor</label><input class="field" name="nama_kepala" value="${fval(p.nama_kepala)}"></div>
              <div class="form-row"><label>NIP Kepala</label><input class="field" name="nip_kepala" value="${fval(p.nip_kepala)}"></div>
              <div class="form-row" style="grid-column:span 2"><label>Jabatan Kepala</label><input class="field" name="jabatan_kepala" value="${fval(p.jabatan_kepala)}"></div>
            </div>
            <div class="flex justify-between mt-4" style="gap:10px"><button type="button" class="btn btn-outline" onclick="App.modalCetak()"><i class="fas fa-print"></i> Uji Cetak Kop</button><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Profil</button></div>
          </form>
        </div>
      </div>`;
  }

  // ---------- dispatch ----------
  function go(view, el) {
    destroyCharts();
    el.innerHTML = `<div class="text-center mt-5" style="padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:26px;color:var(--hijau-600)"></i></div>`;
    switch (view) {
      case 'dashboard': return renderDashboard(el);
      case 'arsip': return renderArsip(el);
      case 'trash': return renderTrash(el);
      case 'disposisi': return renderDisposisi(el);
      case 'peminjaman': return renderPeminjaman(el);
      case 'agenda': return renderAgenda(el);
      case 'kalender': return renderKalender(el);
      case 'laporan': return renderLaporan(el);
      case 'master': return renderMaster(el);
      case 'pengguna': return renderPengguna(el);
      case 'log': return renderLog(el);
      case 'profil': return renderProfil(el);
      default: return renderDashboard(el);
    }
  }

  return {
    go, store, destroyCharts,
    renderArsip,
    jenisBadge, statusBadge, modalCetak,
  };
})();
window.Views = Views;

// ---- helpers global untuk event inline ----
let _deb;
function debounce(fn, ms) { clearTimeout(_deb); _deb = setTimeout(fn, ms || 450); }
function store(section, key, val) { const o = Views.store[section] || (Views.store[section] = {}); o[key] = val; }
function storeAs(key, val) { store('arsip', key, val); Views.renderArsip(); }
function resetArsipFilter() { store('arsip', 'query', ''); store('arsip', 'page', 1); store('arsip', 'jenis', ''); store('arsip', 'status', ''); store('arsip', 'kategori', ''); store('arsip', 'instansi', ''); Views.renderArsip(); }
function pageArsip(p) { store('arsip', 'page', p); Views.renderArsip(); }
function refreshArsip() { Views.store.arsip.page = 1; Views.renderArsip(); }
function dispFilter(v) { store('disposisi', 'filter', v); Views.go('disposisi', document.getElementById('content')); }
function pinjamFilter(v) { store('peminjaman', 'filter', v); Views.go('peminjaman', document.getElementById('content')); }
function agendaTahun(v) { store('agenda', 'tahun', v); Views.go('agenda', document.getElementById('content')); }
function agendaJenis(v) { store('agenda', 'jenis', v); Views.go('agenda', document.getElementById('content')); }
function masterTab(t) { store('master', 'tab', t); Views.go('master', document.getElementById('content')); }
function laporanField(k, v) { store('laporan', k, v); Views.go('laporan', document.getElementById('content')); }
function kalBulan(dir) { const prev = Views.store.kalenderBln || new Date().toISOString().slice(0, 7); const p = prev.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + dir, 1); Views.store.kalenderBln = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; Views.go('kalender', document.getElementById('content')); }
function kalHariIni() { Views.store.kalenderBln = null; Views.go('kalender', document.getElementById('content')); }