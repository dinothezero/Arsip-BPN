'use strict';
/* Fitur tambahan v3: OCR dokumen (scan), Cari Isi Dokumen (FTS), dan Kelola Database (admin).
   Semua OCR berjalan di browser, 100% offline tanpa biaya. */

/* ================================ OCR ================================ */
const OCR = (() => {
  const LANG_DIR = '/vendor/tesseract/lang/';
  const CORE_DIR = '/vendor/tesseract/core/';
  const WORKER_PATH = '/vendor/tesseract/worker.min.js';
  const PDFJS_PATH = '/vendor/pdfjs/pdf.min.mjs';
  const PDF_WORKER = '/vendor/pdfjs/pdf.worker.min.mjs';
  const MAX_PAGE = 20;

  let worker = null;

  function el(id) { return document.getElementById(id); }
  function show(id, on) { const n = el(id); if (n) n.classList.toggle('hidden', !on); }
  function progress(pct, txt) {
    const fill = el('ocr-fill'); const lbl = el('ocr-txt');
    if (fill) fill.style.width = Math.min(100, Math.round(pct)) + '%';
    if (lbl) lbl.textContent = txt || Math.min(100, Math.round(pct)) + '%';
  }
  function hasTesseract() {
    if (typeof Tesseract === 'undefined') {
      UI.toast('Mesin OCR belum termuat. Muat ulang halaman lalu coba lagi.', 'error');
      return false;
    }
    return true;
  }

  // Buat worker sekali pakai per pemindaian (ekonomis memori: terminate setelah selesai)
  async function getWorker(lang) {
    if (!hasTesseract()) throw new Error('OCR tidak tersedia.');
    const opts = {
      workerPath: WORKER_PATH,
      corePath: CORE_DIR,
      langPath: LANG_DIR,
      logger: (m) => {
        if (m.status === 'recognizing text') progress(28 + (m.progress || 0) * 68, Math.round(m.progress * 100) + '%');
        else if (m.status === 'loading language traineddata') progress(12, 'Memuat model bahasa…');
        else if (m.status === 'initializing api') progress(8, 'Menyiapkan mesin OCR…');
        else if (m.status === 'loading tesseract core') progress(4, 'Memuat inti OCR…');
      },
    };
    return await Tesseract.createWorker(lang, 1, opts);
  }

  async function pdfToText(blob) {
    const pdfjs = await import(PDFJS_PATH);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const pages = Math.min(doc.numPages, MAX_PAGE);
    progress(2, 'Menyiapkan PDF…');
    let text = '';
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const scale = 1.7;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(vp.width, 2400);
      canvas.height = Math.round(canvas.width * (vp.height / vp.width));
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: canvas.width / vp.width }) }).promise;
      const img = canvas.toDataURL('image/jpeg', 0.92);
      if (!worker) worker = await getWorker(currentLang());
      const res = await worker.recognize(img);
      text += `\n\n===== HALAMAN ${p} =====\n\n` + (res.data.text || '');
      progress(5 + (p / pages) * 20, `Memindai halaman ${p}/${pages}…`);
    }
    return { text, pages };
  }

  async function imageToText(blob) {
    const url = URL.createObjectURL(blob);
    try {
      worker = await getWorker(currentLang());
      const res = await worker.recognize(url);
      return { text: res.data.text || '', pages: 1 };
    } finally { URL.revokeObjectURL(url); }
  }

  function currentLang() {
    const s = el('ocr-lang'); return s ? s.value : 'ind';
  }

  function showPreview(html) {
    const p = el('ocr-preview');
    if (p) p.innerHTML = html;
  }

  async function start(blob, fileName) {
    if (!blob) return;
    show('ocr-progress', true);
    progress(1, 'Membaca berkas…');
    const ext = (fileName || '').toLowerCase();
    const t0 = Date.now();
    let text = ''; let pages = 1;
    try {
      if (/\.(pdf)$/.test(ext)) {
        const r = await pdfToText(blob); text = r.text; pages = r.pages;
      } else if (/\.(txt|csv)$/.test(ext)) {
        text = await blob.text();
        progress(80, 'Berkas teks langsung dibaca');
      } else if (/\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/.test(ext)) {
        showPreview(`<div class="img-prev"><img src="${URL.createObjectURL(blob)}" alt="dokumen"></div>`);
        const r = await imageToText(blob); text = r.text; pages = r.pages;
      } else {
        throw new Error('Format berkas tidak didukung untuk scan. Gunakan PDF, gambar, TXT, atau CSV.');
      }
      // finalisasi worker
      if (worker) { try { await worker.terminate(); } catch (e) { /* */ } worker = null; }
      Modal._ocrDur = Date.now() - t0;
      Modal._ocrPages = pages;
      Modal._ocrMode = fileName === '__lampiran__' ? 'upload' : 'upload';
      progress(100, 'Selesai');
      const res = el('ocr-result');
      if (res) res.value = text;
      Modal._ocrGot = true;
      if (!text.trim()) {
        showPreview('<div class="empty" style="padding:22px"><i class="fas fa-triangle-exclamation"></i><b>Hasil kosong</b><span>Coba tingkatkan kualitas gambar, atau pilih bahasa lain.</span></div>');
      } else {
        showPreview(`<div class="img-ok"><i class="fas fa-circle-check"></i> Terbaca: ${String(text.trim().length).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} karakter${pages > 1 ? ` dari ${pages} halaman` : ''} (${(Modal._ocrDur / 1000).toFixed(1)} dtk)</div>`);
      }
    } catch (e) {
      if (worker) { try { await worker.terminate(); } catch (e2) { /* */ } worker = null; }
      progress(0, 'Gagal');
      UI.toast('OCR gagal: ' + e.message, 'error');
      showPreview(`<div class="empty" style="padding:22px"><i class="fas fa-circle-xmark"></i><b>OCR gagal</b><span>${UI.esc(e.message)}</span></div>`);
    }
  }

  async function pakaiFile(file) {
    if (!file) return;
    showPreview('<div class="empty" style="padding:22px"><i class="fas fa-spinner fa-spin"></i><b>Memproses ' + UI.esc(file.name) + '…</b></div>');
    await start(file, file.name);
  }

  async function pakaiLampiran(id) {
    showPreview('<div class="empty" style="padding:22px"><i class="fas fa-spinner fa-spin"></i><b>Mengambil lampiran arsip…</b></div>');
    try {
      let a = null;
      try { a = await API.arsipDetail(id); } catch (e) { /* */ }
      const resp = await fetch(API.download(id));
      if (!resp.ok) throw new Error('Lampiran tidak ditemukan pada arsip ini.');
      const blob = await resp.blob();
      const name = (a && a.file_name) ? a.file_name : 'lampiran.pdf';
      await start(blob, name);
    } catch (e) { UI.toastError(e); showPreview('<div class="empty" style="padding:22px"><i class="fas fa-folder-open"></i><b>Belum ada lampiran</b><span>Unggah gambar/PDF dulu pada arsip ini, atau pilih file untuk di-upload.</span></div>'); }
  }

  return { pakaiFile, pakaiLampiran };
})();
window.OCR = OCR;

