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
