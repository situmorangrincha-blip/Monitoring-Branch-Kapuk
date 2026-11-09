# Update Sales Monitor tanpa bikin Vercel dari awal

Kuncinya: **jangan bikin project Vercel baru tiap update.** Data (upload, pengaturan kontrak, SO-DO) disimpan di Vercel Blob yang menempel di project. Selama pakai project yang sama, data aman dan tinggal deploy ulang kodenya.

## Setup sekali saja
1. Bikin repo GitHub (private), upload **isi** folder zip ini (bukan folder pembungkusnya).
2. Vercel > Add New > Project > Import repo itu. Framework: Vite (build `npm run build`, output `dist`). Deploy.
3. Project > Storage > Create > **Blob**, lalu Connect ke project. Redeploy sekali supaya token terbaca.

## Tiap ada versi baru (pilih satu)
**A. Lewat web GitHub (paling gampang)**
Repo > Add file > Upload files > drag semua isi zip baru (menimpa file lama) > Commit. Vercel otomatis deploy sekitar 1 menit. Batas GitHub 100 file per upload; zip ini sekitar 60 file.

**B. Lewat git**
Unzip ke folder repo (timpa), lalu: `git add -A && git commit -m "update" && git push`

**C. Lewat Vercel CLI (tanpa GitHub)**
`npm i -g vercel` > `vercel link` (sekali) > tiap update: `vercel --prod` dari folder project.

## Kalau terlanjur bikin project baru
Datanya masih ada di Blob lama. Di project baru: Storage > **Connect existing store** > pilih store lama > Redeploy. Data muncul lagi.

## Isi versi ini (9 Nov 2026)
**Section baru:** Market Productivity (EC, AC, GreenStore, MSS, PICOS) dan Ranking SKU. Keduanya diisi lewat tombol Upload: slot **Market Productivity**, **Omset per SKU**, dan **Qty per SKU**.
**File Omset / Qty per SKU** boleh export tiga blok (bulan berjalan, L3M dengan kolom RATA2 PER BULAN, bulan lalu). Blok bulan berjalan masuk ke halaman monitoring seperti biasa, dan semua blok dipakai Ranking SKU. Format baris per toko x SKU yang lama tetap terbaca.
**ITG:** halaman ITG memakai versi baru (target dari Excel, kolom Reward, filter hari/salesman, kontrak). Slot ITG harus di-upload ulang dengan Excel ITG format baru (Target per bulan, Actual, Reward). Hasil edit di halaman ITG tersimpan di browser (localStorage), belum dibagikan antar perangkat.
**DAP:** target per toko dari worksheet target DAP (dikenali dari isinya), filter pekan 1&3 / 2&4, PLAN = gap / sisa kunjungan dengan minimum order (wholesaler 1 juta, retail 200 ribu), edit angka langsung, pencarian SKU / kategori / principal.
**Rapot:** indikator baru EC, AC, ITG, dan MSS (bobot bisa diubah; indikator tanpa data dilewati).
**Data lama:** slot ITG lama (format sebelumnya) tidak terbaca di halaman ITG baru dan perlu upload ulang. Slot lain tidak perlu diulang.

## Update berikutnya (9 Nov 2026, sore)
- **ITG:** tombol **Unduh PDF** (semua kontrak sesuai filter, atau satu toko dari panel kontrak). Excel ITG boleh punya dua kolom reward ("Reward Total 2 Bulan" dan "Reward Sebulan"); pilih yang ditampilkan lewat tombol **Reward** di pengaturan ITG.
- **DAP:** halaman **Editor DAP** layar penuh (menu Editor DAP atau tombol Buka Editor DAP), preview PDF ikut berubah otomatis saat angka diedit, dan satuan Rp / Juta.
- **Tampilan:** font Quicksand di seluruh web, tombol ukuran huruf (A- / A+) dan satuan (Rp / Juta) di header.
- **GreenStore / MSS lama dihapus** dari DAP, Rapot, dan daftar upload karena sudah masuk section Market Productivity. Indikator MSS di Rapot sekarang bobot 10.

## Editor DAP di halaman sendiri (9 Nov 2026, malam)
- Di halaman DAP klik **Edit DAP di halaman sendiri**: terbuka alamat tersendiri (`#/dap?depot=...&team=...&date=...`) yang bisa dibuka di tab baru atau dibagikan. Di sana tabelnya selebar layar dan **tampilan kertasnya sama dengan hasil cetak** (tombol Cetak / Simpan PDF memakai tampilan yang sama, pilih "Simpan sebagai PDF" di jendela cetak, kertas A4 landscape).
- **Banyak tabel dalam satu halaman:** Tabel DAP (Rp), Tabel DAP (Qty), Top toko (Rp / Qty), dan Program ON faktur. Tiap tabel punya pengaturan sendiri (judul, item, kolom, Top N, urutan) dan bisa digandakan, diurutkan, atau dihapus.
- **Per SKU, kategori, atau principal:** pilih item lewat pencarian, lalu tiap item mendapat kolom Target, Actual, Gap, % Ach, dan L3M per bulan / per kunjungan. Target kategori dan principal dari slot Target kategori / principal (Template 10); target per SKU dari kolom Target per SKU di Omset per SKU; Target Qty diisi manual.
- **Sembunyikan baris** (x di ujung baris, per tanggal; total ikut berubah), **edit angka langsung**, dan **Preset** (simpan susunan, jadikan bawaan; langsung dipakai saat halaman dibuka).
- Perbaikan: principal dan brand sekarang ikut terbaca dari file Qty per SKU tiga blok (sebelumnya hampir semua principal kosong di halaman monitoring).