/* ============================ CARI ISI DOKUMEN ============================ */
const SearchView = (() => {
  function pageHead(title, sub, toolbar) {
    return `<div class="page-head"><div><h1>${title}</h1><div class="sub">${sub}</div></div>${toolbar ? `<div class="page-toolbar">${toolbar}</div>` : ''}</div><div class="gov-stripe"><span class="gs1"></span><span class="gs2"></span><span class="gs3"></span><span class="gs4"></span></div>`;
  }
  async function render(container) {
    const q = (window.SearchView && window.SearchView._q) || '';
    container.innerHTML = `
      ${pageHead('Cari Isi Dokumen', 'Temukan arsip berdasarkan isi surat — termasuk hasil OCR seluruh dokumen.', '')}
      <div class="card card-pad">
        <div class="search" style="max-width:900px;margin:0 auto">
          <i class="fas fa-magnifying-glass"></i>
          <input class="field" id="sv-q" placeholder="Ketik kata atau frasa, misal: <b>mutasi pegawai</b>, <b>perpanjangan HGB</b>…" value="${UI.esc(q)}" onkeydown="if(event.key==='Enter') SearchView.cari()">
        </div>
        <div class="text-center mt-2 text-muted text-small"><i class="fas fa-scanner"></i> Pencarian menyeluruh ke seluruh isi arsip yang sudah di-scan (OCR). Kata di-highlight otomatis.</div>
        <div class="text-center mt-3"><button class="btn btn-primary" onclick="SearchView.cari()"><i class="fas fa-search"></i> Cari Sekarang</button></div>
      </div>
      <div id="sv-result" class="mt-4"></div>`;
    setTimeout(() => { const i = el('sv-q'); if (i) i.focus(); }, 150);
    if (q) this.cari();
  }
  function el(id) { return document.getElementById(id); }
  async function cari() {
    const q = (el('sv-q') || {}).value || '';
    if (!q.trim()) return UI.toast('Ketik kata kunci terlebih dahulu.', 'info');
    window.SearchView._q = q.trim();
    const box = el('sv-result');
    box.innerHTML = '<div class="text-center" style="padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--hijau-600)"></i></div>';
    try {
      const r = await API.search(q);
      if (!r.rows || !r.rows.length) {
        box.innerHTML = `<div class="empty"><i class="fas fa-magnifying-glass"></i><b>Tidak ada hasil untuk "${UI.esc(q)}"</b><span>Coba kata lain, atau scan dokumen lewat menu Arsip → tombol OCR.</span></div>`;
        return;
      }
      box.innerHTML = `
        <div class="card">
          <div class="card-head"><h3><i class="fas fa-list text-emas mr-1"></i>${r.rows.length} hasil untuk "&nbsp;${UI.esc(q)}&nbsp;"</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Arsip</th><th>Cuplikan isi</th><th>Kategori</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>${r.rows.map((a) => `
            <tr>
              <td class="wrap-main"><a class="link-arsip" onclick="App.modalDetail(${a.id})">${UI.esc(a.nomor_arsip)}</a><div class="wrap-sub">${UI.esc(a.judul)}</div></td>
              <td style="max-width:420px">${a.snip ? '<span class="ocrmark">' + a.snip + '</span>' : '<span class="text-muted">' + UI.esc((a.ocr_text || '').slice(0, 160)) + '…</span>'}</td>
              <td>${a.nama_kategori ? UI.esc(a.nama_kategori) : '-'}</td>
              <td>${a.tanggal ? UI.fmtDate(a.tanggal) : '-'}</td>
              <td><div class="flex" style="gap:4px"><button class="icon-btn" title="Buka" onclick="App.modalDetail(${a.id})"><i class="fas fa-eye"></i></button><button class="icon-btn" title="Scan/OCR" onclick="App.modalOcr(${a.id}, '${UI.esc(a.nomor_arsip)}')"><i class="fas fa-scanner"></i></button></div></td>
            </tr>`).join('')}</tbody></table></div>
        </div>`;
    } catch (e) { UI.toastError(e); box.innerHTML = ''; }
  }
  return { render, cari };
})();
window.SearchView = SearchView;

