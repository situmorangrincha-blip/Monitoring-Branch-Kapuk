# Sales Monitor (v4)

Dashboard sales minimalis. Ungu pastel = SP Kebayoran, biru = Depo Kapuk. Alur: Depo → Tim (tanpa password).

## Deploy (sama seperti sebelumnya)
1. Push seluruh isi folder ke GitHub (folder `src`, `api`, `scripts` harus ikut sebagai folder).
2. Vercel → Import repo (Vite terdeteksi otomatis).
3. Storage → Create → Blob, lalu **Connect Project** ke project ini (centang Production, Preview, Development). Cek `BLOB_READ_WRITE_TOKEN` ada di Settings → Environment Variables, lalu **Redeploy** (variabel baru hanya terbaca di deployment baru). Kalau muncul "No token found", artinya langkah ini belum selesai.
4. Tidak ada env password. Siapa pun yang punya link bisa buka dan mengubah data, jadi jangan sebar link ke luar tim.
5. Log build harus berisi `[check-files] OK`.

## Upload: 7 slot (Data utama, Qty per SKU, Omset per SKU, GreenStore/MSS, Program, Database SKU) terpisah (per depo × tim)
| Slot | Isi | Catatan |
|---|---|---|
| Data utama | omset/ACT per toko, Sep, L3M, Pareto JKS, target, hari kunjungan, sheet DAP, sheet TGT | sheet dikenali dari JUDUL: `TGT…` target, `DAP…` DAP, `PARETO…`/`LAB` pareto, `KHUSUS …` menimpa salesman yang tercantum |
| Qty per SKU | baris per toko × SKU: ID toko, kode/nama SKU, qty | boleh juga memuat kolom nilai kalau satu file |
| Omset per SKU | baris per toko × SKU: ID toko, kode/nama SKU, omset (Rp) | slot terpisah; disambung ke Qty lewat ID toko + kode SKU. Judul sheet seperti `OMSET PER SKU` dikenali otomatis |
| GreenStore / MSS | target + actual per salesman atau toko | judul sheet `GREENSTORE` / `MSS` menentukan nama program |
| Program (Excel/PDF) | daftar toko peserta program | dicocokkan ke toko di Data utama lewat ID, lalu nama. Hasil bisa dicek dan dikoreksi sebelum disimpan. PDF harus punya teks (bukan scan). Program jadi variabel di Jelajah dan kolom di DAP |
| Database SKU | kode SKU + nama (+ brand/kategori) | per depo, dipakai kedua tim |

Header tabel dicari otomatis (posisi bebas), nama kolom dicocokkan longgar. Kalau meleset: Upload → "Pemetaan kolom".
File format lama (sheet OLAP SALES / JKS SALESMAN / BIMA) masih terbaca di slot Data utama.
Batas simpan per slot 4,3 MB (JSON hasil baca); file Excel maksimal 80 MB di browser.

## Catatan angka
- "Timegone sama" = Sep/L3M × timegone (estimasi proporsional, data Sep & L3M adalah total sebulan).
- Level SKU: Sep/L3M tidak tersedia (datanya per toko). Target di level SKU = target per SKU kalau ada, kalau tidak target principal per salesman (tanda *).

## Fitur lain
- **Musik (tombol ♪ di header):** Mati / YouTube / Ambient. YouTube: tempel link playlist (public atau unlisted), pemutar resmi YouTube tampil di pojok kanan bawah dengan kontrol sendiri; ukurannya bisa diubah tapi tidak bisa disembunyikan (aturan embed YouTube). Ambient: musik generatif di browser. Pemutar berhenti kalau keluar ke layar pilih depo.
- **Bunyi klik** dan **latar bergerak** bisa dimatikan di panel ♪. Latar otomatis diam kalau perangkat memakai "kurangi gerakan".
- **Jelajah:** panel kiri berisi scorecard per indikator (angka total ikut filter). Tap atau geret scorecard ke Indikator.
- **DAP / SKU fokus:** SKU diambil dari Database SKU (kode, nama, brand, kategori), qty dan nilai dari slot Qty (dicocokkan lewat kode SKU). Tombol "+ kategori" memasukkan semua SKU di kategori itu; di halaman Fokus Pareto tiap kategori diberi baris total. SKU yang tidak ada di file Qty tampil 0.
- **Tampilan (panel ♪):** latar bergerak (Mati / Halus / Sedang / Ramai), karakter chibi (mata mengikuti kursor, berjalan mengikuti, melompat saat klik, tidur kalau diam lama; klik tembus ke bawahnya), dan warna tema (preset atau warna bebas). Disimpan per browser. Warna PDF DAP tetap ungu (Kebayoran) / biru (Kapuk).