## Update 3 (9 Nov 2026, malam)
- **Papan ringkas** di Jelajah (dan di halaman Grafik, grafik lama dilipat): 8 grafik kecil rapat dalam satu layar (salesman, principal, ukuran toko, channel, hari kunjungan, tren, kategori teratas, toko teratas) plus kartu skor.
- **Font:** 23 pilihan jenis huruf di header (dimuat hanya saat dipilih). **Ukuran huruf** sekarang bisa sampai 60% (A-) dan 140% (A+). Paket font baru ada di package.json, jadi Vercel akan menginstalnya otomatis.
- **Editor DAP:** Fokus satu salesman (semua tabel salesman itu berurutan: DAP, Top toko, ON faktur), urutan cetak per tabel atau per salesman, kertas Landscape / Portrait, skala cetak 50-100%, dan susunan item "Bertumpuk di bawah" (maks N item per tabel) supaya kolom tidak melebar saat dicetak.
- **PDF kontrak ITG:** pilihan kertas Portrait / Landscape.

## Update 4 (9 Nov 2026, malam)
- **Jelajah, kategori:** bulan lalu dan L3M per toko per SKU sekarang diisi dari blok file Omset / Qty per SKU (tiga blok), jadi kotak Tren (bulan lalu, L3M, vs bulan lalu, vs L3M) aktif saat rows berisi SKU, kategori, brand, atau principal. Kategori = Sub Brand dari file (cocok dengan kategori fokus di Excel monitoring); kategori dari Database SKU tersedia sebagai dimensi terpisah "Kategori SKU".
- **Jelajah, Kategori fokus:** pilih kategori fokus lewat pencarian di panel Cek Cepat, lalu pakai sebagai **Kolom** (ACT, % Ach, L3M per kategori), **Filter**, atau **Baris**.
- **Market Productivity, GreenStore dan MSS per toko:** filter **Hari JKS** dan **Pekan JKS** (1&3, 2&4, mingguan), plus kolom Hari JKS / Pekan JKS.
- Pemilih (SKU / kategori / principal) tidak lagi membuat tombol di bawahnya melompat saat diklik.

## Update 5 (9 Nov 2026, malam): tim Bima dan ITG Supercup
- **Data utama tim Bima terbaca tanpa sheet "BIMA".** Satu pembaca format baru (TGT, OLAP SALES 1, OLAP FOCUS CATEGORY, LAB, JKS SALESMAN, DAP TGT PER TOKO) sekarang dipakai untuk tim mana pun; tim Bima = salesman dengan Tipe Sales Bima / Yudistira di JKS. Sheet "BIMA" format lama tetap terbaca sebagai cadangan. Kalau sheet TGT tidak memuat salesman tim itu, target diambil dari kolom TGT di sheet LAB (muncul sebagai peringatan). Pesan error kini menyebut alasan per tim, bukan hanya tim Arjuna.
- **ITG Supercup** (menu ITG > ITG Supercup): slot upload baru **Target ITG Supercup** (Excel target Supercup, kolom dikenali dari judul). Outlet dicocokkan ke JKS tim lewat **ID toko** (bukan nama depo), jadi satu file region boleh di-upload di setiap depo.
  - Target per bulan dalam ctn; Actual = qty (ctn) semua SKU principal GBS dari file Qty per SKU.
  - Reward bulanan 0,75% x target bulan jika >= 100%; quartal 0,5% x target quartal (jumlah tiga bulan) jika >= 100%; big cup 1% x omset SKU big cup (berdiri sendiri). Persentase, principal, dan daftar kode SKU big cup bisa diubah di "Pengaturan program".
  - Rupiah = ctn x harga per ctn (omset / qty bulan itu per outlet; outlet tanpa pembelian memakai rata-rata seluruh outlet tim).
  - Angka bulanan disimpan tiap upload (slot riwayat) supaya quartal bisa dijumlah walau file hanya memuat bulan berjalan dan bulan lalu.
  - Bulan yang tidak ada di file target (mis. Oktober) dianggap sama dengan bulan pertama (bertanda ~, bisa diedit atau dikosongkan).
  - Bisa edit target, actual, dan reward per outlet; filter salesman, hari JKS, status; cetak A4 portrait / landscape.

