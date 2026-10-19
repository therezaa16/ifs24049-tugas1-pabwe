/*
 * Tes unit untuk modul Data. Jalankan:  node tests/data.test.js
 * Tanpa library: hanya node:assert. Semua tanggal dibuat dengan new Date(tahun, bulan-1, hari, jam)
 * (waktu LOKAL) lalu dikirim sebagai parameter "sekarang".
 */
'use strict';
const assert = require('node:assert/strict');
const Data = require('../js/data.js');
const K = require('../js/konfigurasi.js');

let lulus = 0;
function uji(nama, fn) {
  try { fn(); lulus += 1; console.log('  ok   ' + nama); }
  catch (e) { console.error('  GAGAL ' + nama + '\n       ' + e.message); process.exitCode = 1; }
}
const D = (t, b, h, j = 12, m = 0) => new Date(t, b - 1, h, j, m, 0);

console.log('Format & validasi');
uji('formatRupiah', () => {
  assert.equal(Data.formatRupiah(25000), 'Rp 25.000');
  assert.equal(Data.formatRupiah(0), 'Rp 0');
  assert.equal(Data.formatRupiah(-1200000), '-Rp 1.200.000');
  assert.equal(Data.formatRupiah(133333.33), 'Rp 133.333');
});
uji('pesan galat jumlah spesifik', () => {
  const g = (v) => Data.periksaAngkaTeks(v, 'Jumlah').galat;
  assert.match(g(''), /wajib diisi/);
  assert.match(g('abc'), /hanya boleh berisi angka/);
  assert.match(g('1e3'), /hanya boleh berisi angka/);
  assert.match(g('-5'), /tidak boleh negatif/);
  assert.match(g('25.000'), /tanpa titik atau koma/);
  assert.match(g('12,5'), /tanpa titik atau koma/);
  assert.match(g('0'), /lebih dari 0/);
  assert.match(g('000'), /lebih dari 0/);
  assert.match(g('9999999999999999'), /terlalu besar/);
  assert.equal(Data.periksaAngkaTeks(' 25000 ', 'Jumlah').nilai, 25000);
});
uji('validasiInput: nama spasi & tipe wajib untuk pengeluaran', () => {
  const a = Data.validasiInput({ nama: '   ', jumlah: '1000', kategori: 'Makan', jenis: 'Pengeluaran', tipe: '' });
  assert.ok(a.galat.nama && a.galat.tipe && !a.sah);
  const b = Data.validasiInput({ nama: 'Gaji', jumlah: '1000', kategori: 'Lainnya', jenis: 'Pemasukan', tipe: '' });
  assert.ok(b.sah); assert.equal(b.nilai.tipe, null);
});
uji('validasiProfil', () => {
  const ok = Data.validasiProfil({ nama: '  Eli   Za ', avatar: '🐼', anggaran: '', tanggalGajian: '31' });
  assert.ok(ok.sah); assert.equal(ok.nilai.nama, 'Eli Za'); assert.equal(ok.nilai.anggaran, null);
  const buruk = Data.validasiProfil({ nama: '', avatar: 'x', anggaran: 'abc', tanggalGajian: '32' });
  assert.ok(buruk.galat.nama && buruk.galat.avatar && buruk.galat.anggaran && buruk.galat.tanggalGajian);
});
uji('validasiRecall menghitung spasi beruntun sebagai satu karakter', () => {
  assert.equal(Data.validasiRecall('', 'x'.repeat(60)).sah, false);
  assert.equal(Data.validasiRecall('Topik', 'a' + ' '.repeat(80)).sah, false);
  assert.equal(Data.validasiRecall('Topik', 'x'.repeat(49)).sah, false);
  assert.equal(Data.validasiRecall('Topik', 'x'.repeat(50)).sah, true);
});

