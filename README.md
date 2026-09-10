# 📁 Sistem Arsip Digital — Kantor Pertanahan (v2 Lokal)

Aplikasi pengelolaan arsip digital untuk **Kantor Pertanahan / BPN**. Berjalan **100% lokal** di satu komputer atau LAN kantor — tanpa internet, tanpa biaya lisensi, tanpa akun cloud.

## ✨ Modul

| Modul | Deskripsi |
|-------|-----------|
| 📊 **Dashboard** | Statistik arsip, grafik tren 6 bulan, grafik status, grafik kategori |
| 📦 **Arsip Dokumen** | Registrasi, upload file, nomor arsip otomatis per kategori, kategori/lokasi/unit/instansi, QR code, cari & filter, edit, hapus lunak/permanen |
| 🗑️ **Tempat Sampah** | Pulihkan atau hapus permanen; kosongkan sampah |
| 🔀 **Disposisi** | Penerusan arsip ke unit/seksi, tanda baca, prioritas |
| 📤 **Peminjaman** | Catat peminjaman & pengembalian arsip |
| 📖 **Buku Agenda** | Agenda surat masuk & keluar, nomor agenda otomatis |
| 📅 **Kalender** | Kalender aktivitas arsip |
| 📈 **Laporan & Ekspor** | Rekap arsip, cetak ber-kop surat, ekspor CSV / Excel (XLSX), backup database (JSON) |
| 🗂️ **Master Data** | Kategori, lokasi rak, unit/seksi, instansi |
| 👥 **Manajemen Pengguna** | Akun admin / staf / kepala, aktif/nonaktif, reset password |
| 🛡️ **Log Aktivitas** | Rekam jejak aktivitas pengguna |
| 👤 **Profil Kantor** | Kop surat untuk cetak laporan |

## 🛠️ Teknologi (Semua Gratis)

- **Backend**: Node.js + Express.js
- **Database**: SQLite bawaan Node (`node:sqlite`) — tanpa server, tanpa instalasi tambahan
- **Frontend**: Single-Page Application vanilla JS + CSS kustom, font offline (Lora + Plus Jakarta Sans), Chart.js lokal
- **Session**: express-session + bcryptjs

## 🚀 Cara Menjalankan

### Prasyarat
- **Node.js 22.5 atau lebih baru** (mendukung `node:sqlite`) → unduh gratis di [nodejs.org](https://nodejs.org)

### Linux / macOS / Terminal
```bash
cd arsip-bpn
npm install      # sekali saja
npm start        # buka http://localhost:3000
```

Database + akun default dibuat otomatis saat pertama kali dijalankan.

### Windows (klik dua kali)
1. Install Node.js dari [nodejs.org](https://nodejs.org)
2. **Klik dua kali `start.bat`** (menjalankan `npm install` bila perlu, lalu memulai server)
3. Buka **http://localhost:3000**

> Jalankan `npm run seed` untuk mengisi 8 arsip contoh (opsional). Hapus `data/arsip-bpn.db` untuk memulai dari nol.

### Akun Default

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Staf | `staff1` | `password123` |
| Kepala | `kepala1` | `password123` |

> ⚠️ **Ubah password setelah pemasangan** (menu profil → Ganti Password).

## 🔧 Konfigurasi

| Variable | Deskripsi |
|----------|-----------|
| `PORT` | Port server (default: `3000`) |

## 📁 Struktur Project

```
arsip-bpn/
├── start.bat            # Jalankan di Windows (klik dua kali)
├── src/
│   ├── server.js        # Entry point server
│   ├── db/              # Koneksi, skema, query, seed contoh
│   └── routes/          # API REST
├── public/
│   ├── index.html       # SPA shell
│   ├── css/ style.css   # Tampilan
│   ├── js/ app.js, views.js, api.js, ui.js
│   ├── fonts/           # Font offline (Lora, Plus Jakarta Sans)
│   └── vendor/chart.js  # Chart.js lokal (offline)
├── data/                # Database + upload (dibuat otomatis, tidak di-git)
│   ├── arsip-bpn.db
│   ├── uploads/
│   └── .session-secret
└── static-site/         # Demo statis lama (GitHub Pages) — dibiarkan
```

## 📌 Catatan Penting

- **Zero cost & offline** — semua library disertakan, tidak butuh internet saat dijalankan
- **File upload** tersimpan di `data/uploads/` — sertakan folder `data/` saat backup manual
- **Backup database** — gunakan menu *Laporan & Ekspor → Backup*
- **Untuk LAN kantor**: jalankan di satu PC server, kemudian akses dari PC lain via alamat IP LAN PC tersebut (contoh `http://192.168.1.10:3000`)
- Versi demo statis lama tetap tersedia online di **https://dinothezero.github.io/Arsip-BPN/** (menyimpan data di LocalStorage browser) — bukan untuk data resmi kantor

---
Dibuat untuk kebutuhan Kantor Pertanahan 😊