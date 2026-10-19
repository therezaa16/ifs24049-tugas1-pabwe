/*
 * konfigurasi.js
 * Semua angka "aturan main" ada di sini supaya mudah diubah dan diuji.
 *
 * Satu-satunya variabel global aplikasi adalah objek `BDBK` (namespace),
 * karena kode dipecah ke beberapa file. Semua isi file dibungkus IIFE.
 */
(function (akar) {
  'use strict';

  const Konfigurasi = Object.freeze({
    // Durasi Pomodoro dalam MENIT. Untuk pengujian, ubah angka ini
    // (contoh: 0.1 = 6 detik). Default: 25 menit.
    DURASI_POMODORO_MENIT: 25,

    // Syarat minimal panjang ringkasan Active Recall (jumlah karakter).
    MIN_KARAKTER_RINGKASAN: 50,

    // Aturan EXP (wajib persis): misi dibatalkan = 0 EXP.
    EXP_POMODORO: 30,
    EXP_RECALL: 20,
    EXP_BONUS_HARIAN: 10, // quest harian "Selesaikan 1 misi hari ini", sekali per hari
    EXP_PER_LEVEL: 100,   // naik dari level N ke N+1 butuh 100 x N EXP

    // Batas warna HP: hijau di atas 50, kuning 20-50, merah di bawah 20.
    HP_BATAS_HIJAU: 50,
    HP_BATAS_KUNING: 20,

    // Batas input
    JUMLAH_MAKS: 1000000000000,
    PANJANG_NAMA_MAKS: 60,
    PANJANG_NAMA_PROFIL_MAKS: 24,

    // Lama animasi "Vault Terbuka" sebelum transaksi disimpan (milidetik).
    DURASI_ANIMASI_VAULT_MS: 1900,
    DURASI_ANIMASI_VAULT_HEMAT_MS: 800, // saat pengguna meminta gerak dikurangi

    KUNCI: Object.freeze({
      TRANSAKSI: 'bdbk.transaksi.v1',   // kunci lama dari iterasi 1 (tetap terbaca)
      PROFIL: 'bdbk.profil.v1',
      GAMIFIKASI: 'bdbk.gamifikasi.v1'
    }),

    KATEGORI: Object.freeze(['Makan', 'Transport', 'Hiburan', 'Belanja', 'Lainnya']),
    JENIS: Object.freeze({ PEMASUKAN: 'Pemasukan', PENGELUARAN: 'Pengeluaran' }),
    TIPE: Object.freeze({ KEBUTUHAN: 'Kebutuhan', KEINGINAN: 'Keinginan' }),
    TEKNIK: Object.freeze({ POMODORO: 'pomodoro', RECALL: 'recall' }),
    STATUS_MISI: Object.freeze({ SELESAI: 'selesai', BATAL: 'batal' }),

    // Avatar hanya dari daftar ini (tanpa upload). Daftar ini juga menjadi whitelist.
    AVATAR: Object.freeze(['🦊', '🐱', '🐼', '🦉', '🐲', '🦄', '🤖', '👾']),
    AVATAR_DEFAULT: '🦊',
    NAMA_PROFIL_DEFAULT: 'Petualang',
    TANGGAL_GAJIAN_DEFAULT: 1
  });

  const BDBK = akar.BDBK = akar.BDBK || {};
  BDBK.Konfigurasi = Konfigurasi;

  if (typeof module !== 'undefined' && module.exports) module.exports = Konfigurasi;
})(typeof window !== 'undefined' ? window : globalThis);
