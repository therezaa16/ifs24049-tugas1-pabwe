/*
 * data.js — LOGIKA DATA
 *
 * Murni: tanpa DOM, tanpa localStorage. Semua fungsi yang bergantung pada waktu
 * menerima "sekarang" (objek Date) sebagai PARAMETER, jadi bisa diuji dengan
 * tanggal apa pun (lihat tests/data.test.js).
 *
 * Satu-satunya fungsi yang tidak murni sengaja dipisah: buatId() (memakai acak).
 */
(function (akar) {
  'use strict';

  const K = (typeof module !== 'undefined' && module.exports)
    ? require('./konfigurasi.js')
    : akar.BDBK.Konfigurasi;

  const JENIS = K.JENIS;
  const TIPE = K.TIPE;
  const TEKNIK = K.TEKNIK;
  const STATUS = K.STATUS_MISI;

  /* ================= Format ================= */

  // 25000 -> "Rp 25.000". Pecahan dibuang (dibulatkan ke bawah), negatif diberi tanda minus.
  function formatRupiah(angka) {
    const n = Number.isFinite(angka) ? angka : 0;
    const bulat = Math.floor(Math.abs(n));
    const teks = String(bulat).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 && bulat > 0 ? '-' : '') + 'Rp ' + teks;
  }

  function formatTanggal(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatTanggalWaktu(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  /* ================= Tanggal (kalender LOKAL, bukan UTC) ================= */

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Tanggal lokal "YYYY-MM-DD". Sengaja TIDAK memakai toISOString() karena itu UTC:
  // pukul 00:30 WIB toISOString() masih menghasilkan tanggal kemarin.
  function tanggalLokal(sekarang) {
    return sekarang.getFullYear() + '-' + pad2(sekarang.getMonth() + 1) + '-' + pad2(sekarang.getDate());
  }

  // "YYYY-MM-DD" -> { tahun, bulan, hari } atau null jika bukan tanggal kalender yang sah.
  function uraiTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof teks === 'string' ? teks : '');
    if (!m) return null;
    const tahun = Number(m[1]);
    const bulan = Number(m[2]);
    const hari = Number(m[3]);
    const d = new Date(Date.UTC(tahun, bulan - 1, hari));
    if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari) return null;
    return { tahun: tahun, bulan: bulan, hari: hari };
  }

  // Nomor hari kalender (bilangan bulat). Selisih dua nomor = selisih hari kalender,
  // tidak terpengaruh zona waktu atau perpindahan jam musim panas.
  function nomorHari(tahun, bulan, hari) {
    return Math.round(Date.UTC(tahun, bulan - 1, hari) / 86400000);
  }

  function jumlahHariDalamBulan(tahun, bulan) {
    return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate(); // hari ke-0 bulan berikutnya
  }

  /* ================= Validasi ================= */

  function gagal(galat) { return { sah: false, kosong: false, nilai: 0, galat: galat }; }

  // Memeriksa teks angka bulat positif. Pesan galat dibuat SPESIFIK sesuai kesalahannya
  // (iterasi 1 selalu bilang "wajib diisi" walau kolom berisi huruf).
  function periksaAngkaTeks(mentah, label) {
    const teks = String(mentah == null ? '' : mentah).trim();
    if (teks === '') return { sah: false, kosong: true, nilai: 0, galat: label + ' wajib diisi.' };
    if (/^[-−–]/.test(teks)) {
      return gagal(label + ' tidak boleh negatif. Tulis angka positif, contoh: 25000.');
    }
    if (/^[\d.,]+$/.test(teks) && /[.,]/.test(teks)) {
      return gagal('Tulis angka saja tanpa titik atau koma, contoh: 25000 (bukan 25.000).');
    }
    if (!/^\d+$/.test(teks)) {
      return gagal(label + ' hanya boleh berisi angka 0-9, contoh: 25000.');
    }
    const nilai = Number(teks);
    if (nilai <= 0) return gagal(label + ' harus lebih dari 0.');
    if (nilai > K.JUMLAH_MAKS) {
      return gagal(label + ' terlalu besar (maksimal ' + formatRupiah(K.JUMLAH_MAKS) + ').');
    }
    return { sah: true, kosong: false, nilai: nilai, galat: '' };
  }

  // Validasi form transaksi. Mengembalikan { sah, galat, nilai }.
  function validasiInput(masukan) {
    const galat = {};

    // Nama: tidak boleh kosong / hanya spasi
    const nama = String(masukan.nama || '').trim();
    if (!nama) {
      galat.nama = 'Nama transaksi tidak boleh kosong atau hanya spasi.';
    } else if (nama.length > K.PANJANG_NAMA_MAKS) {
      galat.nama = 'Nama terlalu panjang (maksimal ' + K.PANJANG_NAMA_MAKS + ' karakter).';
    }

    // Jumlah: wajib bilangan bulat > 0
    const jumlah = periksaAngkaTeks(masukan.jumlah, 'Jumlah');
    if (!jumlah.sah) galat.jumlah = jumlah.galat;

    // Kategori & jenis dicocokkan dengan daftar resmi (whitelist)
    if (!K.KATEGORI.includes(masukan.kategori)) {
      galat.kategori = 'Pilih kategori yang valid.';
    }
    if (!Object.values(JENIS).includes(masukan.jenis)) {
      galat.jenis = 'Pilih jenis transaksi.';
    } else if (masukan.jenis === JENIS.PENGELUARAN && !Object.values(TIPE).includes(masukan.tipe)) {
      galat.tipe = 'Pilih tipe pengeluaran: Kebutuhan atau Keinginan.';
    }

    return {
      sah: Object.keys(galat).length === 0,
      galat: galat,
      nilai: {
        nama: nama,
        jumlah: jumlah.sah ? jumlah.nilai : 0,
        kategori: masukan.kategori,
        jenis: masukan.jenis,
        tipe: masukan.jenis === JENIS.PENGELUARAN ? masukan.tipe : null
      }
    };
  }

  // Validasi form profil. Anggaran boleh kosong (= belum diisi -> null).
  function validasiProfil(masukan) {
    const galat = {};

    const nama = String(masukan.nama || '').trim().replace(/\s+/g, ' ');
    if (!nama) {
      galat.nama = 'Nama tidak boleh kosong atau hanya spasi.';
    } else if (nama.length > K.PANJANG_NAMA_PROFIL_MAKS) {
      galat.nama = 'Nama terlalu panjang (maksimal ' + K.PANJANG_NAMA_PROFIL_MAKS + ' karakter).';
    }

    if (!K.AVATAR.includes(masukan.avatar)) {
      galat.avatar = 'Pilih salah satu avatar.';
    }

    let anggaran = null;
    const mentahAnggaran = String(masukan.anggaran == null ? '' : masukan.anggaran).trim();
    if (mentahAnggaran !== '') {
      const p = periksaAngkaTeks(mentahAnggaran, 'Anggaran');
      if (p.sah) anggaran = p.nilai;
      else galat.anggaran = p.galat;
    }

    const mentahGajian = String(masukan.tanggalGajian == null ? '' : masukan.tanggalGajian).trim();
    const gajian = /^\d{1,2}$/.test(mentahGajian) ? Number(mentahGajian) : 0;
    if (gajian < 1 || gajian > 31) {
      galat.tanggalGajian = 'Tanggal gajian harus antara 1 dan 31.';
    }

    return {
      sah: Object.keys(galat).length === 0,
      galat: galat,
      nilai: { nama: nama, avatar: masukan.avatar, anggaran: anggaran, tanggalGajian: gajian }
    };
  }

  // Normalisasi ringkasan: spasi/baris baru berulang dihitung satu karakter
  // supaya syarat panjang tidak bisa dipenuhi hanya dengan menekan spasi berkali-kali.
  function panjangRingkasan(teks) {
    return String(teks || '').trim().replace(/\s+/g, ' ').length;
  }

  // Syarat Active Recall: topik terisi + ringkasan minimal 50 karakter.
  function validasiRecall(topik, ringkasan) {
    if (!String(topik || '').trim()) {
      return { sah: false, pesan: 'Tulis topik yang kamu pelajari.' };
    }
    const panjang = panjangRingkasan(ringkasan);
    if (panjang < K.MIN_KARAKTER_RINGKASAN) {
      return {
        sah: false,
        pesan: 'Ringkasan masih ' + panjang + ' karakter. Minimal ' + K.MIN_KARAKTER_RINGKASAN + ' karakter.'
      };
    }
    return { sah: true, pesan: '' };
  }

  /* ================= Transaksi ================= */

  // Id unik (bukan index array). Memastikan tidak bentrok dengan id yang sudah ada.
  // Tidak murni (memakai acak), sengaja dipisah dari fungsi hitung.
  function buatId(daftar) {
    const dipakai = new Set(daftar.map((t) => t.id));
    const gudang = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    let id;
    do {
      id = (gudang && typeof gudang.randomUUID === 'function')
        ? gudang.randomUUID()
        : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    } while (dipakai.has(id));
    return id;
  }

  function buatTransaksi(nilai, daftar, sekarang) {
    return {
      id: buatId(daftar),
      nama: nilai.nama,
      jumlah: nilai.jumlah,
      kategori: nilai.kategori,
      jenis: nilai.jenis,
      tipe: nilai.tipe,
      dibuatPada: (sekarang || new Date()).toISOString()
    };
  }

  // Aturan gamifikasi: hanya pengeluaran bertipe Keinginan yang butuh misi.
  function perluMisi(transaksi) {
    return transaksi.jenis === JENIS.PENGELUARAN && transaksi.tipe === TIPE.KEINGINAN;
  }

  function hitungRingkasan(daftar) {
    let pemasukan = 0;
    let pengeluaran = 0;
    for (const t of daftar) {
      if (t.jenis === JENIS.PEMASUKAN) pemasukan += t.jumlah;
      else pengeluaran += t.jumlah;
    }
    return { pemasukan: pemasukan, pengeluaran: pengeluaran, saldo: pemasukan - pengeluaran };
  }

  // Kebijakan saldo negatif: pengeluaran yang membuat saldo < 0 harus dikonfirmasi pengguna.
  function akanSaldoNegatif(saldoSekarang, transaksi) {
    return transaksi.jenis === JENIS.PENGELUARAN && (saldoSekarang - transaksi.jumlah) < 0;
  }

  function hapusBerdasarkanId(daftar, id) {
    return daftar.filter((t) => t.id !== id);
  }

  // Urut terbaru -> terlama. Tanggal tidak valid diletakkan paling akhir.
  function urutkanTerbaru(daftar) {
    const waktu = (t) => { const w = Date.parse(t.dibuatPada); return Number.isNaN(w) ? -Infinity : w; };
    return daftar
      .map((t, i) => ({ t: t, i: i }))
      .sort((a, b) => (waktu(b.t) - waktu(a.t)) || (a.i - b.i))
      .map((x) => x.t);
  }

  /* ================= Hitungan anggaran ================= */

  function anggaranValid(anggaran) {
    return typeof anggaran === 'number' && Number.isFinite(anggaran) && anggaran > 0;
  }

  // Total pengeluaran pada bulan KALENDER yang sama dengan "sekarang" (waktu lokal).
  function hitungPengeluaranBulanIni(daftar, sekarang) {
    const tahun = sekarang.getFullYear();
    const bulan = sekarang.getMonth();
    let total = 0;
    for (const t of daftar) {
      if (t.jenis !== JENIS.PENGELUARAN) continue;
      const d = new Date(t.dibuatPada);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === tahun && d.getMonth() === bulan) total += t.jumlah;
    }
    return total;
  }

  // HP (0-100) = (anggaran - pengeluaran bulan ini) / anggaran x 100, dibatasi 0..100.
  // Dibulatkan ke bilangan bulat terdekat supaya angka dan warna selalu konsisten.
  // Mengembalikan null jika anggaran belum diisi (UI menampilkan ajakan mengisi).
  function hitungHP(anggaran, pengeluaranBulanIni) {
    if (!anggaranValid(anggaran)) return null;
    const mentah = ((anggaran - pengeluaranBulanIni) / anggaran) * 100;
    return Math.round(Math.min(100, Math.max(0, mentah)));
  }

  // Hijau di atas 50, kuning 20-50, merah di bawah 20.
  function statusHP(hp) {
    if (hp === null || hp === undefined) return 'kosong';
    if (hp > K.HP_BATAS_HIJAU) return 'hijau';
    if (hp >= K.HP_BATAS_KUNING) return 'kuning';
    return 'merah';
  }

  // Jumlah hari dari hari ini sampai gajian berikutnya (0 = hari ini gajian).
  // Bulan pendek: gajian tanggal 31 di Februari jatuh pada tanggal terakhir bulan itu.
  function hitungSisaHariGajian(sekarang, tanggalGajian) {
    const tahun = sekarang.getFullYear();
    const bulan = sekarang.getMonth() + 1;
    const hari = sekarang.getDate();
    const g = (Number.isInteger(tanggalGajian) && tanggalGajian >= 1 && tanggalGajian <= 31)
      ? tanggalGajian : K.TANGGAL_GAJIAN_DEFAULT;

    const gajianBulanIni = Math.min(g, jumlahHariDalamBulan(tahun, bulan));
    let tTahun = tahun;
    let tBulan = bulan;
    let tHari = gajianBulanIni;
    if (hari > gajianBulanIni) { // gajian bulan ini sudah lewat -> bulan depan
      tBulan = bulan + 1;
      if (tBulan > 12) { tBulan = 1; tTahun = tahun + 1; }
      tHari = Math.min(g, jumlahHariDalamBulan(tTahun, tBulan));
    }
    return nomorHari(tTahun, tBulan, tHari) - nomorHari(tahun, bulan, hari);
  }

  // Jatah harian = max(0, sisa anggaran) / max(1, sisa hari). Nilai pecahan apa adanya;
  // formatRupiah() membulatkan ke bawah saat ditampilkan. null jika anggaran belum diisi.
  function hitungJatahHarian(anggaran, pengeluaranBulanIni, sisaHari) {
    if (!anggaranValid(anggaran)) return null;
    const sisaAnggaran = Math.max(0, anggaran - pengeluaranBulanIni);
    return sisaAnggaran / Math.max(1, sisaHari);
  }

  /* ================= Gamifikasi: EXP & level ================= */

  // Pomodoro selesai +30, Active Recall selesai +20, misi dibatalkan +0.
  function expUntukMisi(teknik, status) {
    if (status !== STATUS.SELESAI) return 0;
    if (teknik === TEKNIK.POMODORO) return K.EXP_POMODORO;
    if (teknik === TEKNIK.RECALL) return K.EXP_RECALL;
    return 0;
  }

  // Total EXP dihitung ulang dari riwayat (bukan disimpan), jadi tidak bisa "melenceng".
  function hitungExpTotal(gam) {
    let total = gam.bonusHarian.length * K.EXP_BONUS_HARIAN;
    for (const m of gam.misi) total += expUntukMisi(m.teknik, m.status);
    return total;
  }

  // Naik dari level N ke N+1 butuh 100 x N EXP.
  function hitungLevel(totalExp) {
    let sisa = Number.isFinite(totalExp) ? Math.max(0, Math.floor(totalExp)) : 0;
    let level = 1;
    while (sisa >= K.EXP_PER_LEVEL * level) {
      sisa -= K.EXP_PER_LEVEL * level;
      level += 1;
    }
    const butuh = K.EXP_PER_LEVEL * level;
    return {
      level: level,
      expDalamLevel: sisa,
      expButuh: butuh,
      persen: Math.floor((sisa / butuh) * 100)
    };
  }

  /* ================= Gamifikasi: streak & lencana ================= */

  // Daftar tanggal lokal (unik, urut naik) yang punya minimal 1 misi SELESAI.
  function tanggalMisiSelesai(gam) {
    const set = new Set();
    for (const m of gam.misi) if (m.status === STATUS.SELESAI) set.add(m.tanggal);
    return Array.from(set).sort();
  }

  function kumpulanNomorHari(daftarTanggal) {
    const set = new Set();
    for (const t of daftarTanggal) {
      const p = uraiTanggal(t);
      if (p) set.add(nomorHari(p.tahun, p.bulan, p.hari));
    }
    return set;
  }

  // Streak = hari berturut-turut dengan minimal 1 misi selesai, memakai TANGGAL LOKAL.
  // Jika hari ini belum ada misi, streak kemarin masih dihitung (belum putus
  // sampai hari ini berakhir).
  function hitungStreak(daftarTanggal, sekarang) {
    const ada = kumpulanNomorHari(daftarTanggal);
    let n = nomorHari(sekarang.getFullYear(), sekarang.getMonth() + 1, sekarang.getDate());
    if (!ada.has(n)) n -= 1;
    let streak = 0;
    while (ada.has(n)) { streak += 1; n -= 1; }
    return streak;
  }

  function hitungStreakTerpanjang(daftarTanggal) {
    const urut = Array.from(kumpulanNomorHari(daftarTanggal)).sort((a, b) => a - b);
    let terpanjang = 0;
    let berjalan = 0;
    for (let i = 0; i < urut.length; i++) {
      berjalan = (i > 0 && urut[i] === urut[i - 1] + 1) ? berjalan + 1 : 1;
      if (berjalan > terpanjang) terpanjang = berjalan;
    }
    return terpanjang;
  }

  // Tiga lencana. Dihitung dari riwayat, jadi tetap terbuka walau streak kemudian putus.
  function hitungLencana(gam) {
    const selesai = gam.misi.filter((m) => m.status === STATUS.SELESAI);
    const pomodoro = selesai.filter((m) => m.teknik === TEKNIK.POMODORO).length;
    const terpanjang = hitungStreakTerpanjang(tanggalMisiSelesai(gam));
    return [
      { id: 'langkah-pertama', nama: 'Langkah Pertama', ikon: '👣',
        deskripsi: 'Selesaikan misi pertamamu.', kemajuan: Math.min(selesai.length, 1), target: 1 },
      { id: 'pejuang-fokus', nama: 'Pejuang Fokus', ikon: '🎯',
        deskripsi: 'Selesaikan 5 misi Pomodoro.', kemajuan: Math.min(pomodoro, 5), target: 5 },
      { id: 'konsisten', nama: 'Konsisten', ikon: '🔥',
        deskripsi: 'Capai streak 3 hari berturut-turut.', kemajuan: Math.min(terpanjang, 3), target: 3 }
    ].map((l) => Object.assign(l, { terbuka: l.kemajuan >= l.target }));
  }

  function sudahMisiHariIni(gam, sekarang) {
    const hari = tanggalLokal(sekarang);
    return gam.misi.some((m) => m.status === STATUS.SELESAI && m.tanggal === hari);
  }

  /* ================= Gamifikasi: mencatat misi ================= */

  function gamifikasiKosong() { return { misi: [], bonusHarian: [] }; }

  // Mencatat hasil sebuah misi (selesai / batal). MURNI: tidak mengubah `gam`,
  // mengembalikan salinan baru beserta ringkasan perubahan (EXP, level, lencana baru).
  // entri: { id, teknik (boleh null jika batal), status, nama, jumlah, topik }
  function catatMisi(gam, entri, sekarang) {
    const levelSebelum = hitungLevel(hitungExpTotal(gam)).level;
    const lencanaSebelum = new Set(hitungLencana(gam).filter((l) => l.terbuka).map((l) => l.id));

    const hari = tanggalLokal(sekarang);
    const bonusHarian = gam.bonusHarian.slice();
    let expBonus = 0;
    // Bonus quest harian: sekali per hari, hanya untuk misi yang SELESAI.
    if (entri.status === STATUS.SELESAI && !bonusHarian.includes(hari)) {
      bonusHarian.push(hari);
      expBonus = K.EXP_BONUS_HARIAN;
    }

    const expMisi = expUntukMisi(entri.teknik, entri.status);
    const rekam = {
      id: entri.id,
      teknik: entri.teknik || null,
      status: entri.status,
      exp: expMisi,
      bonus: expBonus,
      tanggal: hari,
      waktu: sekarang.toISOString(),
      nama: String(entri.nama || '-'),
      jumlah: Number.isInteger(entri.jumlah) && entri.jumlah >= 0 ? entri.jumlah : 0,
      topik: entri.topik ? String(entri.topik).trim().slice(0, 100) : ''
    };

    const baru = { misi: gam.misi.concat([rekam]), bonusHarian: bonusHarian };
    const levelSesudah = hitungLevel(hitungExpTotal(baru)).level;

    return {
      gamifikasi: baru,
      expMisi: expMisi,
      expBonus: expBonus,
      levelSebelum: levelSebelum,
      levelSesudah: levelSesudah,
      naikLevel: levelSesudah > levelSebelum,
      lencanaBaru: hitungLencana(baru).filter((l) => l.terbuka && !lencanaSebelum.has(l.id))
    };
  }

  /* ================= Pembersih data (hasil baca localStorage) ================= */

  function bersihkanTransaksi(mentah) {
    if (!Array.isArray(mentah)) return [];
    const idTerlihat = new Set();
    const hasil = [];
    for (const item of mentah) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.id !== 'string' || !item.id || idTerlihat.has(item.id)) continue;
      const nama = typeof item.nama === 'string' ? item.nama.trim() : '';
      const sahJumlah = Number.isInteger(item.jumlah) && item.jumlah > 0 && item.jumlah <= K.JUMLAH_MAKS;
      if (!nama || !sahJumlah) continue;
      if (!Object.values(JENIS).includes(item.jenis)) continue;
      if (!K.KATEGORI.includes(item.kategori)) continue;
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

  function profilDefault() {
    return {
      nama: K.NAMA_PROFIL_DEFAULT,
      avatar: K.AVATAR_DEFAULT,
      anggaran: null,
      tanggalGajian: K.TANGGAL_GAJIAN_DEFAULT
    };
  }

  function bersihkanProfil(mentah) {
    const dasar = profilDefault();
    if (!mentah || typeof mentah !== 'object') return dasar;
    const nama = typeof mentah.nama === 'string'
      ? mentah.nama.trim().replace(/\s+/g, ' ').slice(0, K.PANJANG_NAMA_PROFIL_MAKS) : '';
    return {
      nama: nama || dasar.nama,
      avatar: K.AVATAR.includes(mentah.avatar) ? mentah.avatar : dasar.avatar,
      anggaran: (Number.isInteger(mentah.anggaran) && mentah.anggaran > 0 && mentah.anggaran <= K.JUMLAH_MAKS)
        ? mentah.anggaran : null,
      tanggalGajian: (Number.isInteger(mentah.tanggalGajian) && mentah.tanggalGajian >= 1 && mentah.tanggalGajian <= 31)
        ? mentah.tanggalGajian : dasar.tanggalGajian
    };
  }

  function bersihkanGamifikasi(mentah) {
    const hasil = gamifikasiKosong();
    if (!mentah || typeof mentah !== 'object') return hasil;

    if (Array.isArray(mentah.misi)) {
      const idTerlihat = new Set();
      for (const m of mentah.misi) {
        if (!m || typeof m !== 'object') continue;
        if (typeof m.id !== 'string' || !m.id || idTerlihat.has(m.id)) continue;
        if (!Object.values(STATUS).includes(m.status)) continue;
        let teknik = m.teknik;
        if (!Object.values(TEKNIK).includes(teknik)) {
          if (m.status === STATUS.SELESAI) continue; // misi selesai wajib punya teknik
          teknik = null;
        }
        if (!uraiTanggal(m.tanggal)) continue;
        idTerlihat.add(m.id);
        hasil.misi.push({
          id: m.id,
          teknik: teknik,
          status: m.status,
          exp: expUntukMisi(teknik, m.status),
          bonus: m.bonus === K.EXP_BONUS_HARIAN ? K.EXP_BONUS_HARIAN : 0,
          tanggal: m.tanggal,
          waktu: typeof m.waktu === 'string' ? m.waktu : '',
          nama: (typeof m.nama === 'string' && m.nama.trim()) ? m.nama.trim().slice(0, K.PANJANG_NAMA_MAKS) : '-',
          jumlah: Number.isInteger(m.jumlah) && m.jumlah >= 0 ? m.jumlah : 0,
          topik: typeof m.topik === 'string' ? m.topik.trim().slice(0, 100) : ''
        });
      }
    }

    if (Array.isArray(mentah.bonusHarian)) {
      const set = new Set();
      for (const t of mentah.bonusHarian) if (uraiTanggal(t)) set.add(t);
      hasil.bonusHarian = Array.from(set).sort();
    }
    return hasil;
  }

  /* ================= Ekspor ================= */

  const Data = {
    formatRupiah: formatRupiah,
    formatTanggal: formatTanggal,
    formatTanggalWaktu: formatTanggalWaktu,
    tanggalLokal: tanggalLokal,
    uraiTanggal: uraiTanggal,
    jumlahHariDalamBulan: jumlahHariDalamBulan,
    periksaAngkaTeks: periksaAngkaTeks,
    validasiInput: validasiInput,
    validasiProfil: validasiProfil,
    panjangRingkasan: panjangRingkasan,
    validasiRecall: validasiRecall,
    buatId: buatId,
    buatTransaksi: buatTransaksi,
    perluMisi: perluMisi,
    hitungRingkasan: hitungRingkasan,
    akanSaldoNegatif: akanSaldoNegatif,
    hapusBerdasarkanId: hapusBerdasarkanId,
    urutkanTerbaru: urutkanTerbaru,
    hitungPengeluaranBulanIni: hitungPengeluaranBulanIni,
    hitungHP: hitungHP,
    statusHP: statusHP,
    hitungSisaHariGajian: hitungSisaHariGajian,
    hitungJatahHarian: hitungJatahHarian,
    expUntukMisi: expUntukMisi,
    hitungExpTotal: hitungExpTotal,
    hitungLevel: hitungLevel,
    tanggalMisiSelesai: tanggalMisiSelesai,
    hitungStreak: hitungStreak,
    hitungStreakTerpanjang: hitungStreakTerpanjang,
    hitungLencana: hitungLencana,
    sudahMisiHariIni: sudahMisiHariIni,
    gamifikasiKosong: gamifikasiKosong,
    catatMisi: catatMisi,
    bersihkanTransaksi: bersihkanTransaksi,
    profilDefault: profilDefault,
    bersihkanProfil: bersihkanProfil,
    bersihkanGamifikasi: bersihkanGamifikasi
  };

  const BDBK = akar.BDBK = akar.BDBK || {};
  BDBK.Data = Data;

  if (typeof module !== 'undefined' && module.exports) module.exports = Data;
})(typeof window !== 'undefined' ? window : globalThis);
