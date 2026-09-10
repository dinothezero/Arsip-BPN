# 📁 Sistem Arsip Digital BPN

Sistem pengelolaan arsip digital lengkap untuk **Kantor Pertanahan / Badan Pertanahan Nasional (BPN)**. Dibangun sebagai *full-stack web application* dengan stack 100% gratis (zero cost).

## ✨ Fitur Utama

| Modul | Deskripsi |
|-------|-----------|
| 📊 **Dashboard** | Statistik lengkap, grafik surat 6 bulan, status surat, aktivitas terbaru |
| 📥 **Surat Masuk** | Registrasi, upload file, status tracking, nomor agenda otomatis |
| 📤 **Surat Keluar** | Registrasi, approval kepala, status `Draft → Disetujui → Dikirim → Selesai` |
| 🔀 **Disposisi Surat** | Penerusan surat ke seksi/unit, prioritas (Segera/Penting/Biasa) |
| 📦 **Arsip Dokumen** | Kode arsip otomatis per kategori, lokasi rak/box, upload file |
| 📜 **Sertifikat Tanah** | Data sertifikat (HM/HGB/HP/dll), NIK, luas, letak, letter C, status |
| 📈 **Laporan** | Rekap tahun berjalan, laporan surat masuk/keluar/sertifikat/arsip, cetak |
| 👥 **Manajemen User** | Peran admin / kepala / user, reset password, akun aktif/nonaktif |
| 🗂️ **Kategori Surat** | Kelola kategori surat sesuai kebutuhan kantor |
| 🛡️ **Log Aktivitas** | Rekam jejak seluruh aktivitas pengguna dengan filter & paginasi |
| 💾 **Backup Database** | Backup manual database sekali klik |

## 🛠️ Teknologi (Semua Gratis)

- **Backend**: Node.js + Express.js
- **Database**: SQLite (`better-sqlite3`) — tanpa server, file lokal
- **Template**: EJS dengan Tailwind CSS
- **Chart**: Chart.js
- **Session**: express-session + connect-sqlite3
- **Password**: bcryptjs (hashing)

## 🚀 Cara Menjalankan

### Prasyarat
- **Node.js** versi 18+ → unduh gratis di [nodejs.org](https://nodejs.org)

### Langkah
```bash
# 1. Masuk ke folder project
cd bpn-arsip

# 2. Install dependencies
npm install

# 3. Inisialisasi database (akun default dibuat otomatis)
npm run init-db

# 4. Jalankan server
npm start
```

Buka browser → **http://localhost:3000**

### Akun Default

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Kepala | `kepala` | `kepala123` |

> ⚠️ **Ubah password default setelah pemasangan!**

## 🔧 Konfigurasi

| Variable | Deskripsi |
|----------|-----------|
| `PORT` | Port server (default: `3000`) |
| `SESSION_SECRET` | Secret key session (opsional) |

## 📁 Struktur Project

```
bpn-arsip/
├── server.js              # Entry point aplikasi
├── database/
│   ├── init.js            # Inisialisasi schema + akun default
│   └── bpn-arsip.db       # Database SQLite (generated)
├── routes/                # Handler route tiap modul
├── middleware/            # Auth + upload file
├── views/                 # Template EJS
├── public/                # CSS & JS statis
├── uploads/               # File upload (surat/arsip/sertifikat)
└── backup/                # Hasil backup database
```

## 📌 Catatan Penting

- **Zero cost** — semua library open source & gratis
- **File upload** tersimpan lokal di folder `uploads/` (maks. 20MB per file)
- **Backup otomatis direkomendasikan** — jalankan menu *Pengaturan → Backup Database* secara berkala
- Untuk produksi LAN kantor: jalankan `npm start` pada PC server, akses dari PC lain via IP LAN

---

Dibuat untuk kebutuhan Kantor Pertanahan 😊