## Aturan salesman, DAP otomatis, rapot
- **Aturan salesman (Upload → Aturan salesman):** toko tertentu dipindah ke salesman lain; actual, L3M, dan target ikut pindah dan dikeluarkan dari salesman asal. Bawaan SP Kebayoran · Arjuna: Vini memegang 6 toko dengan target BTI per toko; milestone = BTI × 110%. Disimpan di web (slot `rules`), jadi berlaku di setiap upload.
- **Target DAP otomatis:** target toko = L3M toko ÷ total L3M salesman × target total salesman (Milestone atau BTI, ikut pilihan di Performa), minimal batas MINIMUM PROD (retail 200 rb / grosir 1 jt). Toko aturan khusus memakai target BTI-nya. Tampilan DAP: Total / Per kunjungan / Keduanya; PLAN tetap kolom terpisah. Kalau ada sheet DAP, sumber bisa dipilih.
- **Peringatan periode:** saat upload format lama, web memperingatkan kalau pivot salesman, per toko, dan last month tidak berada di periode yang sama.
- **Rapot salesman:** nilai 0-100 dari Omset vs target (40), CA (10), CA Produktif (10), Pareto (15), GreenStore (15), Pertumbuhan vs LM (10); bobot bisa diubah. Indikator tanpa data dilewati. Peringkat antar salesman; salesman aturan khusus dinilai terpisah. PDF per salesman atau semua.

## Tahap 1 (November 2026)
- **Halaman awal:** Depo → Section (Monitoring Sales aktif; ITG, Program, SO-DO menyusul; Rute Kunjungan dan Audit Rute membuka project Vercel lain di tab baru) → Tim.
- **Tema infografis:** peach/krem/teal, font Poppins + Inter (dibundel). Animasi halus (Penuh / Ringan / Mati di panel ♪).
- **Bulan lalu ikut tanggal upload:** periode data = bulan dari tanggal upload (tanggal 1 memakai bulan lalu, data H-1). Label "Sep/Okt/…" di semua tampilan mengikuti periode ini, dan periode bisa diubah manual di layar upload.
- **Alias kode SKU:** kode di Database SKU boleh berisi beberapa kode dipisah garis miring (GKAOG8/AJTF8Z). Semua kode dianggap SKU yang sama saat Qty dan Omset digabung.

## Tahap 2-5 (November 2026)
- **Grafik infografis:** batang membulat yang tumbuh dari bawah, donat dan cincin konsentris, area chart lengkung, pita langkah. Warna dari palet tema.
- **Program:** upload Excel standar (slot "Katalog program"; sheet PROGRAM, STRATA, PESERTA). Kecocokan toko dihitung dari channel, ukuran, dan penanda ITG di JKS (CC5) plus daftar peserta; program berdaftar tanpa daftar = "perlu daftar".
- **ITG:** upload slot "Target ITG" (Nama Salesman, ID Pelanggan, Class, Target <bulan> ×2). Periode 2 bulan ganjil-genap, tiap bulan ≥70% dan total ≥100%. Milestone = BTI × 110%. Cashback potensi = % class × target 2 bulan (belum memakai batas caps maupun SKU WCG4/Pilus 500).
- **Kontrak:** satu halaman per toko (PDF A4), isi: baris ITG, program OFF faktur, program ON faktur (potongan dihitung dari harga di Database SKU bila ada), item unggulan wajib, 4 kolom tanda tangan. Preview tanpa unduh: dashboard menepi ke kiri, preview masuk dari kanan (layar penuh di HP).
- **SO-DO:** upload banyak file SO dan STK sekaligus (nama file SO = salesman bila tidak ada kolom salesman; tanggal STK dari nama file, bisa diubah). Cocokkan per toko + salesman, batas 2 hari kerja. Status Terkirim / Sebagian / Belum / Menunggu STK, alasan (plan kirim tanggal lain, SO double, lainnya), rekap, dan target harian opsional. Data SO-DO disimpan di slot `sodo`.
- **Karakter:** 18 hewan + sales, pembuat karakter (kulit, rambut, aksesori, baju), dan upload gambar sendiri (disimpan di browser).

