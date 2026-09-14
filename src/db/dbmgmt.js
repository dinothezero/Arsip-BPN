'use strict';

/*
 * Manajemen database: penjelajah tabel, penampil skema, konsol SQL,
 * edit baris, backup/restore. Hanya boleh diakses oleh role admin.
 * Seluruh operasi pengubah struktur (DDL) otomatis dicadangkan dulu.
 */

const path = require('path');
const fs = require('fs');
const { db, DB_PATH, UPLOAD_DIR, BACKUP_DIR, RESTORE_DIR } = require('./db');
const { rebuildFts } = require('./init');

// Tabel inti yang tidak boleh dihapus lewat konsol DDL
const PROTECTED_TABLES = new Set([
  'users', 'pengaturan', 'log', 'arsip', 'arsip_fts',
  'disposisi', 'peminjaman', 'agenda', 'data_' /* vb prefix none */,
]);
const FTS_PREFIXES = ['arsip_fts'];

function isSystemTable(name) {
  return name.startsWith('sqlite_') || FTS_PREFIXES.some((p) => name.startsWith(p));
}

function cleanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null;
}

function listTables() {
  const rows = db.prepare(`
    SELECT name, type, sql FROM sqlite_master
    WHERE type IN ('table') AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  return rows.map((t) => {
    let count = 0, page = 0;
    try {
      if (!isSystemTable(t.name)) {
        count = db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get().n;
      }
    } catch (e) { count = -1; }
    try {
      const st = db.prepare(`PRAGMA table_info("${t.name}")`);
      page = (st.all()[0] && db.prepare('PRAGMA page_count').get().c) || 0;
    } catch (e) { /* skip */ }
    return { name: t.name, type: t.type, jumlah: count, sql: t.sql || '', system: isSystemTable(t.name) || t.name.startsWith('sqlite_') };
  });
}

function tableInfo(name) {
  const ok = cleanName(name);
  if (!ok) return null;
  const meta = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  if (!meta) return null;
  const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
  const indexes = db.prepare(`PRAGMA index_list("${name}")`).all().map((ix) => {
    let cols2 = [];
    try { cols2 = db.prepare(`PRAGMA index_info("${ix.name}")`).all().map((c) => c.name); } catch (e) { /* */ }
    return { ...ix, columns: cols2 };
  });
  let fks = [];
  try { fks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all(); } catch (e) { /* */ }
  let triggers = [];
  try { triggers = db.prepare(`SELECT name, tbl_name FROM sqlite_master WHERE type='trigger' AND tbl_name=?`).all(name); } catch (e) { /* */ }
  const pkCols = cols.filter((c) => c.pk > 0);
  return {
    name, sql: meta.sql, columns: cols, indexes, fks, triggers,
    isSystem: isSystemTable(name),
    isProtected: PROTECTED_TABLES.has(name),
    pk: pkCols.map((c) => c.name),
    hasRowId: !meta.sql.toUpperCase().includes('WITHOUT ROWID'),
  };
}

function browseTable(name, { limit, offset, where }) {
  const info = tableInfo(name);
  if (!info) return { error: 'Tabel tidak ditemukan.' };
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const off = parseInt(offset, 10) || 0;
  let whereSql = '';
  const params = [];
  if (where && where.trim()) {
    // Hanya izinkan pencarian LIKE sederhana
    if (/^[A-Za-z0-9_]+ LIKE /.test(where.trim())) {
      whereSql = ' WHERE ' + where.trim().split(' LIKE ').map((x, i) => (i === 0 ? '"' + x.replace(/"/g, '') + '"' : x)).join(' LIKE ');
    } else {
      return { error: 'Filter hanya mendukung format: kolom LIKE pola' };
    }
  }
  try {
    const total = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"${whereSql}`).get(...params).n;
    const cols = info.columns.filter((c) => !isSystemTable(name) || c.name !== 'rowid');
    const rows = db.prepare(`SELECT * FROM "${name}"${whereSql} LIMIT ? OFFSET ?`).all(...params, lim, off);
    return { info, columns: cols, rows, total, limit: lim, offset: off };
  } catch (e) {
    return { error: e.message };
  }
}

