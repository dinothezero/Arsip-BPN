function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('errors/forbidden', {
    title: 'Akses Ditolak',
    user: req.session.user
  });
}

function isKepala(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role === 'kepala' || req.session.user.role === 'admin')) {
    return next();
  }
  return res.status(403).render('errors/forbidden', {
    title: 'Akses Ditolak',
    user: req.session.user
  });
}

module.exports = { isAuthenticated, isAdmin, isKepala };