console.log('EXP & level');
uji('EXP per misi', () => {
  assert.equal(Data.expUntukMisi('pomodoro', 'selesai'), 30);
  assert.equal(Data.expUntukMisi('recall', 'selesai'), 20);
  assert.equal(Data.expUntukMisi('pomodoro', 'batal'), 0);
  assert.equal(Data.expUntukMisi('recall', 'batal'), 0);
});
uji('hitungLevel: 100 x N EXP per level', () => {
  assert.deepEqual(Data.hitungLevel(0), { level: 1, expDalamLevel: 0, expButuh: 100, persen: 0 });
  assert.equal(Data.hitungLevel(99).level, 1);
  assert.equal(Data.hitungLevel(100).level, 2);
  assert.equal(Data.hitungLevel(100).expDalamLevel, 0);
  assert.equal(Data.hitungLevel(299).level, 2);   // 100 + 200 = 300 untuk level 3
  assert.equal(Data.hitungLevel(300).level, 3);
  assert.equal(Data.hitungLevel(600).level, 4);   // 100 + 200 + 300
  const l = Data.hitungLevel(150);                // level 2, 50 dari 200
  assert.equal(l.level, 2); assert.equal(l.expDalamLevel, 50); assert.equal(l.expButuh, 200); assert.equal(l.persen, 25);
});

console.log('HP, sisa hari, jatah harian');
uji('hitungHP: rumus, batas 0..100, anggaran kosong', () => {
  assert.equal(Data.hitungHP(1000000, 0), 100);
  assert.equal(Data.hitungHP(1000000, 250000), 75);
  assert.equal(Data.hitungHP(1000000, 1200000), 0);   // dibatasi 0
  assert.equal(Data.hitungHP(1000000, -50000), 100);  // dibatasi 100
  assert.equal(Data.hitungHP(null, 5000), null);
  assert.equal(Data.hitungHP(0, 5000), null);
});
uji('statusHP: hijau >50, kuning 20-50, merah <20', () => {
  assert.equal(Data.statusHP(100), 'hijau'); assert.equal(Data.statusHP(51), 'hijau');
  assert.equal(Data.statusHP(50), 'kuning'); assert.equal(Data.statusHP(20), 'kuning');
  assert.equal(Data.statusHP(19), 'merah');  assert.equal(Data.statusHP(0), 'merah');
  assert.equal(Data.statusHP(null), 'kosong');
});
uji('hitungSisaHariGajian: kasus biasa', () => {
  assert.equal(Data.hitungSisaHariGajian(D(2026, 10, 18), 25), 7);
  assert.equal(Data.hitungSisaHariGajian(D(2026, 10, 25), 25), 0);   // hari ini gajian
  assert.equal(Data.hitungSisaHariGajian(D(2026, 10, 26), 25), 30);  // ke 25 Nov
  assert.equal(Data.hitungSisaHariGajian(D(2026, 10, 18), 1), 14);   // ke 1 Nov
});
uji('hitungSisaHariGajian: bulan pendek & pergantian tahun', () => {
  assert.equal(Data.hitungSisaHariGajian(D(2026, 2, 10), 31), 18);   // gajian jatuh 28 Feb 2026
  assert.equal(Data.hitungSisaHariGajian(D(2026, 2, 28), 31), 0);
  assert.equal(Data.hitungSisaHariGajian(D(2026, 3, 1), 31), 30);    // ke 31 Mar
  assert.equal(Data.hitungSisaHariGajian(D(2026, 1, 31), 30), 28);   // 30 lewat -> 28 Feb
  assert.equal(Data.hitungSisaHariGajian(D(2028, 2, 10), 31), 19);   // tahun kabisat: 29 Feb
  assert.equal(Data.hitungSisaHariGajian(D(2026, 12, 28), 5), 8);    // ke 5 Jan 2027
  assert.equal(Data.hitungSisaHariGajian(D(2026, 4, 30), 31), 0);    // April hanya 30 hari
});
uji('hitungJatahHarian', () => {
  assert.equal(Data.hitungJatahHarian(1000000, 600000, 4), 100000);
  assert.equal(Data.hitungJatahHarian(1000000, 1200000, 4), 0);      // max(0, sisa)
  assert.equal(Data.hitungJatahHarian(1000000, 0, 0), 1000000);      // max(1, sisa hari)
  assert.equal(Data.hitungJatahHarian(null, 0, 5), null);
  assert.equal(Data.formatRupiah(Data.hitungJatahHarian(400000, 0, 3)), 'Rp 133.333');
});
uji('pengeluaran bulan ini memakai bulan kalender lokal', () => {
  const t = (jenis, jumlah, d) => ({ id: String(Math.random()), nama: 'x', jumlah, kategori: 'Makan', jenis, tipe: jenis === 'Pengeluaran' ? 'Kebutuhan' : null, dibuatPada: d.toISOString() });
  const daftar = [
    t('Pengeluaran', 1000, D(2026, 10, 1, 0, 30)),   // tengah malam lokal, tetap Oktober
    t('Pengeluaran', 2000, D(2026, 10, 31, 23, 30)),
    t('Pengeluaran', 4000, D(2026, 9, 30, 23, 59)),  // bulan lalu
    t('Pemasukan', 9999, D(2026, 10, 5)),
    { id: 'rusak', nama: 'x', jumlah: 500, kategori: 'Makan', jenis: 'Pengeluaran', tipe: 'Kebutuhan', dibuatPada: '' }
  ];
  assert.equal(Data.hitungPengeluaranBulanIni(daftar, D(2026, 10, 18)), 3000);
});