## Update 6 (9 Nov 2026, malam): tabel program di kontrak ITG dari katalog
- **Tabel program di kontrak ITG terisi dari Excel program** (section Program, tanpa upload ulang). Di pengaturan di atas kertas ada **Tabel program dari katalog**: tiap tabel punya judul, jenis (ON faktur / OFF faktur / Semua), tingkat (semua tingkat strata atau tertinggi saja), wilayah strata, dan tombol **Pilih program** berisi daftar yang bisa dicari (kode, nama, brand) dengan filter ON / OFF / Lainnya, jumlah toko ITG yang cocok, "Pilih hasil pencarian", dan "Kosongkan".
- **Bisa lebih dari satu tabel** (mis. satu ON faktur dan satu OFF faktur): tombol + Tambah tabel / + OFF faktur, urutan bisa digeser, tiap tabel bisa disembunyikan.
- **Yang dipilih adalah daftar program untuk semua toko; di kertas hanya muncul program yang cocok dengan toko itu** (channel, ukuran, penanda ITG, dan daftar peserta, sama seperti section Program). Skema strata diskon dari sheet STRATA ikut bisa dipilih, satu baris per tingkat.
- **Di kertas** tiap baris bisa diedit, disembunyikan (x), dan ditambah manual (+ tambah baris). Kolom Pengambilan tetap kosong untuk diisi; Potongan dan Pengambilan berupa angka ikut ke Total potongan dan Kesimpulan. Semuanya ikut ke PDF.
- Isian manual lama di tabel ON faktur (versi sebelumnya) tidak dipindahkan; isi ulang lewat + tambah baris kalau perlu.

## Update 7 (9 Nov 2026, malam): benefit toko dan total benefit kembali
- **Kolom "Benefit toko" di tabel program terisi otomatis** dari Excel program: nilai "Potongan Rp ..." per baris (atau Nilai Reward angka bila Tipe Reward = potongan Rp). Program persen atau harga khusus tanpa nilai Rp dibiarkan kosong untuk diisi manual (angka bisa diedit, oranye = diubah).
- **Setiap tabel program punya baris Total Benefit** (Total Benefit ON Faktur / Total Benefit OFF Faktur).
- **Rincian total di bawah Kesimpulan:** Total Benefit OFF Faktur (reward ITG + tabel OFF), Total Benefit ON Faktur, dan **Estimasi total benefit program = OFF + ON**. Semuanya ikut ke PDF.
- Opsi per tabel **"Hanya yang ada benefit Rp"** menyembunyikan program persen atau tanpa nilai Rp, supaya tabel ON faktur berisi program yang benefit-nya bisa dijumlahkan seperti di kontrak lama.

## Update 8 (9 Nov 2026, malam): pengaturan kontrak ITG berlaku untuk semua toko
- **Pengaturan kontrak otomatis berlaku untuk semua toko.** Tabel yang tampil, kolom tiap tabel, sumber histori (per bulan / per kunjungan, rata-rata 3 bulan / bulan lalu / bulan data), dasar target kontrak, persen basis, minimal %, dan item unggulan wajib: ubah di satu toko, toko lain langsung ikut. Yang tetap per toko: angka yang diketik di kertas, baris program yang disembunyikan atau ditambah, dan jumlah kunjungan.
- **Bar di atas kartu pengaturan** menunjukkan "Pengaturan umum" atau "Khusus toko ini". Tombol **Khusus toko ini** membuat toko boleh berbeda; **Kembali ke pengaturan umum** menghapus pengaturan khusus itu; **Jadikan semua toko seperti ini** menjadikan pengaturan toko yang sedang dibuka sebagai pengaturan umum dan menghapus pengaturan khusus di semua toko. Toko yang dulu sudah diubah satu per satu otomatis terbaca sebagai "Khusus toko ini".
- Tombol lama "Jadikan bawaan semua toko" dan "Terapkan ke N toko (filter)" diganti oleh logika di atas.
- **Penyimpanan di browser kini per depo x tim.** Pengaturan dan edit lama (yang belum dibedakan) dipindahkan otomatis ke depo dan tim pertama yang dibuka setelah update; data lama tidak dihapus dari browser.
- Item unggulan wajib ikut ke PDF sebagai pengaturan umum.

## Update 9 (9 Nov 2026, malam): tabel ON faktur jadi template untuk semua toko
- **Perubahan di tabel program (ON/OFF faktur) berlaku untuk semua toko** selama toko dalam mode "Pengaturan umum": baris yang disembunyikan (x), baris tambahan (+ tambah baris), dan teks yang diubah (nama program, min order, satuan, diskon).
- **Tetap per toko:** angka **Benefit toko** yang diketik, kolom **Pengambilan**, serta semua angka hitungan (target, actual, reward, histori, rekomendasi).
- **Khusus toko ini** membuat perubahan baris hanya untuk toko itu; **Kembali ke pengaturan umum** menghapus perubahan khusus itu (benefit dan pengambilan tetap); **Jadikan semua toko seperti ini** juga membawa isi tabel program toko itu ke semua toko. Data lama yang sudah lu ubah di satu toko ikut terbaca dan terbawa.
- Baris dikenali dari isinya (kode program, min order, satuan, diskon), bukan urutan, jadi "sembunyikan baris ini" tepat sasaran di toko mana pun. Template tersimpan di browser per depo x tim bersama pengaturan lain.