// ---------- Konsol SQL ----------
const READ_RE = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i;
const WRITE_RE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
const DDL_RE = /^\s*(CREATE|ALTER|DROP|RENAME|TRUNCATE|VACUUM|REINDEX|ANALYZE|ATTACH|DETACH|PRAGMA\s+.*=|BEGIN|COMMIT|ROLLBACK)\b/i;

function classifySql(sql) {
  if (!sql || !sql.trim()) return 'kosong';
  if (/^\s*(--|\/\*)/.test(sql)) return 'komentar';
  if (READ_RE.test(sql)) return 'read';
  if (WRITE_RE.test(sql)) return 'write';
  if (DDL_RE.test(sql)) return 'ddl';
  return 'other';
}

// Deteksi obyek terlarang (sistem) di dalam pernyataan DDL/DML.
// Literal string & komentar disamarkan dulu agar value seperti 'log system'
// tidak memicu pemblokiran palsu; identifier berpetik ganda tetap terdeteksi.
function refersToProtected(sql) {
  let masked = sql
    .replace(/'(''|[^'])*'/g, (m) => ' '.repeat(m.length)) // literal string
    .replace(/--[^\n]*/g, ' ')                            // komentar baris
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length)); // komentar blok
  const blocked = [];
  for (const n of PROTECTED_TABLES) {
    const re = new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (re.test(masked)) blocked.push(n);
  }
  return blocked;
}

function backupNow(label = 'manual') {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
  const safe = String(label).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'manual';
  const base = path.join(BACKUP_DIR, `db-${safe}-${stamp}`);
  let file = `${base}.db`;
  let n = 2;
  while (fs.existsSync(file)) file = `${base}-${n++}.db`;
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  pruneBackups();
  return path.basename(file);
}

function pruneBackups(keep = 10) {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
    while (files.length > keep) {
      const del = path.join(BACKUP_DIR, files.shift());
      try { fs.unlinkSync(del); } catch (e) { /* */ }
    }
  } catch (e) { /* */ }
}

function listBackups() {
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db'))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { file: f, size: st.size, mtime: st.mtime.toISOString() };
    }).sort((a, b) => b.file.localeCompare(a.file));
}

function runSql(sql, mode) {
  const type = classifySql(sql);
  if (type === 'kosong') return { error: 'SQL kosong.' };
  if (type === 'komentar') return { note: 'Hanya komentar — tidak dieksekusi.' };

  if (mode === 'read' && type !== 'read') {
    return { error: 'Mode Baca hanya mengizinkan SELECT / PRAGMA / EXPLAIN. Ubah mode menjadi Tulis atau DDL terlebih dahulu.' };
  }
  if (mode === 'write' && !['read', 'write'].includes(type)) {
    return { error: 'Mode Tulis hanya mengizinkan SELECT / INSERT / UPDATE / DELETE.' };
  }
  // mode ddl = boleh semua

  if (mode !== 'read' && type !== 'read') {
    const blocked = refersToProtected(sql);
    if (blocked.length) {
      return { error: `Pernyataan menyentuh tabel inti yang dilindungi (${blocked.join(', ')}). Operasi ini ditolak demi keamanan data.` };
    }
  }
  if (mode === 'ddl' && type === 'ddl') {
    // Cadangkan otomatis sebelum perubahan struktur
    try { backupNow('ddl'); } catch (e) { return { error: 'Gagal membuat cadangan sebelum DDL: ' + e.message }; }
  }

  const t0 = Date.now();
  try {
    if (type === 'read') {
      const stmt = db.prepare(sql);
      let rows = [];
      try { rows = stmt.all() || []; } catch (e) { rows = []; }
      let description = null;
      try { description = stmt.columns ? stmt.columns() : null; } catch (e) { /* */ }
      return { mode: 'read', type, columns: description || null, rows, changes: db.prepare('SELECT total_changes() AS c').get().c, elapsed: Date.now() - t0 };
    }
    if (type === 'write') {
      const r = db.prepare(sql).run();
      return { mode: mode, type, changes: r.changes, lastId: r.lastInsertRowid, elapsed: Date.now() - t0 };
    }
    if (type === 'ddl') {
      db.exec(sql);
      if (/vacuum/i.test(sql)) { /* ok */ }
      rebuildFts();
      return { mode: 'ddl', type: 'ddl', changes: db.prepare('SELECT total_changes() AS c').get().c, elapsed: Date.now() - t0, note: 'Struktur berhasil diubah. Indeks teks penuh disinkronkan ulang.' };
    }
    db.exec(sql);
    return { mode: mode, type: 'other', changes: db.prepare('SELECT total_changes() AS c').get().c, elapsed: Date.now() - t0, note: 'Dieksekusi.' };
  } catch (e) {
    return { error: e.message };
  }
}

