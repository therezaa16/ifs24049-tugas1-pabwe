/*
 * aplikasi.js — APLIKASI (pengendali)
 *
 * Menghubungkan Data (logika), Penyimpanan, dan Tampilan, serta menjalankan
 * aturan gamifikasi:
 *   - Pengeluaran Kebutuhan / Pemasukan : langsung tersimpan.
 *   - Pengeluaran Keinginan             : TIDAK tersimpan; wajib misi belajar.
 *       Misi selesai  -> animasi "Vault Terbuka" -> transaksi tersimpan -> EXP.
 *       Misi dibatalkan -> transaksi dibuang, +0 EXP.
 *   - Pengeluaran yang membuat saldo negatif wajib dikonfirmasi dulu
 *     (kebijakan: peringatan + konfirmasi, bukan blokir).
 */
(function (akar) {
  'use strict';

  const BDBK = akar.BDBK;
  const K = BDBK.Konfigurasi;
  const Data = BDBK.Data;
  const Penyimpanan = BDBK.Penyimpanan;
  const Tampilan = BDBK.Tampilan;

  const HALAMAN = ['dashboard', 'quest', 'vault', 'profil'];

  // State aplikasi (privat di dalam closure, bukan variabel global)
  const state = {
    transaksi: [],
    profil: Data.profilDefault(),
    gam: Data.gamifikasiKosong(),
    tertunda: null,        // transaksi Keinginan yang menunggu misi selesai (BELUM disimpan)
    menyelesaikan: false,  // true selama animasi "Vault Terbuka" berjalan
    sedangKonfirmasi: false,
    halamanAktif: null
  };

  const sekarang = () => new Date();

  function gerakDikurangi() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ================= View-model: semua angka dihitung lewat Data ================= */

  function buatVM() {
    const kini = sekarang();
    const ringkasan = Data.hitungRingkasan(state.transaksi);
    const pengeluaranBulanIni = Data.hitungPengeluaranBulanIni(state.transaksi, kini);
    const sisaHari = Data.hitungSisaHariGajian(kini, state.profil.tanggalGajian);
    const expTotal = Data.hitungExpTotal(state.gam);
    const tanggalSelesai = Data.tanggalMisiSelesai(state.gam);
    const hp = Data.hitungHP(state.profil.anggaran, pengeluaranBulanIni);
    const urut = Data.urutkanTerbaru(state.transaksi);
    const selesai = state.gam.misi.filter((m) => m.status === K.STATUS_MISI.SELESAI);
    const terakhir = selesai.length ? selesai[selesai.length - 1] : null;

    let statusVault = 'terkunci';
    if (state.menyelesaikan) statusVault = 'terbuka';
    else if (state.tertunda) statusVault = 'menunggu';

    return {
      profil: state.profil,
      ringkasan: ringkasan,
      transaksiUrut: urut,
      terbaru: urut.slice(0, 5),
      level: Data.hitungLevel(expTotal),
      expTotal: expTotal,
      hp: hp,
      statusHP: Data.statusHP(hp),
      sisaHari: sisaHari,
      jatah: Data.hitungJatahHarian(state.profil.anggaran, pengeluaranBulanIni, sisaHari),
      streak: Data.hitungStreak(tanggalSelesai, kini),
      lencana: Data.hitungLencana(state.gam),
      misiHariIni: Data.sudahMisiHariIni(state.gam, kini),
      riwayat: state.gam.misi.slice().reverse(), // terbaru di atas
      jumlahMisiSelesai: selesai.length,
      misiAktif: state.tertunda,
      vault: {
        status: statusVault,
        itemTertunda: state.tertunda ? state.tertunda.nama : null,
        terakhirDibuka: terakhir ? terakhir.nama : null
      }
    };
  }

  function renderSemua() {
    const vm = buatVM();
    Tampilan.renderChip(vm);
    Tampilan.renderBannerMisi(vm);
    Tampilan.renderDashboard(vm);
    Tampilan.renderQuest(vm);
    Tampilan.renderVault(vm);
    Tampilan.renderProfil(vm);
  }

  /* ================= Navigasi (hash, tanpa library router) ================= */

  function bacaHash() {
    const h = window.location.hash.replace('#', '');
    return HALAMAN.includes(h) ? h : 'dashboard';
  }

  function tampilkan(nama, fokus) {
    if (nama === state.halamanAktif) return;
    state.halamanAktif = nama;
    Tampilan.sembunyikanPesan();
    renderSemua(); // data selalu segar (mis. setelah lewat tengah malam)
    Tampilan.tampilkanHalaman(nama, fokus);
  }

  // Navigasi dari kode: tampilkan langsung (sinkron) agar pesan sesudahnya tidak terhapus
  // oleh event hashchange yang datang belakangan.
  function navigasi(nama) {
    if (window.location.hash !== '#' + nama) window.location.hash = nama;
    tampilkan(nama, true);
  }

  /* ================= Penyimpanan transaksi ================= */

  // Menyimpan transaksi ke daftar + localStorage. Mengembalikan true jika berhasil.
  function simpanTransaksiBaru(transaksi) {
    const daftarBaru = [transaksi].concat(state.transaksi);
    if (!Penyimpanan.simpanTransaksi(daftarBaru)) return false;
    state.transaksi = daftarBaru;
    return true;
  }

  /* ================= Pomodoro ================= */

  const Pomodoro = {
    idInterval: null,
    waktuSelesai: 0,

    mulai() {
      if (this.idInterval !== null || state.menyelesaikan) return;
      const durasiMs = K.DURASI_POMODORO_MENIT * 60 * 1000;
      // Waktu selesai absolut (bukan hitung tick) agar akurat walau tab melambat.
      this.waktuSelesai = Date.now() + durasiMs;
      this.idInterval = window.setInterval(() => this.detak(), 250);
      Tampilan.aturTombolPomodoro(true);
      this.detak();
    },

    detak() {
      const sisa = Math.max(0, this.waktuSelesai - Date.now());
      Tampilan.renderTimer(sisa);
      if (sisa === 0) {
        this.hentikan();
        // Timer mencapai nol tanpa di-reset: misi selesai
        selesaikanMisi(K.TEKNIK.POMODORO);
      }
    },

    hentikan() {
      if (this.idInterval !== null) {
        window.clearInterval(this.idInterval);
        this.idInterval = null;
      }
      Tampilan.aturTombolPomodoro(false);
    },

    // Reset = batalkan hitungan dan kembali ke durasi penuh. Misi TIDAK selesai.
    reset() {
      this.hentikan();
      Tampilan.renderTimer(K.DURASI_POMODORO_MENIT * 60 * 1000);
    }
  };

  /* ================= Misi belajar ================= */

  function bukaMisi(transaksi) {
    state.tertunda = transaksi;
    Tampilan.kunciForm(true); // cegah transaksi lain selama misi berlangsung
    Tampilan.bukaPanelMisi(transaksi);
    navigasi('quest');        // renderSemua() dipanggil di dalamnya
    Tampilan.tampilkanPesan(
      '🔒 Vault terkunci. Pilih satu teknik belajar untuk membuka "' + transaksi.nama + '".', 'info');
  }

  function tutupMisi() {
    Pomodoro.hentikan();
    state.tertunda = null;
    state.menyelesaikan = false;
    Tampilan.tutupPanelMisi();
    Tampilan.kunciForm(false);
  }

  // Dipanggil saat syarat teknik terpenuhi. Urutan: animasi "Terbuka" -> baru simpan.
  function selesaikanMisi(teknik) {
    if (!state.tertunda || state.menyelesaikan) return; // pengaman: tidak ada misi / sudah diproses
    state.menyelesaikan = true;
    Pomodoro.hentikan();
    Tampilan.kunciMisi(true);
    renderSemua(); // status vault di dashboard -> "Terbuka"
    Tampilan.tampilkanVaultTerbuka(state.tertunda.nama);

    const durasi = gerakDikurangi() ? K.DURASI_ANIMASI_VAULT_HEMAT_MS : K.DURASI_ANIMASI_VAULT_MS;
    window.setTimeout(() => finalisasiMisi(teknik), durasi);
  }

  function finalisasiMisi(teknik) {
    const transaksi = state.tertunda;
    if (!transaksi) return;
    const topik = teknik === K.TEKNIK.RECALL ? Tampilan.bacaRecall().topik : '';

    // 1) Catat misi + EXP (fungsi murni), lalu simpan gamifikasi
    const kini = sekarang();
    const hasil = Data.catatMisi(state.gam, {
      id: Data.buatId(state.gam.misi),
      teknik: teknik,
      status: K.STATUS_MISI.SELESAI,
      nama: transaksi.nama,
      jumlah: transaksi.jumlah,
      topik: topik
    }, kini);
    state.gam = hasil.gamifikasi;
    const gamOk = Penyimpanan.simpanGamifikasi(state.gam);

    // 2) Misi selesai -> transaksi Keinginan tersimpan otomatis
    tutupMisi();
    const trxOk = simpanTransaksiBaru(transaksi);

    Tampilan.sembunyikanVault();
    if (trxOk) Tampilan.resetForm();
    renderSemua();

    const nama = teknik === K.TEKNIK.POMODORO ? 'Pomodoro' : 'Active Recall';
    const exp = hasil.expMisi + (hasil.expBonus ? ' EXP (+' + hasil.expBonus + ' bonus harian)' : ' EXP');
    let teks;
    let jenis = 'sukses';
    if (trxOk) {
      teks = '🔓 Vault terbuka! Misi ' + nama + ' selesai (+' + exp + '). Transaksi "' + transaksi.nama + '" kini tersimpan.';
    } else {
      jenis = 'galat';
      teks = 'Misi ' + nama + ' selesai (+' + exp + '), tetapi penyimpanan gagal ' +
        '(localStorage penuh atau dinonaktifkan). Transaksi tidak tersimpan.';
    }
    if (!gamOk) teks += ' Catatan: progres EXP juga gagal disimpan.';
    if (hasil.lencanaBaru.length) {
      teks += ' 🏅 Lencana baru: ' + hasil.lencanaBaru.map((l) => l.nama).join(', ') + '!';
    }
    Tampilan.tampilkanPesan(teks, jenis);
    if (hasil.naikLevel) Tampilan.tampilkanLevelUp(hasil.levelSesudah);
  }

  function batalkanMisi() {
    if (!state.tertunda || state.menyelesaikan) return;
    const transaksi = state.tertunda;
    const teknikDipilih = Tampilan.el.teknikRadio.find((r) => r.checked);

    // Misi dibatalkan: tercatat di riwayat dengan +0 EXP, transaksi tidak disimpan.
    const hasil = Data.catatMisi(state.gam, {
      id: Data.buatId(state.gam.misi),
      teknik: teknikDipilih ? teknikDipilih.value : null,
      status: K.STATUS_MISI.BATAL,
      nama: transaksi.nama,
      jumlah: transaksi.jumlah
    }, sekarang());
    state.gam = hasil.gamifikasi;
    Penyimpanan.simpanGamifikasi(state.gam);

    tutupMisi(); // transaksi tertunda dibuang, tidak pernah disimpan
    renderSemua();
    Tampilan.tampilkanPesan(
      'Misi dibatalkan (+0 EXP). Transaksi "' + transaksi.nama + '" tidak disimpan.', 'info');
  }

  function saatTeknikDipilih(e) {
    if (e.target.name !== 'teknik' || !state.tertunda) return;
    // Pindah teknik di tengah jalan: hentikan timer agar tidak berjalan tersembunyi
    Pomodoro.reset();
    Tampilan.tampilkanTeknik(e.target.value);
  }

  // Dipanggil setiap pengguna mengetik di form Active Recall
  function perbaruiRecall() {
    const { topik, ringkasan } = Tampilan.bacaRecall();
    Tampilan.renderPenghitung(Data.panjangRingkasan(ringkasan));
    Tampilan.aturTombolSelesaiRecall(Data.validasiRecall(topik, ringkasan).sah);
    Tampilan.tampilkanGalatRecall('');
  }

  function saatSelesaiRecall() {
    const { topik, ringkasan } = Tampilan.bacaRecall();
    const hasil = Data.validasiRecall(topik, ringkasan); // cek ulang, jangan percaya status tombol
    if (!hasil.sah) {
      Tampilan.tampilkanGalatRecall(hasil.pesan);
      Tampilan.getar(Tampilan.el.ringkasan);
      return;
    }
    selesaikanMisi(K.TEKNIK.RECALL);
  }

  /* ================= Transaksi ================= */

  async function saatFormDikirim(e) {
    e.preventDefault();
    if (state.tertunda || state.menyelesaikan || state.sedangKonfirmasi) return;

    const hasil = Data.validasiInput(Tampilan.bacaForm());
    Tampilan.tampilkanGalat(hasil.galat, { getar: true });
    if (!hasil.sah) {
      Tampilan.tampilkanPesan('Periksa kembali isian formulir.', 'galat');
      return;
    }

    const transaksi = Data.buatTransaksi(hasil.nilai, state.transaksi, sekarang());

    // Kebijakan saldo negatif: beri peringatan dan minta konfirmasi (bukan blokir).
    // Dicek SEBELUM misi dimulai agar pengguna tidak belajar dulu baru diberi tahu.
    const saldo = Data.hitungRingkasan(state.transaksi).saldo;
    if (Data.akanSaldoNegatif(saldo, transaksi)) {
      state.sedangKonfirmasi = true;
      let lanjut = false;
      try {
        lanjut = await Tampilan.konfirmasi({
          judul: '⚠️ Saldo akan menjadi negatif',
          isi: 'Saldo sekarang ' + Data.formatRupiah(saldo) + '. Setelah pengeluaran "' + transaksi.nama +
            '" sebesar ' + Data.formatRupiah(transaksi.jumlah) + ', saldo menjadi ' +
            Data.formatRupiah(saldo - transaksi.jumlah) + '. Tetap lanjutkan?',
          ya: 'Tetap lanjutkan',
          batal: 'Batal'
        });
      } finally {
        state.sedangKonfirmasi = false;
      }
      if (!lanjut) {
        Tampilan.tampilkanPesan('Dibatalkan. Transaksi belum disimpan.', 'info');
        return;
      }
    }

    if (Data.perluMisi(transaksi)) {
      bukaMisi(transaksi); // KEINGINAN: jangan simpan dulu
      return;
    }

    // Pemasukan atau pengeluaran KEBUTUHAN: langsung tersimpan
    if (simpanTransaksiBaru(transaksi)) {
      Tampilan.resetForm();
      renderSemua();
      Tampilan.tampilkanPesan('Transaksi "' + transaksi.nama + '" tersimpan.', 'sukses');
    } else {
      Tampilan.tampilkanPesan('Gagal menyimpan ke localStorage (penuh atau dinonaktifkan).', 'galat');
    }
  }

  async function saatTabelDiklik(e) {
    const tombol = e.target.closest('button[data-aksi="hapus"]');
    if (!tombol || state.sedangKonfirmasi || state.menyelesaikan) return;
    const id = tombol.dataset.id;
    const target = state.transaksi.find((t) => t.id === id);
    if (!target) return;

    state.sedangKonfirmasi = true;
    let setuju = false;
    try {
      setuju = await Tampilan.konfirmasi({
        judul: 'Hapus transaksi?',
        isi: '"' + target.nama + '" (' + Data.formatRupiah(target.jumlah) + ') akan dihapus permanen.',
        ya: 'Hapus',
        batal: 'Batal',
        bahaya: true
      });
    } finally {
      state.sedangKonfirmasi = false;
    }
    if (!setuju) return;

    const daftarBaru = Data.hapusBerdasarkanId(state.transaksi, id);
    if (Penyimpanan.simpanTransaksi(daftarBaru)) {
      state.transaksi = daftarBaru;
      renderSemua();
      Tampilan.tampilkanPesan('Transaksi dihapus.', 'info');
    } else {
      Tampilan.tampilkanPesan('Gagal menyimpan perubahan ke localStorage.', 'galat');
    }
  }

  // Petunjuk langsung di bawah kolom jumlah: saldo setelah pengeluaran ini
  function perbaruiPetunjukSaldo() {
    const form = Tampilan.bacaForm();
    if (form.jenis !== K.JENIS.PENGELUARAN) { Tampilan.tampilkanPetunjukSaldo('', false); return; }
    const p = Data.periksaAngkaTeks(form.jumlah, 'Jumlah');
    if (!p.sah) { Tampilan.tampilkanPetunjukSaldo('', false); return; }
    const sesudah = Data.hitungRingkasan(state.transaksi).saldo - p.nilai;
    Tampilan.tampilkanPetunjukSaldo(
      (sesudah < 0 ? '⚠️ ' : '') + 'Saldo setelah transaksi ini: ' + Data.formatRupiah(sesudah), sesudah < 0);
  }

  /* ================= Profil ================= */

  function saatProfilDikirim(e) {
    e.preventDefault();
    const hasil = Data.validasiProfil(Tampilan.bacaFormProfil());
    Tampilan.tampilkanGalatProfil(hasil.galat, { getar: true });
    if (!hasil.sah) {
      Tampilan.tampilkanPesan('Periksa kembali isian profil.', 'galat');
      return;
    }
    state.profil = hasil.nilai;
    const ok = Penyimpanan.simpanProfil(state.profil);
    renderSemua();
    Tampilan.isiFormProfil(state.profil); // tampilkan nilai yang sudah dirapikan
    Tampilan.tampilkanPesan(
      ok ? 'Profil tersimpan.' : 'Profil berubah, tetapi gagal disimpan ke localStorage.', ok ? 'sukses' : 'galat');
  }

  async function saatResetData() {
    if (state.sedangKonfirmasi || state.menyelesaikan) return;
    state.sedangKonfirmasi = true;
    let setuju = false;
    try {
      setuju = await Tampilan.konfirmasi({
        judul: 'Reset semua data?',
        isi: 'Semua transaksi, profil, EXP, level, streak, lencana, dan riwayat misi akan dihapus permanen ' +
          'dari browser ini. Tindakan ini tidak bisa dibatalkan.',
        ya: 'Ya, hapus semua',
        batal: 'Batal',
        bahaya: true
      });
    } finally {
      state.sedangKonfirmasi = false;
    }
    if (!setuju) return;

    tutupMisi(); // jika ada misi berjalan, ikut dihentikan
    const ok = Penyimpanan.resetSemua();
    state.transaksi = [];
    state.profil = Data.profilDefault();
    state.gam = Data.gamifikasiKosong();
    Tampilan.resetForm();
    Tampilan.isiFormProfil(state.profil);
    navigasi('dashboard');
    Tampilan.tampilkanPesan(
      ok ? 'Semua data sudah direset.' : 'Data di layar direset, tetapi penghapusan di localStorage gagal.',
      ok ? 'sukses' : 'galat');
  }

  /* ================= Mulai ================= */

  function mulai() {
    Tampilan.mulai();
    const el = Tampilan.el;

    state.transaksi = Penyimpanan.muatTransaksi();
    state.profil = Penyimpanan.muatProfil();
    state.gam = Penyimpanan.muatGamifikasi();
    Tampilan.isiFormProfil(state.profil);
    Tampilan.aturTipeTerlihat(Tampilan.jenisTerpilih());
    Tampilan.tutupPanelMisi();

    // Navigasi
    window.addEventListener('hashchange', () => tampilkan(bacaHash(), true));
    el.lewati.addEventListener('click', (e) => { e.preventDefault(); Tampilan.fokusKonten(); });
    el.tombolCepat.addEventListener('click', () => {
      navigasi('vault');
      Tampilan.setJenis(K.JENIS.PENGELUARAN);
      if (!state.tertunda) Tampilan.fokusNama();
    });
    el.tombolKeVault.addEventListener('click', () => navigasi('vault'));

    // Form transaksi
    el.form.addEventListener('submit', saatFormDikirim);
    el.form.addEventListener('change', (e) => {
      if (e.target.name === 'jenis') { Tampilan.aturTipeTerlihat(e.target.value); perbaruiPetunjukSaldo(); }
    });
    el.jumlah.addEventListener('input', perbaruiPetunjukSaldo);
    el.isiTabel.addEventListener('click', saatTabelDiklik);

    // Misi
    el.teknikRadio.forEach((r) => r.addEventListener('change', saatTeknikDipilih));
    el.tombolMulai.addEventListener('click', () => Pomodoro.mulai());
    el.tombolReset.addEventListener('click', () => Pomodoro.reset());
    el.topik.addEventListener('input', perbaruiRecall);
    el.ringkasan.addEventListener('input', perbaruiRecall);
    el.tombolSelesaiRecall.addEventListener('click', saatSelesaiRecall);
    el.tombolBatal.addEventListener('click', batalkanMisi);

    // Profil
    el.formProfil.addEventListener('submit', saatProfilDikirim);
    el.tombolResetData.addEventListener('click', saatResetData);

    // Perbarui tampilan saat tab kembali aktif (mis. hari sudah berganti)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderSemua(); });

    const awal = bacaHash();
    if (window.location.hash !== '#' + awal) window.history.replaceState(null, '', '#' + awal);
    tampilkan(awal, false);
  }

  mulai();
})(window);