console.log('Tanggal lokal, streak, lencana');
uji('tanggalLokal bukan UTC', () => {
  assert.equal(Data.tanggalLokal(D(2026, 10, 1, 0, 30)), '2026-10-01');
  assert.equal(Data.tanggalLokal(D(2026, 10, 31, 23, 59)), '2026-10-31');
});
uji('hitungStreak', () => {
  const s = (tgl, now) => Data.hitungStreak(tgl, now);
  assert.equal(s([], D(2026, 10, 18)), 0);
  assert.equal(s(['2026-10-18'], D(2026, 10, 18)), 1);
  assert.equal(s(['2026-10-16', '2026-10-17', '2026-10-18'], D(2026, 10, 18)), 3);
  assert.equal(s(['2026-10-16', '2026-10-17'], D(2026, 10, 18)), 2);   // hari ini belum, streak belum putus
  assert.equal(s(['2026-10-15', '2026-10-16'], D(2026, 10, 18)), 0);   // sudah putus
  assert.equal(s(['2026-10-14', '2026-10-16', '2026-10-17', '2026-10-18'], D(2026, 10, 18)), 3);
  assert.equal(s(['2026-09-30', '2026-10-01'], D(2026, 10, 1)), 2);    // lintas bulan
  assert.equal(s(['2026-12-31', '2027-01-01'], D(2027, 1, 1)), 2);     // lintas tahun
});
uji('hitungStreakTerpanjang', () => {
  assert.equal(Data.hitungStreakTerpanjang([]), 0);
  assert.equal(Data.hitungStreakTerpanjang(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10']), 3);
});

console.log('catatMisi, bonus harian, lencana');
uji('catatMisi: EXP, bonus sekali per hari, tidak mengubah input', () => {
  const awal = Data.gamifikasiKosong();
  const beku = JSON.stringify(awal);
  const r1 = Data.catatMisi(awal, { id: 'a', teknik: 'pomodoro', status: 'selesai', nama: 'X', jumlah: 1000 }, D(2026, 10, 18, 9));
  assert.equal(JSON.stringify(awal), beku);
  assert.equal(r1.expMisi, 30); assert.equal(r1.expBonus, 10);
  assert.equal(Data.hitungExpTotal(r1.gamifikasi), 40);
  const r2 = Data.catatMisi(r1.gamifikasi, { id: 'b', teknik: 'recall', status: 'selesai', nama: 'Y', jumlah: 1 }, D(2026, 10, 18, 15));
  assert.equal(r2.expBonus, 0);
  assert.equal(Data.hitungExpTotal(r2.gamifikasi), 60);
  const r3 = Data.catatMisi(r2.gamifikasi, { id: 'c', teknik: 'recall', status: 'selesai', nama: 'Z', jumlah: 1 }, D(2026, 10, 19, 8));
  assert.equal(r3.expBonus, 10);
});
uji('catatMisi: misi batal = 0 EXP dan tidak memberi bonus / streak', () => {
  const r = Data.catatMisi(Data.gamifikasiKosong(), { id: 'a', teknik: null, status: 'batal', nama: 'X', jumlah: 5 }, D(2026, 10, 18));
  assert.equal(r.expMisi, 0); assert.equal(r.expBonus, 0);
  assert.equal(Data.hitungExpTotal(r.gamifikasi), 0);
  assert.equal(Data.sudahMisiHariIni(r.gamifikasi, D(2026, 10, 18)), false);
  assert.equal(Data.hitungStreak(Data.tanggalMisiSelesai(r.gamifikasi), D(2026, 10, 18)), 0);
  assert.equal(r.gamifikasi.misi.length, 1); // tetap tercatat di riwayat
});
uji('naik level terdeteksi', () => {
  let g = Data.gamifikasiKosong(); let naik = 0;
  const hari = [D(2026, 10, 1), D(2026, 10, 2), D(2026, 10, 3)];
  hari.forEach((d, i) => { const r = Data.catatMisi(g, { id: 'm' + i, teknik: 'pomodoro', status: 'selesai', nama: 'X', jumlah: 1 }, d); g = r.gamifikasi; if (r.naikLevel) naik += 1; });
  // 3 x (30 + 10) = 120 EXP -> level 2 sekali
  assert.equal(Data.hitungExpTotal(g), 120); assert.equal(Data.hitungLevel(120).level, 2); assert.equal(naik, 1);
});
uji('lencana: Langkah Pertama, Pejuang Fokus, Konsisten', () => {
  let g = Data.gamifikasiKosong();
  assert.deepEqual(Data.hitungLencana(g).map((l) => l.terbuka), [false, false, false]);
  let r = Data.catatMisi(g, { id: '1', teknik: 'recall', status: 'selesai', nama: 'a', jumlah: 1 }, D(2026, 10, 1));
  assert.deepEqual(r.lencanaBaru.map((l) => l.id), ['langkah-pertama']);
  g = r.gamifikasi;
  r = Data.catatMisi(g, { id: '2', teknik: 'recall', status: 'selesai', nama: 'a', jumlah: 1 }, D(2026, 10, 2)); g = r.gamifikasi;
  assert.deepEqual(r.lencanaBaru, []);
  r = Data.catatMisi(g, { id: '3', teknik: 'recall', status: 'selesai', nama: 'a', jumlah: 1 }, D(2026, 10, 3)); g = r.gamifikasi;
  assert.deepEqual(r.lencanaBaru.map((l) => l.id), ['konsisten']);
  // 4 Pomodoro belum cukup, yang ke-5 membuka Pejuang Fokus
  for (let i = 0; i < 4; i++) { r = Data.catatMisi(g, { id: 'p' + i, teknik: 'pomodoro', status: 'selesai', nama: 'a', jumlah: 1 }, D(2026, 10, 3, 13 + i)); g = r.gamifikasi; }
  assert.equal(Data.hitungLencana(g).find((l) => l.id === 'pejuang-fokus').terbuka, false);
  r = Data.catatMisi(g, { id: 'p4', teknik: 'pomodoro', status: 'selesai', nama: 'a', jumlah: 1 }, D(2026, 10, 3, 20));
  assert.deepEqual(r.lencanaBaru.map((l) => l.id), ['pejuang-fokus']);
  // Pomodoro yang DIBATALKAN tidak dihitung; lencana tetap terbuka walau streak putus
  assert.equal(Data.hitungLencana(r.gamifikasi).find((l) => l.id === 'konsisten').terbuka, true);
});
uji('akanSaldoNegatif', () => {
  assert.equal(Data.akanSaldoNegatif(0, { jenis: 'Pengeluaran', jumlah: 1200000 }), true);
  assert.equal(Data.akanSaldoNegatif(1200000, { jenis: 'Pengeluaran', jumlah: 1200000 }), false); // pas nol
  assert.equal(Data.akanSaldoNegatif(0, { jenis: 'Pemasukan', jumlah: 5 }), false);
});

console.log('Pembersih data');
uji('bersihkanTransaksi: format iterasi 1 tetap terbaca, entri rusak dibuang', () => {
  const lama = [
    { id: 'u1', nama: 'Nasi', jumlah: 15000, kategori: 'Makan', jenis: 'Pengeluaran', tipe: 'Kebutuhan', dibuatPada: '2026-10-17T03:00:00.000Z' },
    { id: 'u1', nama: 'Dobel', jumlah: 1, kategori: 'Makan', jenis: 'Pemasukan', tipe: null, dibuatPada: '' },
    { id: 'u2', nama: ' ', jumlah: 1, kategori: 'Makan', jenis: 'Pemasukan', tipe: null },
    { id: 'u3', nama: 'Neg', jumlah: -5, kategori: 'Makan', jenis: 'Pemasukan', tipe: null },
    { id: 'u4', nama: 'TanpaTipe', jumlah: 5, kategori: 'Makan', jenis: 'Pengeluaran' },
    null, 'x', 5
  ];
  const hasil = Data.bersihkanTransaksi(lama);
  assert.equal(hasil.length, 1); assert.equal(hasil[0].nama, 'Nasi');
  assert.deepEqual(Data.bersihkanTransaksi({ bukan: 'array' }), []);
});
uji('bersihkanProfil & bersihkanGamifikasi menolak data rusak', () => {
  assert.deepEqual(Data.bersihkanProfil('rusak'), Data.profilDefault());
  const p = Data.bersihkanProfil({ nama: '<img onerror=1>', avatar: '💩', anggaran: -5, tanggalGajian: 99 });
  assert.equal(p.avatar, K.AVATAR_DEFAULT); assert.equal(p.anggaran, null); assert.equal(p.tanggalGajian, 1);
  assert.equal(p.nama, '<img onerror=1>'); // disimpan apa adanya; keamanan dijamin saat render (textContent)
  const g = Data.bersihkanGamifikasi({
    misi: [
      { id: 'a', teknik: 'pomodoro', status: 'selesai', tanggal: '2026-10-18', exp: 99999, nama: 'x', jumlah: 5 },
      { id: 'a', teknik: 'recall', status: 'selesai', tanggal: '2026-10-18' },
      { id: 'b', teknik: 'ngawur', status: 'selesai', tanggal: '2026-10-18' },
      { id: 'c', teknik: 'recall', status: 'selesai', tanggal: '2026-13-45' },
      { id: 'd', teknik: 'x', status: 'batal', tanggal: '2026-10-17' }
    ],
    bonusHarian: ['2026-10-18', '2026-10-18', 'bukan-tanggal']
  });
  assert.equal(g.misi.length, 2);
  assert.equal(g.misi[0].exp, 30);              // EXP dihitung ulang dari aturan, bukan dari data simpanan
  assert.equal(g.misi[1].teknik, null);
  assert.deepEqual(g.bonusHarian, ['2026-10-18']);
  assert.deepEqual(Data.bersihkanGamifikasi(null), Data.gamifikasiKosong());
});
uji('urutkanTerbaru & id unik', () => {
  const a = { id: '1', dibuatPada: '2026-10-01T00:00:00Z' }; const b = { id: '2', dibuatPada: '2026-10-03T00:00:00Z' }; const c = { id: '3', dibuatPada: '' };
  assert.deepEqual(Data.urutkanTerbaru([c, a, b]).map((x) => x.id), ['2', '1', '3']);
  const ids = new Set(); const daftar = [];
  for (let i = 0; i < 500; i++) { const id = Data.buatId(daftar); assert.ok(!ids.has(id)); ids.add(id); daftar.push({ id: id }); }
});

console.log('\n' + lulus + ' tes lulus' + (process.exitCode ? ', ADA YANG GAGAL' : ''));