// ---------- Edit baris ----------
function getPk(info) {
  if (info.pk.length) return info.pk;
  return ['rowid'];
}

function rowExists(name, pk) {
  const info = tableInfo(name);
  if (!info) return false;
  const cols = getPk(info);
  const where = cols.map((c) => `"${c}" = ?`).join(' AND ');
  try { return !!db.prepare(`SELECT 1 FROM "${name}" WHERE ${where}`).get(...pk); } catch (e) { return false; }
}

function insertRow(name, data) {
  const info = tableInfo(name);
  if (!info) return { error: 'Tabel tidak ditemukan.' };
  if (info.isProtected) return { error: 'Tabel inti tidak boleh diubah lewat penjelajah data. Gunakan menu resminya.' };
  const cols = info.columns.map((c) => c.name).filter((c) => c !== 'id' || !info.pk.length);
  const keys = Object.keys(data).filter((k) => cols.includes(k));
  if (!keys.length) return { error: 'Tidak ada kolom valid untuk disisipkan.' };
  const placeholders = keys.map(() => '?').join(', ');
  const quoted = keys.map((k) => `"${k}"`).join(', ');
  const ins = db.prepare(`INSERT INTO "${name}" (${quoted}) VALUES (${placeholders})`);
  try {
    const r = ins.run(...keys.map((k) => data[k]));
    if (info.name === 'arsip') rebuildFts();
    return { ok: true, id: r.lastInsertRowid };
  } catch (e) { return { error: e.message }; }
}

function updateRow(name, pk, data) {
  const info = tableInfo(name);
  if (!info) return { error: 'Tabel tidak ditemukan.' };
  if (info.isProtected) return { error: 'Tabel inti tidak boleh diubah lewat penjelajah data.' };
  const pks = getPk(info);
  if (pks.length !== pk.length) return { error: 'Kunci utama tidak valid.' };
  const setKeys = Object.keys(data).filter((k) => !pks.includes(k));
  // Jika data kosong cuma berisi kunci, artinya tidak ada perubahan lain
  if (!setKeys.length) return { ok: true, note: 'Tidak ada kolom lain untuk diubah.' };
  const sets = setKeys.map((k) => `"${k}" = ?`).join(', ');
  const where = pks.map((c, i) => `"${c}" = ?`).join(' AND ');
  try {
    const r = db.prepare(`UPDATE "${name}" SET ${sets} WHERE ${where}`).run(...setKeys.map((k) => data[k]), ...pk);
    if (info.name === 'arsip') rebuildFts();
    return { ok: true, changes: r.changes };
  } catch (e) { return { error: e.message }; }
}

function deleteRow(name, pk) {
  const info = tableInfo(name);
  if (!info) return { error: 'Tabel tidak ditemukan.' };
  if (info.isProtected) return { error: 'Tabel inti tidak boleh dihapus lewat penjelajah data.' };
  const pks = getPk(info);
  if (pks.length !== pk.length) return { error: 'Kunci utama tidak valid.' };
  const where = pks.map((c, i) => `"${c}" = ?`).join(' AND ');
  try {
    const r = db.prepare(`DELETE FROM "${name}" WHERE ${where}`).run(...pk);
    if (info.name === 'arsip') rebuildFts();
    return { ok: true, changes: r.changes };
  } catch (e) { return { error: e.message }; }
}

