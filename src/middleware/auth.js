'use strict';

const bcrypt = require('bcryptjs');
const Q = require('../db/queries');
const { writeLog } = require('../db/queries');

// Multer upload config sudah di routes/api.js

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    const user = Q.findUserById(req.session.userId);
    if (user && user.status === 1) {
      req.user = user;
      return next();
    }
    req.session.destroy(() => { res.status(401).json({ error: 'Sesi tidak valid atau akun nonaktif.' }); });
    return;
  }
  res.status(401).json({ error: 'Harus login terlebih dahulu.' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk aksi ini.' });
  };
}

function isAdmin(req) { return req.user && req.user.role === 'admin'; }

function logAction(req, aksi, modul, detail) {
  try { writeLog(req.user, aksi, modul, detail, req.ip); } catch (e) { /* ignore */ }
}

module.exports = { requireAuth, requireRole, isAdmin, logAction, bcrypt };