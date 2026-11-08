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
