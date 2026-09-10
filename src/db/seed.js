'use strict';

// Data contoh (opsional): npm run seed
const { db } = require('./db');
const { createTables, seedDefaults } = require('./init');
const Q = require('./queries');

function seed() {
  createTables();
  seedDefaults();

  if (Q.countArsip() > 0) {
    console.log('[seed] Database sudah berisi arsip. Lewati (hapus data/arsip-bpn.db untuk memulai lagi).');
    return;
  }

  const admin = Q.findUserByUsername('admin');
  const ins = (nama, jenis) => { Q.createInstansi({ nama_instansi: nama, jenis }); return db.prepare('SELECT id FROM instansi WHERE nama_instansi=?').get(nama).id; };
  const kat = (kode) => Q.listKategori().find((k) => k.kode === kode).id;

  const notaris = ins('Notaris R. Firmansyah, SH', 'keduanya');
  const desa = ins('Kantor Desa Sukamaju', 'pengirim');
  const pemda = ins('Pemerintah Daerah Kabupaten', 'pengirim');
  const gub = ins('Pemerintah Provinsi', 'pengirim');
  const kelurahan = ins('Kelurahan Sukamaju', 'keduanya');
  const sekolah = ins('Dinas Pendidikan', 'pengirim');

  Q.createLokasi({ nama_lokasi: 'Rak A - Lantai 1', keterangan: 'Rak arsip aktif' });
  const rakA = db.prepare('SELECT id FROM lokasi WHERE nama_lokasi=?').get('Rak A - Lantai 1').id;
  Q.createLokasi({ nama_lokasi: 'Lemari B - Belakang', keterangan: 'Arsip inaktif' });
  const lemariB = db.prepare('SELECT id FROM lokasi WHERE nama_lokasi=?').get('Lemari B - Belakang').id;

  Q.createUnit({ nama_unit: 'Sub Bagian Tata Usaha' });
  const unitTU = db.prepare("SELECT id FROM unit WHERE nama_unit LIKE 'Sub Bagian Tata Usaha'").get().id;
  Q.createUnit({ nama_unit: 'Seksi Penetapan Hak' });
  const unitHak = db.prepare("SELECT id FROM unit WHERE nama_unit LIKE 'Seksi Penetapan Hak'").get().id;

  const data = [
    ['Surat Keputusan Mutasi Pegawai', 'SKM', 'surat-masuk', 'Mutasi dan pelantikan 3 ASN', 'Keputusan nomor 21 tahun bergulir', notaris, rakA, unitHak, 'aktif'],
    ['Permohonan Pemisahan Sertifikat Hak Milik a.n. Sdri. Dewi', 'SHM', 'surat-masuk', 'a.n. Sdri. Dewi, sertifikat atas nama H. Bambang', 'Permohonan layanan pemisahan bidang tanah', desa, rakA, unitHak, 'aktif'],
    ['Sertifikat Hak Guna Bangunan PN 4/dt/U/2002', 'HGB', 'sertifikat', 'Sertifikat HGB atas nama PT Maju Bersama', 'HGB No. 12, luas 2.450 m2', kelurahan, rakA, unitHak, 'aktif'],
    ['Keputusan Bupati tentang Penetapan Lokasi Jalan', 'SK', 'sk', 'Penetapan lokasi pengadaan tanah untuk pelebaran jalan', 'Dasar pelaksanaan ganti rugi lahan', pemda, rakA, unitTU, 'arsip'],
    ['Surat Rekomendasi Gubernur', 'SKL', 'surat-masuk', 'Rekomendasi penegasan batas kawasan', 'Tindak lanjut penanganan batas wilayah', gub, lemariB, unitTU, 'arsip'],
    ['Laporan Pertanggungjawaban Bantuan Pemerintah', 'LPJ', 'laporan', 'LPJ pencairan Dana Bagian Hasil (DBH)', 'Penggunaan anggaran TA berjalan', pemda, lemariB, unitTU, 'arsip'],
    ['Warkah Pemecahan Sertifikat Hak Milik 1234', 'WA', 'lainnya', 'Warkah asli tindak lanjut permohonan', 'arsip warkah penting', kelurahan, rakA, unitHak, 'dipinjam'],
    ['Permohonan Lanjutan Sertifikat dari Sekolah', 'SM', 'surat-masuk', 'Sertifikat tanah aset sekolah', 'Undangan rapat koordinasi aset', sekolah, rakA, unitTU, 'aktif'],
  ];

  const now = new Date();
  for (let i = 0; i < data.length; i++) {
    const [judul, kodeKat, jenis, perihal, ket, instId, lokId, unitId, status] = data[i];
    // tahun bervariasi 3 tahun terakhir agar grafik tren & filter terlihat
    const tahun = String(now.getFullYear() - (i % 3));
    const tgl = `${tahun}-${String((now.getMonth() + (i % 8) + 1) % 12 + 1).padStart(2, '0')}-${String((i * 7) % 28 + 1).padStart(2, '0')}`;
    const id = Q.createArsip({
      nomor_arsip: Q.nextNomorArsip(kat(kodeKat), parseInt(tahun, 10)),
      kategori_id: kat(kodeKat), jenis, judul, perihal, tanggal: tgl, tahun_arsip: parseInt(tahun, 10),
      instansi_id: instId, lokasi_id: lokId, unit_id: unitId, status, keterangan: ket, created_by: admin.id,
    });
    // agenda surat masuk/keluar
    if (jenis === 'surat-masuk') {
      const n = Q.nextAgendaNomor(parseInt(tahun, 10), 'masuk');
      Q.createAgenda({ tahun: parseInt(tahun, 10), jenis: 'masuk', nomor_urut: n, arsip_id: id, tanggal: tgl });
    }
    if (jenis === 'surat-keluar') {
      const n = Q.nextAgendaNomor(parseInt(tahun, 10), 'keluar');
      Q.createAgenda({ tahun: parseInt(tahun, 10), jenis: 'keluar', nomor_urut: n, arsip_id: id, tanggal: tgl });
    }
  }
  console.log(`[seed] ${data.length} arsip contoh dibuat.`);

  // Disposisi contoh
  const staff = Q.findUserByUsername('staff1');
  const kepala = Q.findUserByUsername('kepala1');
  const arsip1 = db.prepare("SELECT id FROM arsip WHERE judul LIKE 'Permohonan Pemisahan%'").get();
  Q.createDisposisi({ arsip_id: arsip1.id, dari_user_id: admin.id, ke_user_id: kepala.id, instruksi: 'Mohon persetujuan untuk proses pengukuran lapangan', tanggal: new Date().toISOString().slice(0, 10) });
  const arsip2 = db.prepare("SELECT id FROM arsip WHERE judul LIKE 'Surat Keputusan Mutasi%'").get();
  Q.createDisposisi({ arsip_id: arsip2.id, dari_user_id: admin.id, ke_user_id: staff.id, instruksi: 'Harap arsipkan berkas dan update status', tanggal: new Date().toISOString().slice(0, 10) });
  console.log('[seed] 2 disposisi contoh dibuat.');

  // Peminjaman contoh
  const arsip3 = db.prepare("SELECT id FROM arsip WHERE judul LIKE 'Warkah%'").get();
  Q.createPeminjaman({ arsip_id: arsip3.id, peminjam: 'Petugas Verifikasi Lapangan', unit_peminjam: 'Seksi Survei', tanggal_pinjam: new Date().toISOString().slice(0, 10), jatuh_tempo: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), keterangan: 'Dibawa ke lapangan', created_by: admin.id });
  console.log('[seed] 1 peminjaman contoh dibuat.');

  // Kegiatan bulan ini
  const bln = String(now.getMonth() + 1).padStart(2, '0');
  Q.createKegiatan({ tanggal: `${now.getFullYear()}-${bln}-02`, jam_mulai: '09:00', jam_selesai: '10:30', judul: 'Rapat Koordinasi Bulanan', jenis: 'rapat', lokasi: 'Aula Kantor', keterangan: 'Seluruh staf hadir', created_by: admin.id });
  Q.createKegiatan({ tanggal: `${now.getFullYear()}-${bln}-15`, jam_mulai: '09:00', jam_selesai: '16:00', judul: 'Verifikasi Lapangan Blok Sukamaju', jenis: 'verifikasi', lokasi: 'Sukamaju', keterangan: 'Pengukuran 12 bidang', created_by: admin.id });
  Q.createKegiatan({ tanggal: `${now.getFullYear()}-${bln}-20`, jam_mulai: '08:30', jam_selesai: '14:00', judul: 'Layanan Terpadu Gerakan PTSL', jenis: 'pelayanan', lokasi: 'Balai Desa', keterangan: '', created_by: admin.id });
  console.log('[seed] 3 kegiatan contoh dibuat.');

  console.log('[seed] Selesai. Jalankan npm start lalu buka http://localhost:3000');
}

if (require.main === module) seed();
module.exports = { seed };