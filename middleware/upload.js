const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function storageFor(dest) {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const fullPath = path.join(__dirname, '..', 'uploads', dest);
      ensureDir(fullPath);
      cb(null, fullPath);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const fancyName = crypto.randomBytes(10).toString('hex') + ext;
      cb(null, fancyName);
    }
  });
}

function fileFilter(req, file, cb) {
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip', '.rar'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan!'));
  }
}

const uploadSuratMasuk = multer({
  storage: storageFor('surat-masuk'),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadSuratKeluar = multer({
  storage: storageFor('surat-keluar'),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadArsip = multer({
  storage: storageFor('arsip'),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const uploadSertifikat = multer({
  storage: storageFor('sertifikat'),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = {
  uploadSuratMasuk,
  uploadSuratKeluar,
  uploadArsip,
  uploadSertifikat
};