## Salesman mengikuti Excel
Format lama: tim tiap salesman dibaca dari kolom **Tipe Sales** di sheet JKS (Arjuna / Bima / Yudistira → dashboard Bima), jadi salesman baru muncul otomatis. Daftar nama bawaan hanya cadangan kalau kolom itu kosong. Angka salesman baru butuh namanya ada juga di pivot OLAP dan sheet TGT; peringatan lengkap ada di tombol ⚠ di header.

## Program satu pintu + target harian
- **Program:** slot "Program (Excel standar)" membaca sheet PROGRAM dan mencocokkan toko dari JKS (channel CC1, ukuran CC5, jenis toko CC2, lokasi CC3, produk CC6); layar upload menampilkan berapa toko cocok per program. File Excel standar yang salah dimasukkan ke slot "Daftar peserta program" otomatis dialihkan. Peserta ITG hanya dari file ITG yang diupload (penanda ITG di CC5 tidak dipakai). Kolom Butuh Daftar Peserta berisi Ya / Tidak / Opsional (Opsional = pakai daftar kalau ada, kalau tidak dicocokkan dari kriteria JKS).
- **Target harian (SO-DO):** dipecah dari target bulanan di data utama (Milestone atau BTI): "Jadwal kunjungan" (jumlah target per kunjungan toko yang dijadwalkan hari itu, sama dengan DAP), "Rata per hari kerja", atau manual. Isian manual menang.

## Target per kategori / principal
Slot "Target kategori / principal" (Salesman atau ID Pelanggan; Kategori atau Principal; Target BTI; Basis opsional). Milestone = BTI x 110%. Target salesman dibagi ke toko menurut kontribusi L3M toko (sama dengan target DAP), ditandai ~; target per toko dipakai apa adanya dan menang. Tampil di: kolom DAP (Actual, Target, % Ach per kategori / principal yang dicentang, ikut PDF), baris total di halaman Fokus Pareto, dan kolom Target di Jelajah saat dikelompokkan per Kategori atau Principal.

## DAP: GreenStore per program + Top 10 Pareto
- **GreenStore / MSS:** kolom per program per toko (Target, Actual, % Ach, Gap, dipilih di pengaturan DAP); pencapaian level salesman tampil di header DAP. Kolom tunggal lama dihapus.
- **Fokus Pareto:** satu halaman per salesman berisi top N (5/10/15/20) toko Pareto JKS yang dikunjungi di tanggal DAP, urut Target DAP per kunjungan. Kategori, principal, dan SKU fokus jadi kolom dengan isi Actual / Qty / Target / % Ach. Target hanya untuk kategori dan principal (slot Target kategori / principal); SKU hanya Actual dan Qty kecuali file Omset per SKU memuat Target.

## Kontrak ITG: rekomendasi + kustom
Per toko ITG: target per kunjungan = target bulan / jumlah kunjungan (JKS), minimal 70%; komposisi order menurut kontribusi SKU toko; diskon strata ON faktur (kolom Jawa) per kelompok brand dihitung dari karton per kunjungan, plus program ON faktur lain. Bisa dikustom per toko (kunjungan, basis, target per kunjungan, karton per SKU, tambah / hapus SKU, diskon manual, program ON faktur lain) atau massal (basis dan kunjungan); tersimpan di slot `itgcfg` dan dibagikan ke tim. Toko custom bertanda "custom" di layar saja.

## Top toko + on/off kontrak
- **Top toko:** halaman setelah tabel DAP tiap salesman berisi top N toko yang dikunjungi hari itu (tidak lagi hanya Pareto JKS), urut Target DAP per kunjungan; kolom fokus kategori / principal / SKU dengan opsi Actual, Qty, Target, % Ach.
- **Kontrak ITG:** tiga tabel (OFF faktur, Rekomendasi order, ON faktur) dan tiap diskon (cashback ITG, program OFF / ON, strata per brand) bisa dimatikan, umum atau per toko. Pilih toko dengan kotak centang, lalu "Atur kontrak untuk N toko terpilih". Total benefit mengikuti isi yang tercetak.
- Panduan update Vercel: lihat DEPLOY.md.
