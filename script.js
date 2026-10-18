/*
 * Belajar Dulu, Belanja Kemudian - Iterasi 1
 *
 * Struktur kode (semua dibungkus IIFE agar tidak ada variabel global):
 *   1. Konfigurasi  : konstanta yang mudah diubah
 *   2. Data         : logika murni (validasi, hitung, buat transaksi) - tanpa DOM
 *   3. Penyimpanan  : baca/tulis localStorage - tanpa DOM
 *   4. Tampilan     : semua operasi DOM (hanya textContent, tanpa innerHTML)
 *   5. Aplikasi     : pengendali yang menghubungkan ketiganya + aturan gamifikasi
 */
(function () {
  'use strict';

  /* ================= 1. KONFIGURASI ================= */

  // Durasi Pomodoro dalam MENIT. Untuk pengujian, ubah angka ini
  // (contoh: 0.1 = 6 detik). Default: 25 menit.
  const DURASI_POMODORO_MENIT = 25;

  // Syarat minimal panjang ringkasan Active Recall (jumlah karakter).
  const MIN_KARAKTER_RINGKASAN = 50;

  const JUMLAH_MAKS = 1000000000000; // batas atas agar penjumlahan tetap aman
  const PANJANG_NAMA_MAKS = 60;
  const KUNCI_PENYIMPANAN = 'bdbk.transaksi.v1';

  const KATEGORI = ['Makan', 'Transport', 'Hiburan', 'Belanja', 'Lainnya'];
  const JENIS = Object.freeze({ PEMASUKAN: 'Pemasukan', PENGELUARAN: 'Pengeluaran' });
  const TIPE = Object.freeze({ KEBUTUHAN: 'Kebutuhan', KEINGINAN: 'Keinginan' });
  const TEKNIK = Object.freeze({ POMODORO: 'pomodoro', RECALL: 'recall' });

  /* ================= 2. DATA (logika murni) ================= */

  const Data = {
    // Format angka ke Rupiah, contoh: 25000 -> "Rp 25.000"
    formatRupiah(angka) {
      const teks = String(Math.abs(angka)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return (angka < 0 ? '-' : '') + 'Rp ' + teks;
    },

    formatTanggal(iso) {
      const d = new Date(iso);
      if (!iso || Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    // Membuat id unik (bukan index array). Memastikan tidak bentrok dengan id yang ada.
    buatId(daftar) {
      const dipakai = new Set(daftar.map((t) => t.id));
      let id;
      do {
        id = (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : 'trx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      } while (dipakai.has(id));
      return id;
    },

    // Validasi input form. Mengembalikan { sah, galat, nilai }.
    validasiInput(masukan) {
      const galat = {};

      // Nama: tidak boleh kosong / hanya spasi
      const nama = String(masukan.nama || '').trim();
      if (!nama) {
        galat.nama = 'Nama transaksi tidak boleh kosong atau hanya spasi.';
      } else if (nama.length > PANJANG_NAMA_MAKS) {
        galat.nama = 'Nama terlalu panjang (maksimal ' + PANJANG_NAMA_MAKS + ' karakter).';
      }

      // Jumlah: wajib bilangan bulat > 0. Regex menolak "-5", "1e3", "12,5", dsb.
      const mentahJumlah = String(masukan.jumlah == null ? '' : masukan.jumlah).trim();
      let jumlah = 0;
      if (mentahJumlah === '') {
        galat.jumlah = 'Jumlah wajib diisi.';
      } else if (!/^\d+$/.test(mentahJumlah)) {
        galat.jumlah = 'Jumlah harus berupa angka bulat lebih dari 0 (tanpa titik, koma, atau minus).';
      } else {
        jumlah = Number(mentahJumlah);
        if (jumlah <= 0) {
          galat.jumlah = 'Jumlah harus lebih dari 0.';
        } else if (jumlah > JUMLAH_MAKS) {
          galat.jumlah = 'Jumlah terlalu besar.';
        }
      }

      // Kategori & jenis: cocokkan dengan daftar resmi (whitelist)
      if (!KATEGORI.includes(masukan.kategori)) {
        galat.kategori = 'Pilih kategori yang valid.';
      }
      if (!Object.values(JENIS).includes(masukan.jenis)) {
        galat.jenis = 'Pilih jenis transaksi.';
      } else if (masukan.jenis === JENIS.PENGELUARAN &&
                 !Object.values(TIPE).includes(masukan.tipe)) {
        // Tipe hanya wajib untuk pengeluaran
        galat.tipe = 'Pilih tipe pengeluaran: Kebutuhan atau Keinginan.';
      }

      return {
        sah: Object.keys(galat).length === 0,
        galat: galat,
        nilai: {
          nama: nama,
          jumlah: jumlah,
          kategori: masukan.kategori,
          jenis: masukan.jenis,
          tipe: masukan.jenis === JENIS.PENGELUARAN ? masukan.tipe : null
        }
      };
    },

    buatTransaksi(nilai, daftar) {
      return {
        id: Data.buatId(daftar),
        nama: nilai.nama,
        jumlah: nilai.jumlah,
        kategori: nilai.kategori,
        jenis: nilai.jenis,
        tipe: nilai.tipe,
        dibuatPada: new Date().toISOString()
      };
    },

    // Aturan gamifikasi: hanya pengeluaran bertipe Keinginan yang butuh misi.
    perluMisi(transaksi) {
      return transaksi.jenis === JENIS.PENGELUARAN && transaksi.tipe === TIPE.KEINGINAN;
    },

    hitungRingkasan(daftar) {
      let pemasukan = 0;
      let pengeluaran = 0;
      for (const t of daftar) {
        if (t.jenis === JENIS.PEMASUKAN) pemasukan += t.jumlah;
        else pengeluaran += t.jumlah;
      }
      return { pemasukan: pemasukan, pengeluaran: pengeluaran, saldo: pemasukan - pengeluaran };
    },

    hapusBerdasarkanId(daftar, id) {
      return daftar.filter((t) => t.id !== id);
    },

    // Normalisasi ringkasan: spasi/baris baru berulang dihitung satu karakter
    // supaya syarat panjang tidak bisa dipenuhi hanya dengan menekan spasi berkali-kali.
    panjangRingkasan(teks) {
      return String(teks || '').trim().replace(/\s+/g, ' ').length;
    },

    // Syarat Active Recall: topik terisi + ringkasan minimal 50 karakter.
    validasiRecall(topik, ringkasan) {
      if (!String(topik || '').trim()) {
        return { sah: false, pesan: 'Tulis topik yang kamu pelajari.' };
      }
      const panjang = Data.panjangRingkasan(ringkasan);
      if (panjang < MIN_KARAKTER_RINGKASAN) {
        return {
          sah: false,
          pesan: 'Ringkasan masih ' + panjang + ' karakter. Minimal ' + MIN_KARAKTER_RINGKASAN + ' karakter.'
        };
      }
      return { sah: true, pesan: '' };
    },

    // Membersihkan data hasil baca localStorage: buang entri rusak / tidak valid.
    bersihkan(mentah) {
      if (!Array.isArray(mentah)) return [];
      const idTerlihat = new Set();
      const hasil = [];
      for (const item of mentah) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.id !== 'string' || !item.id || idTerlihat.has(item.id)) continue;
        const nama = typeof item.nama === 'string' ? item.nama.trim() : '';
        const sahJumlah = Number.isInteger(item.jumlah) && item.jumlah > 0 && item.jumlah <= JUMLAH_MAKS;
        if (!nama || !sahJumlah) continue;
        if (!Object.values(JENIS).includes(item.jenis)) continue;
        if (!KATEGORI.includes(item.kategori)) continue;
        let tipe = null;
        if (item.jenis === JENIS.PENGELUARAN) {
          if (!Object.values(TIPE).includes(item.tipe)) continue;
          tipe = item.tipe;
        }
        idTerlihat.add(item.id);
        hasil.push({
          id: item.id,
          nama: nama,
          jumlah: item.jumlah,
          kategori: item.kategori,
          jenis: item.jenis,
          tipe: tipe,
          dibuatPada: typeof item.dibuatPada === 'string' ? item.dibuatPada : ''
        });
      }
      return hasil;
    }
  };

  /* ================= 3. PENYIMPANAN (localStorage) ================= */

  const Penyimpanan = {
    muat() {
      try {
        const mentah = window.localStorage.getItem(KUNCI_PENYIMPANAN);
        if (!mentah) return [];
        return Data.bersihkan(JSON.parse(mentah));
      } catch (e) {
        // JSON rusak atau localStorage tidak tersedia: mulai dari daftar kosong
        return [];
      }
    },

    // Mengembalikan true jika berhasil, false jika gagal (mis. kuota penuh)
    simpan(daftar) {
      try {
        window.localStorage.setItem(KUNCI_PENYIMPANAN, JSON.stringify(daftar));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  /* ================= 4. TAMPILAN (DOM) ================= */

  const Tampilan = (function () {
    const $ = (id) => document.getElementById(id);

    const el = {
      form: $('form-transaksi'),
      fieldsetForm: $('fieldset-form'),
      nama: $('nama'),
      jumlah: $('jumlah'),
      kategori: $('kategori'),
      tipe: $('tipe'),
      grupTipe: $('grup-tipe'),
      galat: {
        nama: $('galat-nama'),
        jumlah: $('galat-jumlah'),
        kategori: $('galat-kategori'),
        jenis: $('galat-jenis'),
        tipe: $('galat-tipe')
      },
      totalPemasukan: $('total-pemasukan'),
      totalPengeluaran: $('total-pengeluaran'),
      saldo: $('saldo'),
      pesan: $('pesan'),
      isiTabel: $('isi-tabel'),
      panelMisi: $('panel-misi'),
      misiInfo: $('misi-info'),
      bagianPomodoro: $('bagian-pomodoro'),
      bagianRecall: $('bagian-recall'),
      timer: $('timer'),
      tombolMulai: $('tombol-mulai'),
      tombolReset: $('tombol-reset'),
      tombolBatal: $('tombol-batal'),
      topik: $('topik'),
      ringkasan: $('ringkasan'),
      penghitung: $('penghitung'),
      galatRecall: $('galat-recall'),
      tombolSelesaiRecall: $('tombol-selesai-recall')
    };

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

    return {
      el: el,

      isiKategori() {
        for (const k of KATEGORI) {
          const opsi = document.createElement('option');
          opsi.value = k;
          opsi.textContent = k;
          el.kategori.appendChild(opsi);
        }
      },

      bacaForm() {
        const jenisDipilih = el.form.querySelector('input[name="jenis"]:checked');
        return {
          nama: el.nama.value,
          jumlah: el.jumlah.value,
          kategori: el.kategori.value,
          jenis: jenisDipilih ? jenisDipilih.value : '',
          tipe: el.tipe.value
        };
      },

      jenisTerpilih() {
        const j = el.form.querySelector('input[name="jenis"]:checked');
        return j ? j.value : '';
      },

      tampilkanGalat(galat) {
        const peta = {
          nama: el.nama, jumlah: el.jumlah, kategori: el.kategori, tipe: el.tipe
        };
        for (const kunci of Object.keys(el.galat)) {
          el.galat[kunci].textContent = galat[kunci] || '';
          if (peta[kunci]) {
            if (galat[kunci]) peta[kunci].setAttribute('aria-invalid', 'true');
            else peta[kunci].removeAttribute('aria-invalid');
          }
        }
      },

      // Kolom "tipe pengeluaran" hanya relevan untuk Pengeluaran
      aturTipeTerlihat(jenis) {
        el.grupTipe.hidden = jenis !== JENIS.PENGELUARAN;
        if (jenis !== JENIS.PENGELUARAN) el.tipe.value = '';
      },

      resetForm() {
        el.form.reset();
        Tampilan_aturSetelahReset();
      },

      kunciForm(terkunci) {
        el.fieldsetForm.disabled = terkunci;
      },

      tampilkanPesan(teks, jenis) {
        el.pesan.textContent = teks;
        el.pesan.className = 'pesan ' + (jenis || 'info');
        el.pesan.hidden = false;
      },

      sembunyikanPesan() {
        el.pesan.hidden = true;
        el.pesan.textContent = '';
      },

      renderRingkasan(r) {
        el.totalPemasukan.textContent = Data.formatRupiah(r.pemasukan);
        el.totalPengeluaran.textContent = Data.formatRupiah(r.pengeluaran);
        el.saldo.textContent = Data.formatRupiah(r.saldo);
        el.saldo.classList.toggle('negatif', r.saldo < 0);
      },

      renderTabel(daftar) {
        el.isiTabel.textContent = ''; // kosongkan isi tabel (aman)

        if (daftar.length === 0) {
          const baris = document.createElement('tr');
          const sel = buatEl('td', 'Belum ada transaksi. Tambahkan transaksi pertamamu!', 'kosong');
          sel.colSpan = 7;
          baris.appendChild(sel);
          el.isiTabel.appendChild(baris);
          return;
        }

        for (const t of daftar) {
          const baris = document.createElement('tr');
          const masuk = t.jenis === JENIS.PEMASUKAN;

          baris.appendChild(buatEl('td', Data.formatTanggal(t.dibuatPada)));
          baris.appendChild(buatEl('td', t.nama)); // textContent: aman dari XSS
          baris.appendChild(buatEl('td', t.kategori));
          baris.appendChild(buatEl('td', t.jenis));

          const selTipe = document.createElement('td');
          if (t.tipe) {
            selTipe.appendChild(buatEl('span', t.tipe,
              'lencana ' + (t.tipe === TIPE.KEINGINAN ? 'keinginan' : 'kebutuhan')));
          } else {
            selTipe.textContent = '-';
          }
          baris.appendChild(selTipe);

          baris.appendChild(buatEl('td',
            (masuk ? '+ ' : '- ') + Data.formatRupiah(t.jumlah),
            masuk ? 'jumlah-masuk' : 'jumlah-keluar'));

          const selAksi = document.createElement('td');
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

      /* ----- Panel Misi ----- */

      bukaPanelMisi(transaksi) {
        el.misiInfo.textContent =
          'Kamu ingin membeli "' + transaksi.nama + '" seharga ' +
          Data.formatRupiah(transaksi.jumlah) + '. Transaksi ini belum tersimpan.';
        // Belum ada teknik terpilih: user wajib memilih satu
        for (const r of el.panelMisi.querySelectorAll('input[name="teknik"]')) r.checked = false;
        el.bagianPomodoro.hidden = true;
        el.bagianRecall.hidden = true;
        this.kosongkanRecall();
        this.renderTimer(DURASI_POMODORO_MENIT * 60 * 1000);
        this.aturTombolPomodoro(false);
        el.panelMisi.hidden = false;
        el.panelMisi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },

      tutupPanelMisi() {
        el.panelMisi.hidden = true;
      },

      tampilkanTeknik(teknik) {
        el.bagianPomodoro.hidden = teknik !== TEKNIK.POMODORO;
        el.bagianRecall.hidden = teknik !== TEKNIK.RECALL;
      },

      renderTimer(sisaMs) {
        el.timer.textContent = formatMenitDetik(sisaMs);
      },

      aturTombolPomodoro(berjalan) {
        el.tombolMulai.disabled = berjalan;
        el.tombolMulai.textContent = berjalan ? 'Timer Berjalan...' : 'Mulai Timer';
      },

      bacaRecall() {
        return { topik: el.topik.value, ringkasan: el.ringkasan.value };
      },

      renderPenghitung(panjang) {
        el.penghitung.textContent = panjang + ' / ' + MIN_KARAKTER_RINGKASAN + ' karakter';
        el.penghitung.classList.toggle('cukup', panjang >= MIN_KARAKTER_RINGKASAN);
      },

      aturTombolSelesaiRecall(aktif) {
        el.tombolSelesaiRecall.disabled = !aktif;
      },

      tampilkanGalatRecall(teks) {
        el.galatRecall.textContent = teks || '';
      },

      kosongkanRecall() {
        el.topik.value = '';
        el.ringkasan.value = '';
        el.galatRecall.textContent = '';
        this.renderPenghitung(0);
        this.aturTombolSelesaiRecall(false);
      }
    };

    // Dipakai setelah form.reset(): kembalikan tampilan kolom tipe & galat
    function Tampilan_aturSetelahReset() {
      el.grupTipe.hidden = false; // default jenis = Pengeluaran
      for (const kunci of Object.keys(el.galat)) el.galat[kunci].textContent = '';
      for (const f of [el.nama, el.jumlah, el.kategori, el.tipe]) f.removeAttribute('aria-invalid');
    }
  })();

  /* ================= 5. APLIKASI (pengendali + gamifikasi) ================= */

  const Aplikasi = (function () {
    const el = Tampilan.el;

    // State aplikasi (privat di dalam closure)
    const state = {
      daftar: [],      // transaksi yang sudah tersimpan
      tertunda: null   // transaksi Keinginan yang menunggu misi selesai (BELUM disimpan)
    };

    /* ----- Pomodoro ----- */
    const Pomodoro = {
      idInterval: null,
      waktuSelesai: 0,

      mulai() {
        if (this.idInterval !== null) return;
        const durasiMs = DURASI_POMODORO_MENIT * 60 * 1000;
        // Pakai waktu selesai absolut (bukan hitung tick) agar akurat
        // walau tab sempat berjalan lambat di latar belakang.
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
          selesaikanMisi('Pomodoro');
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
        Tampilan.renderTimer(DURASI_POMODORO_MENIT * 60 * 1000);
      }
    };

    /* ----- Alur transaksi ----- */

    function perbaruiTampilanData() {
      Tampilan.renderRingkasan(Data.hitungRingkasan(state.daftar));
      Tampilan.renderTabel(state.daftar);
    }

    // Menyimpan transaksi ke daftar + localStorage. Mengembalikan true jika berhasil.
    function simpanTransaksi(transaksi) {
      const daftarBaru = [transaksi].concat(state.daftar);
      if (!Penyimpanan.simpan(daftarBaru)) return false;
      state.daftar = daftarBaru;
      perbaruiTampilanData();
      return true;
    }

    function bukaMisi(transaksi) {
      state.tertunda = transaksi;
      Tampilan.kunciForm(true); // cegah transaksi lain selama misi berlangsung
      Tampilan.sembunyikanPesan();
      Tampilan.bukaPanelMisi(transaksi);
    }

    function tutupMisi() {
      Pomodoro.hentikan();
      state.tertunda = null;
      Tampilan.tutupPanelMisi();
      Tampilan.kunciForm(false);
    }

    // Dipanggil saat syarat teknik terpenuhi: simpan transaksi Keinginan.
    function selesaikanMisi(namaTeknik) {
      const transaksi = state.tertunda;
      if (!transaksi) return; // pengaman: tidak ada misi aktif
      tutupMisi();
      if (simpanTransaksi(transaksi)) {
        Tampilan.resetForm();
        Tampilan.tampilkanPesan(
          'Misi ' + namaTeknik + ' selesai! Transaksi "' + transaksi.nama + '" kini tersimpan.',
          'sukses');
      } else {
        Tampilan.tampilkanPesan(
          'Misi selesai, tetapi penyimpanan gagal (localStorage penuh atau dinonaktifkan). ' +
          'Transaksi tidak tersimpan.', 'galat');
      }
    }

    function batalkanMisi() {
      const nama = state.tertunda ? state.tertunda.nama : '';
      tutupMisi(); // transaksi tertunda dibuang, tidak pernah disimpan
      Tampilan.tampilkanPesan(
        'Misi dibatalkan. Transaksi "' + nama + '" tidak disimpan.', 'info');
    }

    /* ----- Penanganan event ----- */

    function saatFormDikirim(e) {
      e.preventDefault();
      if (state.tertunda) return; // masih ada misi aktif

      const hasil = Data.validasiInput(Tampilan.bacaForm());
      Tampilan.tampilkanGalat(hasil.galat);
      if (!hasil.sah) {
        Tampilan.tampilkanPesan('Periksa kembali isian formulir.', 'galat');
        return;
      }

      const transaksi = Data.buatTransaksi(hasil.nilai, state.daftar);

      if (Data.perluMisi(transaksi)) {
        // KEINGINAN: jangan simpan dulu, minta user menyelesaikan misi
        bukaMisi(transaksi);
        return;
      }

      // Pemasukan atau pengeluaran KEBUTUHAN: langsung tersimpan
      if (simpanTransaksi(transaksi)) {
        Tampilan.resetForm();
        Tampilan.tampilkanPesan('Transaksi "' + transaksi.nama + '" tersimpan.', 'sukses');
      } else {
        Tampilan.tampilkanPesan(
          'Gagal menyimpan ke localStorage (penuh atau dinonaktifkan).', 'galat');
      }
    }

    function saatTabelDiklik(e) {
      const tombol = e.target.closest('button[data-aksi="hapus"]');
      if (!tombol) return;
      const id = tombol.dataset.id;
      const target = state.daftar.find((t) => t.id === id);
      if (!target) return;
      if (!window.confirm('Hapus transaksi "' + target.nama + '"?')) return;

      const daftarBaru = Data.hapusBerdasarkanId(state.daftar, id);
      if (Penyimpanan.simpan(daftarBaru)) {
        state.daftar = daftarBaru;
        perbaruiTampilanData();
        Tampilan.tampilkanPesan('Transaksi dihapus.', 'info');
      } else {
        Tampilan.tampilkanPesan('Gagal menyimpan perubahan ke localStorage.', 'galat');
      }
    }

    function saatTeknikDipilih(e) {
      if (e.target.name !== 'teknik') return;
      // Pindah teknik di tengah jalan: hentikan timer agar tidak berjalan tersembunyi
      Pomodoro.reset();
      Tampilan.tampilkanTeknik(e.target.value);
    }

    // Dipanggil setiap user mengetik di form Active Recall
    function perbaruiRecall() {
      const { topik, ringkasan } = Tampilan.bacaRecall();
      Tampilan.renderPenghitung(Data.panjangRingkasan(ringkasan));
      Tampilan.aturTombolSelesaiRecall(Data.validasiRecall(topik, ringkasan).sah);
      Tampilan.tampilkanGalatRecall('');
    }

    function saatSelesaiRecall() {
      const { topik, ringkasan } = Tampilan.bacaRecall();
      const hasil = Data.validasiRecall(topik, ringkasan); // cek ulang, jangan percaya tombol
      if (!hasil.sah) {
        Tampilan.tampilkanGalatRecall(hasil.pesan);
        return;
      }
      selesaikanMisi('Active Recall');
    }

    function mulai() {
      Tampilan.isiKategori();
      state.daftar = Penyimpanan.muat();
      perbaruiTampilanData();
      Tampilan.aturTipeTerlihat(Tampilan.jenisTerpilih());

      el.form.addEventListener('submit', saatFormDikirim);
      el.form.addEventListener('change', (e) => {
        if (e.target.name === 'jenis') Tampilan.aturTipeTerlihat(e.target.value);
      });
      el.isiTabel.addEventListener('click', saatTabelDiklik);

      el.panelMisi.addEventListener('change', saatTeknikDipilih);
      el.tombolMulai.addEventListener('click', () => Pomodoro.mulai());
      el.tombolReset.addEventListener('click', () => Pomodoro.reset());
      el.topik.addEventListener('input', perbaruiRecall);
      el.ringkasan.addEventListener('input', perbaruiRecall);
      el.tombolSelesaiRecall.addEventListener('click', saatSelesaiRecall);
      el.tombolBatal.addEventListener('click', batalkanMisi);
    }

    return { mulai: mulai };
  })();

  Aplikasi.mulai();
})();
