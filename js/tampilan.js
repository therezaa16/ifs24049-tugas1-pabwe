/*
 * tampilan.js — TAMPILAN (semua operasi DOM)
 *
 * Aturan keamanan: data pengguna (nama transaksi, nama profil, topik, avatar)
 * HANYA ditulis lewat textContent / setAttribute. TIDAK ADA innerHTML di file ini.
 * Modul ini tidak punya logika hitung: semua angka datang dari Aplikasi (view-model).
 */
(function (akar) {
  'use strict';

  const K = akar.BDBK.Konfigurasi;
  const Data = akar.BDBK.Data;

  const NAMA_HALAMAN = {
    dashboard: 'Dashboard',
    quest: 'Quest Hub',
    vault: 'Data Vault',
    profil: 'Profil'
  };
  const NAMA_TEKNIK = { pomodoro: 'Pomodoro', recall: 'Active Recall' };
  const LABEL_GALAT = ['nama', 'jumlah', 'kategori', 'jenis', 'tipe'];

  let el = null;            // kumpulan elemen, diisi saat mulai()
  let pewaktuLevelUp = null;

  // Membuat elemen dengan teks aman (textContent, bukan innerHTML)
  function buatEl(tag, teks, kelas) {
    const e = document.createElement(tag);
    if (teks != null) e.textContent = teks;
    if (kelas) e.className = kelas;
    return e;
  }

  function formatMenitDetik(ms) {
    const totalDetik = Math.ceil(ms / 1000);
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    return String(menit).padStart(2, '0') + ':' + String(detik).padStart(2, '0');
  }

  function formatDurasi(menit) {
    return menit >= 1 ? menit + ' menit' : Math.round(menit * 60) + ' detik';
  }

  // Mengatur lebar bar. Nilai disimpan di data-persen agar bisa dianimasikan ulang.
  function setBatang(isi, persen) {
    isi.dataset.persen = String(persen);
    isi.style.width = persen + '%';
  }

  const Tampilan = {
    get el() { return el; },

    /* ----- Inisialisasi ----- */

    mulai() {
      const $ = (id) => document.getElementById(id);
      el = {
        lewati: $('lewati'), konten: $('konten'),
        chipAvatar: $('chip-avatar'), chipLevel: $('chip-level'),
        navItems: Array.from(document.querySelectorAll('[data-nav]')),
        halaman: {
          dashboard: $('tampilan-dashboard'), quest: $('tampilan-quest'),
          vault: $('tampilan-vault'), profil: $('tampilan-profil')
        },
        bannerMisi: $('banner-misi'), bannerMisiTeks: $('banner-misi-teks'),
        pesan: $('pesan'),

        // Dashboard
        dashAvatar: $('dash-avatar'), dashNama: $('dash-nama'), dashLevel: $('dash-level'), dashStreak: $('dash-streak'),
        hpBatang: $('dash-hp-batang'), hpIsi: $('dash-hp-isi'), hpTeks: $('dash-hp-teks'), hpAjakan: $('dash-hp-ajakan'),
        expBatang: $('dash-exp-batang'), expIsi: $('dash-exp-isi'), expTeks: $('dash-exp-teks'),
        sisaHari: $('dash-sisa-hari'), sisaHariKet: $('dash-sisa-hari-ket'),
        jatah: $('dash-jatah'), jatahKet: $('dash-jatah-ket'),
        vaultKartu: $('dash-vault-kartu'), vaultIkon: $('dash-vault-ikon'),
        vaultStatus: $('dash-vault-status'), vaultKet: $('dash-vault-ket'),
        totalPemasukan: $('total-pemasukan'), totalPengeluaran: $('total-pengeluaran'), saldo: $('saldo'),
        peringatanSaldo: $('peringatan-saldo'),
        terbaru: $('dash-terbaru'), terbaruKosong: $('dash-terbaru-kosong'),
        tombolCepat: $('tombol-cepat-keluar'),

        // Quest Hub
        questHarianStatus: $('quest-harian-status'), questHarianKet: $('quest-harian-ket'),
        bonusHarianTeks: $('bonus-harian-teks'),
        teknikPetunjuk: $('teknik-petunjuk'),
        teknikRadio: Array.from(document.querySelectorAll('input[name="teknik"]')),
        deskPomodoro: $('desk-pomodoro'), deskRecall: $('desk-recall'),
        expPomodoro: $('exp-pomodoro'), expRecall: $('exp-recall'),
        misiKosong: $('misi-kosong'), misiAktif: $('misi-aktif'), misiInfo: $('misi-info'),
        misiPilihDulu: $('misi-pilih-dulu'), tombolKeVault: $('tombol-ke-vault'),
        bagianPomodoro: $('bagian-pomodoro'), bagianRecall: $('bagian-recall'),
        timer: $('timer'), tombolMulai: $('tombol-mulai'), tombolReset: $('tombol-reset'),
        tombolBatal: $('tombol-batal'),
        topik: $('topik'), ringkasan: $('ringkasan'), penghitung: $('penghitung'),
        galatRecall: $('galat-recall'), tombolSelesaiRecall: $('tombol-selesai-recall'),
        riwayat: $('riwayat-misi'), riwayatKosong: $('riwayat-kosong'),

        // Data Vault
        form: $('form-transaksi'), fieldsetForm: $('fieldset-form'),
        nama: $('nama'), jumlah: $('jumlah'), petunjukJumlah: $('petunjuk-jumlah'),
        kategori: $('kategori'), tipe: $('tipe'), grupTipe: $('grup-tipe'),
        catatanTerkunci: $('catatan-form-terkunci'),
        galat: {
          nama: $('galat-nama'), jumlah: $('galat-jumlah'), kategori: $('galat-kategori'),
          jenis: $('galat-jenis'), tipe: $('galat-tipe')
        },
        isiTabel: $('isi-tabel'),

        // Profil
        formProfil: $('form-profil'), profilNama: $('profil-nama'), profilAnggaran: $('profil-anggaran'),
        profilGajian: $('profil-gajian'), grupAvatar: $('grup-avatar'),
        galatProfil: {
          nama: $('galat-profil-nama'), anggaran: $('galat-profil-anggaran'),
          tanggalGajian: $('galat-profil-gajian'), avatar: $('galat-profil-avatar')
        },
        statLevel: $('stat-level'), statExp: $('stat-exp'), statStreak: $('stat-streak'), statMisi: $('stat-misi'),
        daftarLencana: $('daftar-lencana'), tombolResetData: $('tombol-reset-data'),

        // Overlay & dialog
        overlayVault: $('overlay-vault'), vaultItem: $('vault-item'),
        overlayLevelUp: $('overlay-levelup'), levelUpTeks: $('levelup-teks'),
        dialog: $('dialog-konfirmasi'), dkJudul: $('dk-judul'), dkIsi: $('dk-isi'),
        dkYa: $('dk-ya'), dkBatal: $('dk-batal')
      };

      // Opsi statis (dibuat dari konfigurasi, bukan ditulis ganda di HTML)
      for (const k of K.KATEGORI) {
        const opsi = document.createElement('option');
        opsi.value = k;
        opsi.textContent = k;
        el.kategori.appendChild(opsi);
      }
      for (let h = 1; h <= 31; h++) {
        const opsi = document.createElement('option');
        opsi.value = String(h);
        opsi.textContent = String(h);
        el.profilGajian.appendChild(opsi);
      }
      for (const a of K.AVATAR) {
        const label = buatEl('label', null, 'avatar-pilihan');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'avatar';
        radio.value = a;
        radio.setAttribute('aria-label', 'Avatar ' + a);
        const isi = buatEl('span', a, 'avatar-isi');
        isi.setAttribute('aria-hidden', 'true');
        label.appendChild(radio);
        label.appendChild(isi);
        el.grupAvatar.appendChild(label);
      }

      // Teks yang bergantung pada konfigurasi
      el.deskPomodoro.textContent = 'Fokus belajar ' + formatDurasi(K.DURASI_POMODORO_MENIT) + ' penuh tanpa reset.';
      el.deskRecall.textContent = 'Tulis topik dan ringkasan minimal ' + K.MIN_KARAKTER_RINGKASAN + ' karakter dari ingatan.';
      el.expPomodoro.textContent = '+' + K.EXP_POMODORO + ' EXP';
      el.expRecall.textContent = '+' + K.EXP_RECALL + ' EXP';
      el.bonusHarianTeks.textContent = '+' + K.EXP_BONUS_HARIAN + ' EXP';
      this.renderTimer(K.DURASI_POMODORO_MENIT * 60 * 1000);
      this.renderPenghitung(0);
    },

    /* ----- Navigasi antar tampilan ----- */

    tampilkanHalaman(nama, fokus) {
      for (const n of Object.keys(el.halaman)) el.halaman[n].hidden = n !== nama;
      for (const a of el.navItems) {
        if (a.dataset.nav === nama) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
      document.title = NAMA_HALAMAN[nama] + ' · Belajar Dulu, Belanja Kemudian';
      if (fokus) {
        window.scrollTo(0, 0);
        const judul = el.halaman[nama].querySelector('h1');
        if (judul) judul.focus({ preventScroll: true });
      }
      this.animasikanBatang(el.halaman[nama]);
    },

    // Memutar ulang animasi isi bar dari 0 (dipanggil saat tampilan baru dibuka).
    animasikanBatang(wadah) {
      for (const isi of wadah.querySelectorAll('.batang .isi')) {
        const persen = isi.dataset.persen || '0';
        isi.style.transition = 'none';
        isi.style.width = '0%';
        void isi.offsetWidth; // paksa reflow agar transisi berikutnya mulai dari 0
        isi.style.transition = '';
        isi.style.width = persen + '%';
      }
    },

    fokusKonten() { el.konten.focus({ preventScroll: true }); },

    /* ----- Pesan, getar, dialog ----- */

    tampilkanPesan(teks, jenis) {
      el.pesan.textContent = teks;
      el.pesan.className = 'pesan ' + (jenis || 'info');
      el.pesan.hidden = false;
    },

    sembunyikanPesan() {
      el.pesan.hidden = true;
      el.pesan.textContent = '';
    },

    // Getar singkat untuk menandai galat. Kelas dilepas lagi agar bisa diputar ulang.
    getar(node) {
      node.classList.remove('getar');
      void node.offsetWidth;
      node.classList.add('getar');
      window.setTimeout(() => node.classList.remove('getar'), 600);
    },

    // Dialog konfirmasi (pengganti window.confirm). Mengembalikan Promise<boolean>.
    konfirmasi(opsi) {
      const d = el.dialog;
      el.dkJudul.textContent = opsi.judul;
      el.dkIsi.textContent = opsi.isi;
      el.dkYa.textContent = opsi.ya || 'Ya';
      el.dkBatal.textContent = opsi.batal || 'Batal';
      el.dkYa.className = 'tombol ' + (opsi.bahaya ? 'bahaya-isi' : 'utama');
      if (typeof d.showModal !== 'function') { // browser lama: pakai dialog bawaan
        return Promise.resolve(window.confirm(opsi.judul + '\n\n' + opsi.isi));
      }
      return new Promise((selesai) => {
        d.returnValue = '';
        const saatTutup = () => {
          d.removeEventListener('close', saatTutup);
          selesai(d.returnValue === 'ya'); // Esc / Batal -> false
        };
        d.addEventListener('close', saatTutup);
        d.showModal();
      });
    },

    /* ----- Form transaksi ----- */

    bacaForm() {
      const jenis = el.form.querySelector('input[name="jenis"]:checked');
      return {
        nama: el.nama.value,
        jumlah: el.jumlah.value,
        kategori: el.kategori.value,
        jenis: jenis ? jenis.value : '',
        tipe: el.tipe.value
      };
    },

    jenisTerpilih() {
      const j = el.form.querySelector('input[name="jenis"]:checked');
      return j ? j.value : '';
    },

    setJenis(nilai) {
      for (const r of el.form.querySelectorAll('input[name="jenis"]')) r.checked = r.value === nilai;
      this.aturTipeTerlihat(nilai);
    },

    tampilkanGalat(galat, opsi) {
      const peta = { nama: el.nama, jumlah: el.jumlah, kategori: el.kategori, tipe: el.tipe };
      let pertama = null;
      for (const kunci of LABEL_GALAT) {
        el.galat[kunci].textContent = galat[kunci] || '';
        const kolom = peta[kunci];
        if (!kolom) continue;
        if (galat[kunci]) {
          kolom.setAttribute('aria-invalid', 'true');
          if (!pertama) pertama = kolom;
          if (opsi && opsi.getar) this.getar(kolom);
        } else {
          kolom.removeAttribute('aria-invalid');
        }
      }
      if (pertama && opsi && opsi.getar) pertama.focus();
    },

    // Kolom "tipe pengeluaran" hanya relevan untuk Pengeluaran
    aturTipeTerlihat(jenis) {
      el.grupTipe.hidden = jenis !== K.JENIS.PENGELUARAN;
      if (jenis !== K.JENIS.PENGELUARAN) el.tipe.value = '';
    },

    resetForm() {
      el.form.reset();
      el.grupTipe.hidden = false; // default jenis = Pengeluaran
      this.tampilkanGalat({});
      el.petunjukJumlah.textContent = '';
      el.petunjukJumlah.classList.remove('negatif');
    },

    kunciForm(terkunci) {
      el.fieldsetForm.disabled = terkunci;
      el.catatanTerkunci.hidden = !terkunci;
    },

    fokusNama() { el.nama.focus(); },

    tampilkanPetunjukSaldo(teks, negatif) {
      el.petunjukJumlah.textContent = teks || '';
      el.petunjukJumlah.classList.toggle('negatif', !!negatif);
    },

    /* ----- Render view-model ----- */

    renderChip(vm) {
      el.chipAvatar.textContent = vm.profil.avatar;
      el.chipLevel.textContent = 'Lv. ' + vm.level.level;
    },

    renderBannerMisi(vm) {
      if (vm.misiAktif) {
        el.bannerMisiTeks.textContent = 'Misi berjalan untuk "' + vm.misiAktif.nama + '". Vault masih terkunci.';
        el.bannerMisi.hidden = false;
      } else {
        el.bannerMisi.hidden = true;
        el.bannerMisiTeks.textContent = '';
      }
    },

    renderDashboard(vm) {
      el.dashAvatar.textContent = vm.profil.avatar;
      el.dashNama.textContent = vm.profil.nama;
      el.dashLevel.textContent = 'Lv. ' + vm.level.level;
      el.dashStreak.textContent = '🔥 Streak ' + vm.streak + ' hari';

      // HP
      el.hpBatang.classList.remove('hp-hijau', 'hp-kuning', 'hp-merah');
      el.hpTeks.className = 'batang-nilai';
      if (vm.hp === null) {
        setBatang(el.hpIsi, 0);
        el.hpBatang.removeAttribute('aria-valuenow');
        el.hpBatang.removeAttribute('aria-valuetext');
        el.hpTeks.textContent = 'Belum aktif';
        el.hpAjakan.hidden = false;
      } else {
        const label = { hijau: 'Aman', kuning: 'Waspada', merah: 'Kritis' }[vm.statusHP];
        setBatang(el.hpIsi, vm.hp);
        el.hpBatang.classList.add('hp-' + vm.statusHP);
        el.hpBatang.setAttribute('aria-valuenow', String(vm.hp));
        el.hpBatang.setAttribute('aria-valuetext', vm.hp + ' dari 100, ' + label);
        el.hpTeks.textContent = vm.hp + '/100 · ' + label;
        el.hpTeks.classList.add('hp-' + vm.statusHP + '-teks');
        el.hpAjakan.hidden = true;
      }

      // EXP
      setBatang(el.expIsi, vm.level.persen);
      el.expBatang.setAttribute('aria-valuenow', String(vm.level.persen));
      el.expBatang.setAttribute('aria-valuetext', vm.level.expDalamLevel + ' dari ' + vm.level.expButuh + ' EXP');
      el.expTeks.textContent = vm.level.expDalamLevel + ' / ' + vm.level.expButuh;

      // Sisa hari, jatah harian, vault
      el.sisaHari.textContent = String(vm.sisaHari);
      el.sisaHariKet.textContent = vm.sisaHari === 0
        ? 'Hari ini gajian! 🎉'
        : 'hari lagi (gajian tanggal ' + vm.profil.tanggalGajian + ')';
      if (vm.jatah === null) {
        el.jatah.textContent = '—';
        el.jatahKet.textContent = 'Isi anggaran bulanan di Profil.';
      } else {
        el.jatah.textContent = Data.formatRupiah(vm.jatah);
        el.jatahKet.textContent = 'Sisa anggaran bulan ini dibagi sisa hari.';
      }
      el.vaultKartu.classList.toggle('terbuka', vm.vault.status === 'terbuka');
      el.vaultIkon.textContent = vm.vault.status === 'terbuka' ? '🔓' : '🔒';
      el.vaultStatus.textContent = vm.vault.status === 'terbuka' ? 'Terbuka' : 'Terkunci';
      if (vm.vault.status === 'menunggu') {
        el.vaultKet.textContent = 'Misi berjalan untuk "' + vm.vault.itemTertunda + '".';
      } else if (vm.vault.status === 'terbuka') {
        el.vaultKet.textContent = 'Membuka "' + vm.vault.itemTertunda + '"…';
      } else if (vm.vault.terakhirDibuka) {
        el.vaultKet.textContent = 'Terakhir dibuka: "' + vm.vault.terakhirDibuka + '".';
      } else {
        el.vaultKet.textContent = 'Selesaikan misi belajar untuk membukanya.';
      }

      // Ringkasan
      el.totalPemasukan.textContent = Data.formatRupiah(vm.ringkasan.pemasukan);
      el.totalPengeluaran.textContent = Data.formatRupiah(vm.ringkasan.pengeluaran);
      el.saldo.textContent = Data.formatRupiah(vm.ringkasan.saldo);
      el.saldo.classList.toggle('negatif', vm.ringkasan.saldo < 0);
      el.peringatanSaldo.hidden = vm.ringkasan.saldo >= 0;

      // 5 transaksi terbaru
      el.terbaru.textContent = '';
      el.terbaruKosong.hidden = vm.terbaru.length > 0;
      for (const t of vm.terbaru) {
        const masuk = t.jenis === K.JENIS.PEMASUKAN;
        const li = buatEl('li', null, 'baris-terbaru');
        const kiri = buatEl('div', null, 'tr-kiri');
        kiri.appendChild(buatEl('span', t.nama, 'tr-nama'));
        kiri.appendChild(buatEl('span',
          t.kategori + ' · ' + t.jenis + (t.tipe ? ' · ' + t.tipe : ''), 'tr-meta'));
        li.appendChild(kiri);
        li.appendChild(buatEl('span', (masuk ? '+ ' : '- ') + Data.formatRupiah(t.jumlah),
          'tr-jumlah ' + (masuk ? 'masuk' : 'keluar')));
        el.terbaru.appendChild(li);
      }
    },

    renderQuest(vm) {
      // Quest harian
      el.questHarianStatus.textContent = vm.misiHariIni ? '✅ Selesai' : 'Belum selesai';
      el.questHarianStatus.classList.toggle('selesai', vm.misiHariIni);

      // Riwayat misi (terbaru di atas, tampil 15 terakhir)
      el.riwayat.textContent = '';
      el.riwayatKosong.hidden = vm.riwayat.length > 0;
      for (const m of vm.riwayat.slice(0, 15)) {
        const selesai = m.status === K.STATUS_MISI.SELESAI;
        const li = buatEl('li', null, 'baris-riwayat');
        li.appendChild(buatEl('span', selesai ? '✅' : '❌', 'riwayat-ikon'));
        const teks = buatEl('div', null, 'riwayat-teks');
        const teknik = m.teknik ? NAMA_TEKNIK[m.teknik] : 'Teknik belum dipilih';
        let judul;
        if (selesai) {
          judul = teknik + ' selesai · +' + m.exp + ' EXP' + (m.bonus ? ' (+' + m.bonus + ' bonus harian)' : '');
        } else {
          judul = 'Dibatalkan · ' + teknik + ' · +0 EXP';
        }
        teks.appendChild(buatEl('span', judul, 'tr-nama'));
        teks.appendChild(buatEl('span', m.nama + ' · ' + Data.formatTanggalWaktu(m.waktu), 'tr-meta'));
        li.appendChild(teks);
        el.riwayat.appendChild(li);
      }
    },

    renderVault(vm) {
      el.isiTabel.textContent = '';
      if (vm.transaksiUrut.length === 0) {
        const baris = buatEl('tr');
        baris.setAttribute('role', 'row');
        const sel = buatEl('td', 'Belum ada transaksi. Tambahkan transaksi pertamamu!', 'kosong');
        sel.colSpan = 7;
        sel.setAttribute('role', 'cell');
        baris.appendChild(sel);
        el.isiTabel.appendChild(baris);
        return;
      }

      for (const t of vm.transaksiUrut) {
        const masuk = t.jenis === K.JENIS.PEMASUKAN;
        const baris = document.createElement('tr');
        baris.setAttribute('role', 'row');

        const sel = (teks, label, kelas) => {
          const td = buatEl('td', teks, kelas);
          td.setAttribute('data-label', label);
          td.setAttribute('role', 'cell');
          return td;
        };

        baris.appendChild(sel(Data.formatTanggal(t.dibuatPada), 'Tanggal'));
        baris.appendChild(sel(t.nama, 'Nama', 'nama-transaksi')); // textContent: aman dari XSS
        baris.appendChild(sel(t.kategori, 'Kategori'));
        baris.appendChild(sel(t.jenis, 'Jenis'));

        const selTipe = sel(null, 'Tipe');
        if (t.tipe) {
          selTipe.appendChild(buatEl('span', t.tipe,
            'lencana ' + (t.tipe === K.TIPE.KEINGINAN ? 'keinginan' : 'kebutuhan')));
        } else {
          selTipe.textContent = '-';
        }
        baris.appendChild(selTipe);

        baris.appendChild(sel((masuk ? '+ ' : '- ') + Data.formatRupiah(t.jumlah), 'Jumlah',
          masuk ? 'jumlah-masuk' : 'jumlah-keluar'));

        const selAksi = sel(null, 'Aksi');
        const tombol = buatEl('button', 'Hapus', 'tombol kecil bahaya');
        tombol.type = 'button';
        tombol.dataset.aksi = 'hapus';
        tombol.dataset.id = t.id; // id unik, bukan index
        tombol.setAttribute('aria-label', 'Hapus transaksi ' + t.nama);
        selAksi.appendChild(tombol);
        baris.appendChild(selAksi);

        el.isiTabel.appendChild(baris);
      }
    },

    renderProfil(vm) {
      el.statLevel.textContent = String(vm.level.level);
      el.statExp.textContent = String(vm.expTotal);
      el.statStreak.textContent = vm.streak + ' hari';
      el.statMisi.textContent = String(vm.jumlahMisiSelesai);

      el.daftarLencana.textContent = '';
      for (const l of vm.lencana) {
        const li = buatEl('li', null, 'lencana-kartu' + (l.terbuka ? ' terbuka' : ''));
        li.appendChild(buatEl('span', l.ikon, 'ikon')).setAttribute('aria-hidden', 'true');
        const info = buatEl('div', null, 'info');
        info.appendChild(buatEl('span', l.nama, 'nama'));
        info.appendChild(buatEl('span', l.deskripsi, 'desk'));
        li.appendChild(info);
        li.appendChild(buatEl('span',
          l.terbuka ? '🏅 Terbuka' : '🔒 ' + l.kemajuan + '/' + l.target, 'status'));
        el.daftarLencana.appendChild(li);
      }
    },

    /* ----- Form profil ----- */

    isiFormProfil(profil) {
      el.profilNama.value = profil.nama;
      el.profilAnggaran.value = profil.anggaran === null ? '' : String(profil.anggaran);
      el.profilGajian.value = String(profil.tanggalGajian);
      for (const r of el.grupAvatar.querySelectorAll('input[name="avatar"]')) r.checked = r.value === profil.avatar;
      this.tampilkanGalatProfil({});
    },

    bacaFormProfil() {
      const avatar = el.grupAvatar.querySelector('input[name="avatar"]:checked');
      return {
        nama: el.profilNama.value,
        avatar: avatar ? avatar.value : '',
        anggaran: el.profilAnggaran.value,
        tanggalGajian: el.profilGajian.value
      };
    },

    tampilkanGalatProfil(galat, opsi) {
      const peta = { nama: el.profilNama, anggaran: el.profilAnggaran, tanggalGajian: el.profilGajian };
      let pertama = null;
      for (const kunci of Object.keys(el.galatProfil)) {
        el.galatProfil[kunci].textContent = galat[kunci] || '';
        const kolom = peta[kunci];
        if (!kolom) continue;
        if (galat[kunci]) {
          kolom.setAttribute('aria-invalid', 'true');
          if (!pertama) pertama = kolom;
          if (opsi && opsi.getar) this.getar(kolom);
        } else {
          kolom.removeAttribute('aria-invalid');
        }
      }
      if (pertama && opsi && opsi.getar) pertama.focus();
    },

    /* ----- Panel misi ----- */

    // Mengunci / membuka kartu teknik sesuai ada-tidaknya misi aktif
    bukaPanelMisi(transaksi) {
      el.misiInfo.textContent =
        'Kamu ingin membeli "' + transaksi.nama + '" seharga ' + Data.formatRupiah(transaksi.jumlah) +
        '. Transaksi ini belum tersimpan.';
      el.misiKosong.hidden = true;
      el.misiAktif.hidden = false;
      for (const r of el.teknikRadio) { r.checked = false; r.disabled = false; } // wajib memilih satu teknik
      el.teknikPetunjuk.textContent = 'Pilih satu teknik. Transaksi baru tersimpan setelah misi selesai.';
      el.bagianPomodoro.hidden = true;
      el.bagianRecall.hidden = true;
      el.misiPilihDulu.hidden = false;
      this.kosongkanRecall();
      this.renderTimer(K.DURASI_POMODORO_MENIT * 60 * 1000);
      this.aturTombolPomodoro(false);
      this.kunciMisi(false);
    },

    tutupPanelMisi() {
      el.misiKosong.hidden = false;
      el.misiAktif.hidden = true;
      for (const r of el.teknikRadio) { r.checked = false; r.disabled = true; }
      el.teknikPetunjuk.textContent =
        'Belum ada misi aktif. Catat pengeluaran bertipe Keinginan di Data Vault untuk memulai misi.';
    },

    // Dipakai saat animasi vault berjalan: semua kontrol misi dimatikan
    kunciMisi(terkunci) {
      for (const r of el.teknikRadio) r.disabled = terkunci;
      el.tombolBatal.disabled = terkunci;
      el.tombolMulai.disabled = terkunci;
      el.tombolReset.disabled = terkunci;
      el.topik.disabled = terkunci;
      el.ringkasan.disabled = terkunci;
      if (terkunci) el.tombolSelesaiRecall.disabled = true;
    },

    tampilkanTeknik(teknik) {
      el.misiPilihDulu.hidden = true;
      el.bagianPomodoro.hidden = teknik !== K.TEKNIK.POMODORO;
      el.bagianRecall.hidden = teknik !== K.TEKNIK.RECALL;
    },

    renderTimer(sisaMs) { el.timer.textContent = formatMenitDetik(sisaMs); },

    aturTombolPomodoro(berjalan) {
      el.tombolMulai.disabled = berjalan;
      el.tombolMulai.textContent = berjalan ? '⏳ Timer Berjalan...' : '▶ Mulai Timer';
    },

    bacaRecall() { return { topik: el.topik.value, ringkasan: el.ringkasan.value }; },

    renderPenghitung(panjang) {
      el.penghitung.textContent = panjang + ' / ' + K.MIN_KARAKTER_RINGKASAN + ' karakter';
      el.penghitung.classList.toggle('cukup', panjang >= K.MIN_KARAKTER_RINGKASAN);
    },

    aturTombolSelesaiRecall(aktif) { el.tombolSelesaiRecall.disabled = !aktif; },

    tampilkanGalatRecall(teks) { el.galatRecall.textContent = teks || ''; },

    kosongkanRecall() {
      el.topik.value = '';
      el.ringkasan.value = '';
      el.galatRecall.textContent = '';
      this.renderPenghitung(0);
      this.aturTombolSelesaiRecall(false);
    },

    /* ----- Overlay: Vault Terbuka & Level Up ----- */

    tampilkanVaultTerbuka(namaItem) {
      el.vaultItem.textContent = namaItem;
      el.overlayVault.hidden = false; // animasi CSS berjalan saat elemen tampil
    },

    sembunyikanVault() {
      el.overlayVault.hidden = true;
      el.vaultItem.textContent = '';
    },

    tampilkanLevelUp(level) {
      el.levelUpTeks.textContent = 'Kamu mencapai Level ' + level + ' 🎉';
      el.overlayLevelUp.hidden = false;
      for (const b of document.querySelectorAll('.lencana-level')) {
        b.classList.remove('naik');
        void b.offsetWidth;
        b.classList.add('naik');
      }
      window.clearTimeout(pewaktuLevelUp);
      pewaktuLevelUp = window.setTimeout(() => { el.overlayLevelUp.hidden = true; }, 3200);
    }
  };

  akar.BDBK.Tampilan = Tampilan;
})(window);