/* ============================ KELOLA DATABASE ============================ */
const DBView = (() => {
  const state = { tab: 'ringkasan', table: '', page: 0, limit: 50, where: '', sql: '', mode: 'read' };

  function pageHead(title, sub, toolbar) {
    return `<div class="page-head"><div><h1>${title}</h1><div class="sub">${sub}</div></div>${toolbar ? `<div class="page-toolbar">${toolbar}</div>` : ''}</div><div class="gov-stripe"><span class="gs1"></span><span class="gs2"></span><span class="gs3"></span><span class="gs4"></span></div>`;
  }
  function el(id) { return document.getElementById(id); }
  function fmtBytes(b) {
    const n = Number(b) || 0;
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB']; let i = -1; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(1) + ' ' + u[i];
  }

  async function render(container) {
    let d = { tables: [], storage: {}, backups: [], fts: true };
    try { d = await API.dbInfo(); } catch (e) { UI.toastError(e); }
    state.tables = d.tables || [];
    if (!state.table && state.tables.length) state.table = state.tables.find((t) => t.name === 'arsip') ? 'arsip' : state.tables[0].name;

    const tabs = [['ringkasan', 'fa-gauge-high', 'Ringkasan'], ['jelajah', 'fa-table-list', 'Penjelajah Data'], ['sql', 'fa-terminal', 'Konsol SQL']]
      .map((t) => `<button class="${state.tab === t[0] ? 'active' : ''}" onclick="DBView.tab('${t[0]}')"><i class="fas ${t[1]}"></i> ${t[2]}</button>`).join('');

    const protectedBadge = (sys) => sys ? '<span class="badge badge-red">inti</span>' : '';
    const tableRows = d.tables.map((t) => `
      <tr>
        <td class="wrap-main">${UI.esc(t.name)} ${protectedBadge(t.system)}</td>
        <td><span class="badge badge-gray">${UI.esc(t.type)}</span></td>
        <td><span class="badge badge-teal">${UI.fmtNumber(t.jumlah)}</span></td>
        <td class="wrap-sub" style="max-width:320px"><code class="sql-mini">${UI.esc((t.sql || '').replace(/\s+/g, ' ').slice(0, 120))}…</code></td>
        <td><div class="flex" style="gap:4px">
          <button class="icon-btn" title="Buka data" onclick="DBView.buka('${t.name}')"><i class="fas fa-table-list"></i></button>
          <button class="icon-btn" title="Lihat struktur" onclick="DBView.skema('${t.name}')"><i class="fas fa-code"></i></button>
        </div></td>
      </tr>`).join('');

    const st = d.storage || {};
    const backupRows = (d.backups || []).map((b) => `
      <tr>
        <td class="wrap-main">${UI.esc(b.file)}</td>
        <td>${fmtBytes(b.size)}</td>
        <td>${UI.fmtDateTime(b.mtime)}</td>
        <td><a class="btn btn-ghost btn-sm" href="${API.dbBackupFile(b.file)}"><i class="fas fa-download"></i> Unduh</a></td>
      </tr>`).join('') || '<tr><td colspan="4"><div class="empty" style="padding:18px"><b>Belum ada cadangan</b></div></td></tr>';

    container.innerHTML = `
      ${pageHead('Database & Cadangan', 'Kelola struktur (DDL), data, cadangan, dan pemulihan database lokal. Semua operasi dicatat.', `FTS: ${d.fts ? '<span class="badge badge-green">aktif</span>' : '<span class="badge badge-red">nonaktif</span>'}`)}
      <div class="tabs">${tabs}</div>
      <div id="db-body"></div>
      <div class="hidden" data-panel id="db-panel-ringkasan">
        <div class="grid grid-2" style="margin-bottom:20px">
          <div class="card"><div class="card-head"><h3><i class="fas fa-database text-emas mr-1"></i>Status Database</h3></div><div class="card-pad">
            <div class="mini-stats">
              ${[['Arsip', st.total_arsip, 'fa-folder-open', 'ic-teal'], ['Pengguna', st.total_user, 'fa-users', 'ic-blue'], ['Pemindaian OCR', st.total_pindai, 'fa-scanner', 'ic-green'], ['Log', st.total_log, 'fa-list-check', 'ic-gold']].map((x) => `<div class="mini"><div class="mi-icon ${x[3]}"><i class="fas ${x[2]}"></i></div><div class="mi-v">${UI.fmtNumber(x[1] || 0)}</div><div class="mi-l">${x[0]}</div></div>`).join('')}
            </div>
            <div class="flex justify-between text-small text-muted mt-3" style="padding-top:10px;border-top:1px solid var(--slate-200)">
              <span>Ukuran DB: <b>${fmtBytes(st.db_bytes)}</b></span><span>Lampiran: <b>${fmtBytes(st.file_bytes)}</b> (${st.file_konten || 0} berkas)</span>
            </div>
          </div></div>
          <div class="card"><div class="card-head"><h3><i class="fas fa-shield-halved text-emas mr-1"></i>Aksi Cadangan</h3></div><div class="card-pad">
            <div class="grid grid-2" style="gap:10px">
              <button class="btn btn-primary" onclick="DBView.buatBackup()"><i class="fas fa-copy"></i> Cadangkan Sekarang</button>
              <a class="btn btn-ghost" href="${API.dbDownload()}" onclick="DBView.toast('Membuat salinan .db…')"><i class="fas fa-download"></i> Unduh Salinan .db</a>
              <button class="btn btn-outline" onclick="DBView.integrity()"><i class="fas fa-stethoscope"></i> Cek Integritas</button>
              <button class="btn btn-outline" onclick="DBView.vacuum()"><i class="fas fa-box-archive"></i> Vacuum (kecilkan)</button>
              <button class="btn btn-outline" onclick="DBView.reindex()"><i class="fas fa-sync"></i> Perbarui Indeks Cari</button>
              <button class="btn btn-danger" onclick="DBView.restore()"><i class="fas fa-upload"></i> Pulihkan (Restore)</button>
            </div>
            <p class="text-muted text-small mt-3"><i class="fas fa-circle-info"></i> Cadangan otomatis dibuat tiap <b>24 jam</b> dan sebelum setiap perubahan struktur (DDL). 10 cadangan terakhir disimpan.</p>
          </div></div>
        </div>
        <div class="grid grid-2">
          <div class="card"><div class="card-head"><h3><i class="fas fa-table text-emas mr-1"></i>Tabel (${d.tables.length})</h3></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Tipe</th><th>Baris</th><th>Definisi</th><th>Aksi</th></tr></thead><tbody>${tableRows}</tbody></table></div>
          </div>
          <div class="card"><div class="card-head"><h3><i class="fas fa-clock-rotate-left text-emas mr-1"></i>Cadangan (.db)</h3><button class="btn btn-primary btn-sm" onclick="DBView.buatBackup()"><i class="fas fa-plus"></i> Baru</button></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Berkas</th><th>Ukuran</th><th>Waktu</th><th></th></tr></thead><tbody>${backupRows}</tbody></table></div>
          </div>
        </div>
      </div>
      <div class="hidden" data-panel id="db-panel-jelajah">
        <div class="filters card card-pad">
          <select class="field" onchange="DBView.pilih(this.value)">${state.tables.map((t) => `<option value="${UI.esc(t.name)}" ${state.table === t.name ? 'selected' : ''}>${UI.esc(t.name)}${t.system ? ' (inti)' : ''}</option>`).join('')}</select>
          <input class="field" id="db-where" placeholder="Filter: nama_kolom LIKE pola" value="${UI.esc(state.where)}">
          <button class="btn btn-outline" onclick="DBView.browsing(0)"><i class="fas fa-filter"></i> Terapkan</button>
          <button class="btn btn-primary" onclick="DBView.baru()"><i class="fas fa-plus"></i> Tambah Baris</button>
          <button class="btn btn-ghost" onclick="DBView.skema(state.table)"><i class="fas fa-code"></i> Struktur</button>
          <span class="badge badge-gold" id="db-count"></span>
        </div>
        <div class="card"><div class="table-wrap" id="db-rows"></div><div class="pagination" id="db-pag"></div></div>
      </div>
      <div class="hidden" data-panel id="db-panel-sql">
        <div class="card card-pad">
          <div class="flex items-center" style="gap:10px;margin-bottom:10px">
            <label class="text-muted text-small"><i class="fas fa-shield"></i> Mode:</label>
            <select class="field" id="db-mode" style="max-width:180px" onchange="DBView.mode(this.value)">
              <option value="read" ${state.mode === 'read' ? 'selected' : ''}>Baca (SELECT)</option>
              <option value="write" ${state.mode === 'write' ? 'selected' : ''}>Tulis (INSERT/UPDATE/DELETE)</option>
              <option value="ddl" ${state.mode === 'ddl' ? 'selected' : ''}>DDL (CREATE/ALTER/DROP)</option>
            </select>
            <span class="text-muted text-small">DDL otomatis dicadangkan &amp; mengunci tabel inti sistem.</span>
          </div>
          <textarea class="field" id="db-sql" rows="8" style="font-family:monospace;font-size:13px" placeholder="Tulis pernyataan SQL…&#10;contoh:&#10;CREATE TABLE inventaris (id INTEGER PRIMARY KEY, nama TEXT, jumlah INTEGER);&#10;INSERT INTO inventaris (nama, jumlah) VALUES ('Rak A1', 120);&#10;SELECT * FROM inventaris;">${UI.esc(state.sql || '')}</textarea>
          <div class="flex justify-between mt-3"><button class="btn btn-primary" onclick="DBView.jalankan()"><i class="fas fa-play"></i> Jalankan</button><span class="text-muted text-small" id="db-sqlinfo"></span></div>
        </div>
        <div class="card mt-4"><div class="card-head"><h3><i class="fas fa-table-list text-emas mr-1"></i>Hasil</h3></div><div class="table-wrap" id="db-sqlresult"></div></div>
      </div>`;
    this.tab(state.tab);
  }

  function tab(t) {
    state.tab = t;
    document.querySelectorAll('[data-panel]').forEach((n) => n.classList.add('hidden'));
    const p = el('db-panel-' + t);
    if (p) p.classList.remove('hidden');
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach((b) => { if (b.onclick && String(b.onclick) === 'onclick="DBView.tab(\'' + t + '\')"') b.classList.add('active'); });
    if (t === 'jelajah') this.browsing(state.page);
    if (t === 'sql') setTimeout(() => { const i = el('db-sql'); if (i) i.focus(); }, 100);
  }

  function mode(m) { state.mode = m; }
  function pilih(name) { state.table = name; state.page = 0; state.where = ''; this.browsing(0); }
  function buka(name) { state.table = name; state.tab = 'jelajah'; this.render(el('content')); }
  function toast(msg, t) { UI.toast(msg, t); }

  async function browsing(page) {
    state.page = page || 0;
    const where = (el('db-where') || {}).value || '';
    state.where = where;
    const box = el('db-rows');
    const cnt = el('db-count');
    const pag = el('db-pag');
    box.innerHTML = '<div class="text-center" style="padding:40px"><i class="fas fa-spinner fa-spin"></i></div>';
    cnt.textContent = '';
    pag.innerHTML = '';
    try {
      const q = 'limit=' + state.limit + '&offset=' + (state.page * state.limit) + (where ? '&where=' + encodeURIComponent(where) : '');
      const d = await API.dbTable(state.table, q);
      if (d.error) throw new Error(d.error);
      const protectedT = d.info && d.info.isProtected;
      const cols = d.columns.map((c) => c.name);
      cnt.textContent = d.total + ' baris';
      const pks = (d.info && d.info.pk && d.info.pk.length) ? d.info.pk : (d.info && d.info.hasRowId ? ['rowid'] : []);
      const cell = (v) => {
        if (v === null || v === undefined) return '<span class="text-muted">NULL</span>';
        const s = String(v);
        if (s.length > 80) return '<code class="sql-mini" title="' + UI.esc(s) + '">' + UI.esc(s.slice(0, 80)) + '…</code>';
        return UI.esc(s);
      };
      box.innerHTML = `
        <table class="tbl"><thead><tr><th>#</th>${cols.map((c) => `<th>${UI.esc(c)}</th>`).join('')}${protectedT ? '' : '<th>Aksi</th>'}</tr></thead>
        <tbody>${d.rows.length ? d.rows.map((r, i) => `<tr><td class="row-num">${state.page * state.limit + i + 1}</td>${cols.map((c) => `<td>${cell(r[c])}</td>`).join('')}${protectedT ? '' : `<td><div class="flex" style="gap:4px"><button class="icon-btn" title="Ubah" onclick="DBView.editRow(${i})"><i class="fas fa-pen"></i></button><button class="icon-btn danger" title="Hapus" onclick="DBView.hapusRow(${i})"><i class="fas fa-trash-can"></i></button></div></td>`}</tr>`).join('') : `<tr><td colspan="${cols.length + (protectedT ? 1 : 2)}"><div class="empty" style="padding:24px"><b>Tabel kosong</b>${protectedT ? '' : ' — klik "Tambah Baris".'}</div></td></tr>`}</tbody></table>`;
      window._dbData = { rows: d.rows, cols, pks, info: d.info };
      const pages = Math.ceil(d.total / state.limit);
      if (pages > 1) {
        pag.innerHTML = `Halaman ${state.page + 1}/${pages} <button ${state.page <= 0 ? 'disabled' : ''} onclick="DBView.browsing(${state.page - 1})"><i class="fas fa-chevron-left"></i></button><button ${state.page >= pages - 1 ? 'disabled' : ''} onclick="DBView.browsing(${state.page + 1})"><i class="fas fa-chevron-right"></i></button>`;
      }
    } catch (e) { box.innerHTML = `<div class="empty" style="padding:30px"><i class="fas fa-circle-exclamation"></i><b>${UI.esc(e.message)}</b></div>`; }
  }

  async function skema(name) {
    try {
      const d = await API.dbTable(name, 'limit=1');
      const info = d.info;
      if (!info) return UI.toast('Tabel tidak ditemukan.', 'error');
      const fkH = (info.fks || []).map((f) => `<div class="wrap-sub">${UI.esc(f.from)} → ${UI.esc(f.table)}.${UI.esc(f.to)}${f.on_delete ? ' (ON DELETE ' + UI.esc(f.on_delete) + ')' : ''}</div>`).join('');
      const ixH = (info.indexes || []).map((ix) => `<div class="wrap-sub"><i class="fas fa-index"></i> ${UI.esc(ix.name)} (${ix.unique ? 'UNIQUE' : ix.origin}) → ${UI.esc(ix.columns.join(', '))}</div>`).join('');
      const trH = (info.triggers || []).map((t2) => `<div class="wrap-sub"><i class="fas fa-bolt"></i> ${UI.esc(t2.name)}</div>`).join('');
      Modal.open({
        title: 'Struktur · ' + UI.esc(name), lg: true,
        body: `
          <div class="form-row"><label>CREATE TABLE</label><pre class="sql-pre">${UI.esc(info.sql || '')}</pre></div>
          <div class="grid grid-2">
            <div class="kvp"><div class="k">Kunci Utama</div><div class="v">${info.pk.length ? info.pk.join(', ') : '(tidak ada — gunakan rowid)'}</div><div class="k">ROWID</div><div class="v">${info.hasRowId ? 'ada' : 'tidak'}</div><div class="k">Tabel Inti</div><div class="v">${info.isProtected ? 'YA — dilindungi' : 'tidak'}</div><div class="k">Kolom</div><div class="v">${info.columns.length}</div></div>
            <div class="kvp"><div class="k">Index</div><div class="v">${ixH || '-'}</div><div class="k">Foreign Key</div><div class="v">${fkH || '-'}</div><div class="k">Trigger</div><div class="v">${trH || '-'}</div></div>
          </div>
          <p class="text-muted text-small mt-3"><i class="fas fa-circle-info"></i> Untuk mengubah struktur gunakan <b>Konsol SQL</b> mode <b>DDL</b>. Tabel inti (arsip, users, pengaturan, log, dll.) otomatis dikunci.</p>`,
        footer: `<button class="btn btn-outline" onclick="Modal.close()">Tutup</button>`,
        lg: true,
      });
    } catch (e) { UI.toastError(e); }
  }

  function valFor(col, v) {
    const s = String(v == null ? '' : v);
    const t = (col.type || '').toUpperCase();
    if (s === '') return null;
    if (/INT/.test(t) && /^-?\d+$/.test(s)) return Number(s);
    if (/REAL/.test(t) && isFinite(s) && s.trim() !== '') return Number(s);
    return s;
  }

  function editRow(i) {
    const d = window._dbData;
    if (!d || !d.rows[i]) return;
    const r = d.rows[i];
    window._dbRow = r;
    const rows = d.cols.filter((c) => !d.pks.includes(c)).map((c) => {
      const col = d.info.columns.find((x) => x.name === c);
      const isBig = /TEXT|CLOB/.test((col && col.type) || '') && r[c] && String(r[c]).length > 120;
      return `<div class="form-row" style="grid-column:span 2"><label>${UI.esc(c)} <span class="text-muted">(${UI.esc((col && col.type) || '?')}${col && !col.notnull ? ', boleh kosong' : ''})</span></label>${isBig ? `<textarea class="field" name="${c}" rows="3">${UI.esc(r[c] || '')}</textarea>` : `<input class="field" name="${c}" value="${UI.esc(r[c] == null ? '' : r[c])}">`}</div>`;
    }).join('');
    const pkLbl = d.pks.map((c) => `<b>${UI.esc(c)} = ${UI.esc(r[c])}</b>`).join(' · ');
    Modal.open({
      title: 'Ubah Baris · ' + UI.esc(state.table), lg: true,
      body: `<div class="text-muted text-small mb-3">Kunci: ${pkLbl}</div><form id="db-edit-form" onsubmit="return false"><div class="form-2col">${rows}</div></form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="DBView.simpanEdit()"><i class="fas fa-save"></i> Simpan</button>`,
    });
  }

  async function simpanEdit() {
    const d = window._dbData;
    const f = el('db-edit-form');
    if (!f || !d || !window._dbRow) return;
    const row = window._dbRow;
    const data = {};
    d.pks.forEach((c) => { data[c] = row[c]; });
    d.cols.filter((c) => !d.pks.includes(c)).forEach((c) => {
      const inp = f.querySelector('[name="' + c + '"]');
      const col = d.info.columns.find((x) => x.name === c);
      if (inp) data[c] = valFor(col, inp.value);
    });
    try {
      await API.dbRowUpdate(state.table, d.pks.map((c) => row[c]), data);
      UI.toast('Baris diperbarui.');
      Modal.close();
      this.browsing(state.page);
    } catch (e) { UI.toastError(e); }
  }

  function hapusRow(i) {
    const d = window._dbData;
    if (!d) return;
    const r = d.rows[i];
    window._dbRow = r;
    Modal.open({
      title: 'Hapus Baris',
      body: `<p>Hapus baris dengan kunci <b>${UI.esc(d.pks.map((c) => c + '=' + r[c]).join(', '))}</b> dari tabel <b>${UI.esc(state.table)}</b>? Tindakan ini permanen.</p>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-danger" onclick="DBView.dohapusRow()"><i class="fas fa-trash-can"></i> Hapus</button>`,
    });
  }
  async function dohapusRow() {
    const d = window._dbData;
    const r = window._dbRow;
    try {
      const pk = d.info.isProtected ? [] : d.pks;
      await API.dbRowDelete(state.table, pk.map((c) => r[c]));
      UI.toast('Baris dihapus.');
      Modal.close();
      this.browsing(state.page);
    } catch (e) { UI.toastError(e); }
  }

  async function baru() {
    const d = await API.dbTable(state.table, 'limit=1').catch(() => null);
    if (!d || d.error || !d.info) return UI.toast('Tidak dapat membuka tabel.', 'error');
    if (d.info.isProtected) return UI.toast('Tabel inti tidak bisa ditambah lewat penjelajah data.', 'error');
    const rows = d.columns.map((c) => {
      const isPk = d.info.pk.includes(c.name) && /INT/.test((c.type || '').toUpperCase()) && (c.name === 'id');
      if (isPk) return '';
      const auto = /AUTOINCREMENT/i.test(d.info.sql || '') && d.info.pk.includes(c.name) ? true : false;
      if (auto) return '';
      const isBig = /TEXT|CLOB/.test((c.type || '').toUpperCase());
      return `<div class="form-row" style="grid-column:span 2"><label>${UI.esc(c.name)} <span class="text-muted">(${UI.esc(c.type || 'any')}${c.notnull ? ' · wajib' : ''})</span></label>${isBig ? `<textarea class="field" name="${c.name}" rows="2"></textarea>` : `<input class="field" name="${c.name}">`}</div>`;
    }).join('');
    Modal.open({
      title: 'Tambah Baris · ' + UI.esc(state.table), lg: true,
      body: `<form id="db-edit-form" onsubmit="return false" data-idx=""><div class="form-2col">${rows}</div></form>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="DBView.simpanBaru()"><i class="fas fa-plus"></i> Tambah</button>`,
    });
  }

  async function simpanBaru() {
    const d = await API.dbTable(state.table, 'limit=1');
    const f = el('db-edit-form');
    const data = {};
    d.columns.forEach((c) => {
      const inp = f.querySelector('[name="' + c.name + '"]');
      if (inp) data[c.name] = valFor(c, inp.value);
    });
    try {
      await API.dbRowInsert(state.table, data);
      UI.toast('Baris baru ditambahkan.');
      Modal.close();
      this.browsing(0);
    } catch (e) { UI.toastError(e); }
  }

  async function jalankan() {
    const sql = (el('db-sql') || {}).value || '';
    if (!sql.trim()) return UI.toast('Tulis SQL terlebih dahulu.', 'info');
    state.sql = sql;
    const infoLbl = el('db-sqlinfo');
    const out = el('db-sqlresult');
    infoLbl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    out.innerHTML = '';
    try {
      const r = await API.dbQuery(sql, state.mode);
      if (r.error) throw new Error(r.error);
      infoLbl.textContent = `OK · ${r.elapsed} md` + (r.type !== 'read' && r.changes ? ' · ' + r.changes + ' perubahan' : '') + (r.lastId ? ' · id baru=' + r.lastId : '') + (r.note ? ' · ' + r.note : '');
      if (r.type === 'read' && Array.isArray(r.rows)) {
        const cols = (r.columns && r.columns.length) ? r.columns.map((c) => c.name) : (r.rows[0] ? Object.keys(r.rows[0]) : []);
        out.innerHTML = `<table class="tbl"><thead><tr>${cols.map((c) => `<th>${UI.esc(c)}</th>`).join('')}</tr></thead><tbody>${r.rows.length ? r.rows.slice(0, 500).map((row) => `<tr>${cols.map((c) => `<td>${UI.esc(row[c])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length || 1}"><div class="empty" style="padding:16px"><b>0 baris</b></div></td></tr>`}</tbody></table>`;
      } else {
        out.innerHTML = `<div class="empty" style="padding:20px"><i class="fas fa-circle-check"></i><b>Berhasil dieksekusi.</b><span>${r.note || ''}</span></div>`;
      }
    } catch (e) {
      infoLbl.textContent = '';
      out.innerHTML = `<div class="empty" style="padding:20px"><i class="fas fa-circle-xmark"></i><b>SQL error</b><span>${UI.esc(e.message)}</span></div>`;
    }
  }

  async function buatBackup() {
    try { const r = await API.dbBackup(); UI.toast('Cadangan dibuat: ' + r.file); setTimeout(() => this.render(el('content')), 600); } catch (e) { UI.toastError(e); }
  }
  async function integrity() {
    try {
      const r = await API.dbIntegrity();
      if (r.ok && !r.foreignKeyIssues.length) UI.toast('Integritas database OK.');
      else {
        const n = (r.foreignKeyIssues || []).length;
        UI.toast((r.ok ? 'FK: ' : '') + 'Integritas bermasalah (' + n + ' pelanggaran FK, lihat tepi konsol).', 'error');
      }
      setTimeout(() => this.render(el('content')), 600);
    } catch (e) { UI.toastError(e); }
  }
  async function vacuum() {
    try { const r = await API.dbVacuum(); r.error ? UI.toastError(r) : UI.toast('Vacuum selesai, database dikecilkan.'); } catch (e) { UI.toastError(e); }
  }
  async function reindex() {
    try { const r = await API.reindex(); UI.toast('Indeks pencarian diperbarui: ' + r.terindeks + ' arsip.'); } catch (e) { UI.toastError(e); }
  }
  function restore() {
    Modal.open({
      title: 'Pulihkan Database', lg: true,
      body: `<p class="text-muted text-small mb-3">Pilih berkas cadangan:</p>
        <ul class="text-small mb-3" style="list-style:inside;line-height:1.9">
          <li><b>.json</b> — backup dari menu Laporan → digabung otomatis ke database aktif (aman).</li>
          <li><b>.db</b> / <b>.sql</b> — salinan penuh; disimpan ke folder restore untuk diterapkan saat aplikasi dimatikan.</li>
        </ul>
        <label class="drop-zone"><input type="file" id="f-restore" accept=".json,.db,.sql" onchange="DBView.doRestore(this)"><i class="fas fa-upload"></i> Pilih berkas cadangan</label>
        <div id="re-stat" class="text-muted text-small mt-2"></div>`,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">Tutup</button>`,
    });
  }
  async function doRestore(inp) {
    if (!inp.files[0]) return;
    const st = el('re-stat'); st.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah…';
    const fd = new FormData(); fd.append('file', inp.files[0]);
    try {
      const r = await API.dbRestore(fd);
      if (r.error) throw new Error(r.error);
      st.innerHTML = '<span style="color:var(--hijau-700)">Selesai.</span>';
      UI.toast(r.note ? 'Berkas diterima.' : 'Restore selesai: ' + (r.inserted && r.inserted.arsip ? r.inserted.arsip + ' arsip baru.' : 'OK.'));
      if (r.note) { Modal.close(); this.render(el('content')); }
    } catch (e) {
      st.innerHTML = '<span style="color:#dc2626">' + UI.esc(e.message) + '</span>';
    }
  }

  return { render, tab, mode, pilih, buka, browsing, skema, editRow, simpanEdit, hapusRow, dohapusRow, baru, simpanBaru, jalankan, buatBackup, integrity, vacuum, reindex, restore, doRestore, toast };
})();
window.DBView = DBView;