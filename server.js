const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./database/init');

if (process.argv.includes('--init-db')) {
  initDatabase();
  process.exit(0);
}

initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(require('express-ejs-layouts'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'arsip-bpn-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.formatTanggal = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  res.locals.formatTanggalShort = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  res.locals.formatRupiah = (num) => {
    if (!num && num !== 0) return '-';
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };
  next();
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/surat-masuk', require('./routes/suratMasuk'));
app.use('/surat-keluar', require('./routes/suratKeluar'));
app.use('/arsip', require('./routes/arsip'));
app.use('/sertifikat', require('./routes/sertifikat'));
app.use('/disposisi', require('./routes/disposisi'));
app.use('/laporan', require('./routes/laporan'));
app.use('/pengaturan', require('./routes/pengaturan'));
app.use('/logs', require('./routes/logs'));

app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Halaman Tidak Ditemukan',
    user: req.session.user
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', {
    title: 'Terjadi Kesalahan',
    user: req.session.user,
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║   SISTEM ARSIP DIGITAL BPN - RUNNING     ║`);
  console.log(`╠════════════════════════════════════════════╣`);
  console.log(`║  URL      : http://localhost:${PORT}                 ║`);
  console.log(`║  Admin    : admin / admin123              ║`);
  console.log(`║  Kepala   : kepala / kepala123            ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});

module.exports = app;