// ---------- Integritas & util ----------
function integrityCheck() {
  const quick = db.prepare('PRAGMA integrity_check(10)').all();
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  const ok = quick.every((r) => r.integrity_check === 'ok');
  return { ok, checks: quick, foreignKeyIssues: fk };
}

function vacuum() {
  try { db.exec('VACUUM'); return { ok: true }; } catch (e) { return { error: e.message }; }
}

function downloadDbCopy() {
  const tmp = path.join(BACKUP_DIR, `unduh-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  return tmp;
}

// ---------- Restore JSON (gabung ke database aktif) ----------
function restoreFromJson(obj) {
  const r = { inserted: {}, skipped: {}, errors: [] };
  if (!obj || typeof obj !== 'object') return { error: 'Format backup JSON tidak valid.' };

  const beginFn = () => {
    try { db.exec('BEGIN'); } catch (e) { /* sudah dalam transaksi */ }
  };
  const commitFn = () => { try { db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); } };
  const insertSafe = (table, cols, vals) => {
    try {
      const ins = db.prepare(`INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      const r2 = ins.run(...vals);
      if (Number(r2.changes) === 1) r.inserted[table] = (r.inserted[table] || 0) + 1;
      return true;
    } catch (e) { r.errors.push(`${table}: ${e.message}`); return false; }
  };

  beginFn();
  try {
    // pengaturan (menimpa bila ada)
    if (obj.pengaturan) {
      try { db.prepare('DELETE FROM pengaturan').run(); db.prepare('INSERT INTO pengaturan (id) VALUES (1)').run(); } catch (e) {}
      const keys = Object.keys(obj.pengaturan).filter((k) => k !== 'id');
      if (keys.length) {
        try {
          db.prepare(`UPDATE pengaturan SET ${keys.map((k) => `"${k}"=?`).join(',')} WHERE id=1`).run(...keys.map((k) => obj.pengaturan[k]));
          r.inserted.pengaturan = 1;
        } catch (e) { r.errors.push('pengaturan: ' + e.message); }
      }
    }

    // master data
    for (const [table, keyCol, nameCol] of [['kategori', 'kode', 'nama_kategori'], ['lokasi', 'nama_lokasi', 'nama_lokasi'], ['unit', 'nama_unit', 'nama_unit'], ['instansi', 'nama_instansi', 'nama_instansi']]) {
      if (!Array.isArray(obj[table]) || !obj[table].length) continue;
      for (const row of obj[table]) {
        if (row[keyCol]) insertSafe(table, [keyCol, nameCol], [row[keyCol], row[nameCol] || '']);
      }
    }

    // kegiatan, agenda, disposisi, peminjaman (tanpa mengikat user asing — pakai NULL bila tak ada)
    const straight = (table, cols, src) => insertSafe(table, cols, src.map((x) => (x === undefined ? null : (x === null ? null : x))));
    if (Array.isArray(obj.kegiatan)) for (const k of obj.kegiatan) {
      straight('kegiatan', ['tanggal', 'jam_mulai', 'jam_selesai', 'judul', 'jenis', 'lokasi', 'keterangan', 'selesai'], [k.tanggal, k.jam_mulai, k.jam_selesai, k.judul, k.jenis, k.lokasi, k.keterangan, k.selesai ? 1 : 0]);
    }
    if (Array.isArray(obj.agenda)) for (const k of obj.agenda) {
      straight('agenda', ['tahun', 'jenis', 'nomor_urut', 'arsip_id', 'tanggal'], [k.tahun, k.jenis, k.nomor_urut, k.arsip_id || null, k.tanggal]);
    }
    if (Array.isArray(obj.disposisi)) for (const k of obj.disposisi) {
      straight('disposisi', ['arsip_id', 'dari_user_id', 'ke_user_id', 'instruksi', 'catatan', 'tanggal', 'status'], [k.arsip_id, k.dari_user_id, k.ke_user_id, k.instruksi, k.catatan, k.tanggal, k.status || 'proses']);
    }
    if (Array.isArray(obj.peminjaman)) for (const k of obj.peminjaman) {
      straight('peminjaman', ['arsip_id', 'peminjam', 'unit_peminjam', 'tanggal_pinjam', 'jatuh_tempo', 'tanggal_kembali', 'status', 'keterangan'], [k.arsip_id, k.peminjam, k.unit_peminjam, k.tanggal_pinjam, k.jatuh_tempo, k.tanggal_kembali, k.status || 'dipinjam', k.keterangan]);
    }

    // arsip (levati is_deleted lama, selalu aktif bila kosong)
    if (Array.isArray(obj.arsip)) {
      let katMap = {};
      try { katMap = Object.fromEntries(db.prepare('SELECT kode, id FROM kategori').all().map((x) => [x.kode, x.id])); } catch (e) {}
      for (const ar of obj.arsip) {
        if (!ar.nomor_arsip || !ar.judul) { r.errors.push('arsip: nomor/judul kosong'); continue; }
        const kategoriId = ar.kategori_id || katMap[ar.kategori_kode] || null;
        const instId = ar.instansi_id || null;
        const unitId = ar.unit_id || null;
        const lokId = ar.lokasi_id || null;
        const cols = ['nomor_arsip', 'kategori_id', 'jenis', 'judul', 'perihal', 'tanggal', 'tahun_arsip', 'instansi_id', 'unit_id', 'lokasi_id', 'status', 'file_name', 'keterangan', 'ocr_text'];
        const vals = [ar.nomor_arsip, kategoriId, ar.jenis || 'surat-masuk', ar.judul, ar.perihal || '', ar.tanggal || '', ar.tahun_arsip || (ar.tanggal || '').slice(0, 4), instId, unitId, lokId, ar.status || 'aktif', ar.file_name || '', ar.keterangan || '', ar.ocr_text || ''];
        insertSafe('arsip', cols, vals);
      }
    }

    // users — JANGAN masukkan ulang password; buat akun aktif biasa bila belum ada
    if (Array.isArray(obj.users)) {
      for (const u of obj.users) {
        if (!u.username) continue;
        const ada = db.prepare('SELECT id FROM users WHERE username=?').get(u.username);
        if (ada) continue;
        try {
          const hash = require('bcryptjs').hashSync(u.password || 'password123', 10);
          db.prepare('INSERT INTO users (username, password_hash, nama_lengkap, nip, jabatan, role, status) VALUES (?,?,?,?,?,?,?)')
            .run(u.username, hash, u.nama_lengkap || u.username, u.nip || '', u.jabatan || '', ['admin', 'staf', 'kepala'].includes(u.role) ? u.role : 'staf', u.status === 0 ? 0 : 1);
          r.inserted.users = (r.inserted.users || 0) + 1;
        } catch (e) { r.errors.push('users: ' + e.message); }
      }
    }

    commitFn();
    rebuildFts();
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (e2) { /* */ }
    return { error: 'Restore gagal: ' + e.message };
  }
}

// Simpan berkas .db hasil upload untuk restorasi manual (kemudian ganti data/arsip-bpn.db saat app dimatikan)
function saveRestoreFile(filePath) {
  const fileName = path.basename(filePath);
  const dest = path.join(RESTORE_DIR, fileName);
  fs.copyFileSync(filePath, dest);
  return dest;
}

module.exports = {
  PROTECTED_TABLES,
  listTables, tableInfo, browseTable,
  runSql, classifySql, backupNow, listBackups, pruneBackups,
  insertRow, updateRow, deleteRow,
  integrityCheck, vacuum, downloadDbCopy,
  restoreFromJson, saveRestoreFile,
};