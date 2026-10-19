/*
 * penyimpanan.js — PENYIMPANAN (localStorage)
 *
 * Tidak menyentuh DOM. Semua akses dibungkus try/catch (localStorage bisa
 * dinonaktifkan, penuh, atau berisi JSON rusak). Data yang dibaca selalu
 * dibersihkan lewat Data.bersihkan*() sehingga entri rusak dibuang.
 *
 * Tiga kunci terpisah:
 *   bdbk.transaksi.v1  : kunci LAMA dari iterasi 1 (format tidak berubah)
 *   bdbk.profil.v1     : nama, avatar, anggaran bulanan, tanggal gajian
 *   bdbk.gamifikasi.v1 : riwayat misi + tanggal bonus harian yang sudah diklaim
 */
(function (akar) {
  'use strict';

  const K = akar.BDBK.Konfigurasi;
  const Data = akar.BDBK.Data;

  // Membaca + mem-parse JSON. Mengembalikan null jika kosong / rusak / tidak tersedia.
  function baca(kunci) {
    try {
      const mentah = window.localStorage.getItem(kunci);
      return mentah === null ? null : JSON.parse(mentah);
    } catch (e) {
      return null;
    }
  }

  // Mengembalikan true jika berhasil, false jika gagal (mis. kuota penuh).
  function tulis(kunci, nilai) {
    try {
      window.localStorage.setItem(kunci, JSON.stringify(nilai));
      return true;
    } catch (e) {
      return false;
    }
  }

  const Penyimpanan = {
    muatTransaksi() { return Data.bersihkanTransaksi(baca(K.KUNCI.TRANSAKSI)); },
    simpanTransaksi(daftar) { return tulis(K.KUNCI.TRANSAKSI, daftar); },

    muatProfil() { return Data.bersihkanProfil(baca(K.KUNCI.PROFIL)); },
    simpanProfil(profil) { return tulis(K.KUNCI.PROFIL, profil); },

    muatGamifikasi() { return Data.bersihkanGamifikasi(baca(K.KUNCI.GAMIFIKASI)); },
    simpanGamifikasi(gam) { return tulis(K.KUNCI.GAMIFIKASI, gam); },

    // Menghapus ketiga kunci. Mengembalikan true jika semuanya berhasil dihapus.
    resetSemua() {
      try {
        window.localStorage.removeItem(K.KUNCI.TRANSAKSI);
        window.localStorage.removeItem(K.KUNCI.PROFIL);
        window.localStorage.removeItem(K.KUNCI.GAMIFIKASI);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  akar.BDBK.Penyimpanan = Penyimpanan;
})(window);
