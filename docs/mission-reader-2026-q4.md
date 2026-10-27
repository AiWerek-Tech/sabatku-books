# Berita Misi: cerita mingguan dan foto

Edisi Anak serta Pemuda & Dewasa triwulan IV 2026 menggunakan revisi 5.
ID cerita dan tanggal bacaan tetap dipertahankan. Revisi lama tidak ditimpa.

Setiap cerita mempunyai foto yang dicocokkan berdasarkan urutan, judul Inggris
dan halaman resmi Adventist Mission. Catatan asal foto tersedia dalam
`mission-story-photos-2026-q4.json`. Foto lokal disimpan sebagai
`assets/story-YYYY-MM-DD.jpg`, lalu diterbitkan dalam properti `illustration`
pada node manifest, dengan ukuran serta SHA-256. Keseluruhan 26 foto berukuran
sekitar 1 MB setelah optimasi; foto tidak dibesarkan melebihi ukuran sumber.

Halaman indeks resmi dewasa mencantumkan tanggal 26 Desember untuk kedua
cerita terakhir. Pemetaan memakai urutan resmi 1–13 dan jadwal Sabat edisi
Indonesia yang sudah ada, sehingga cerita ke-12 tetap 19 Desember. Tanggal
konten Indonesia tidak diubah hanya karena ketidakkonsistenan indeks tersebut.

Android menyediakan label Sabat ke-1 sampai Sabat ke-13, foto pada daftar
cerita dan pembaca, serta foto lokal pada unduhan dan transfer paket buku.
Judul tambahan seperti Tip Cerita, Catatan Misi dan Negara yang Luar Biasa
dibedakan oleh renderer. Teks isi tidak ditulis ulang dalam pekerjaan UI ini.
Tautan Markdown dan alamat web pada teks dapat dibuka melalui browser aplikasi.

Validasi: tes sumber buku, katalog dan checksum foto melalui `npm test` serta
`npm run validate`. Uji perangkat Android tetap diperlukan untuk memastikan
interaksi seleksi dan penempatan palet pada setiap variasi sistem operasi.
