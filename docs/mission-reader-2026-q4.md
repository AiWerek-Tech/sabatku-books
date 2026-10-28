# Berita Misi: cerita mingguan dan foto

Pembaruan 28 Oktober 2026: edisi Anak menggunakan revisi 8 dan edisi Pemuda & Dewasa revisi 6. Revisi 5 serta revisi sebelumnya tetap tersedia tanpa ditimpa.
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
dibedakan oleh renderer. Revisi dewasa 6 memulihkan narasi yang sebelumnya diringkas dan menambahkan pendamping sumber. Revisi anak 8 mempertahankan naskah yang ada dan melengkapi persiapan Sabat ke-13 serta proyek berikutnya.
Tautan Markdown dan alamat web pada teks dapat dibuka melalui browser aplikasi.

Validasi: tes sumber buku, katalog dan checksum foto melalui `npm test` serta
`npm run validate`. Uji perangkat Android tetap diperlukan untuk memastikan
interaksi seleksi dan penempatan palet pada setiap variasi sistem operasi.

## Pengalaman Misi

`mission/2026-q4.json` menghubungkan 26 cerita Indonesia ke segmen Inggris yang sesuai di Adventech. URL memakai rute `/resources/en/explore/.../document/segment`; HTTP 200 pada rute SPA saja tidak cukup membuktikan tautan benar. Pemeriksaan langsung API provider mencocokkan judul dan tanggal segmen pada seluruh 26 cerita; buktinya ada di `mission-provider-links-2026-q4.json`. Dua judul dokumen provider berbeda dari judul segmennya, sehingga pemetaan menggunakan segmen yang tepat.

Dokumen pendamping berisi empat negara/proyek, lima aktivitas anak, panduan Baca bersama, serta persiapan kelas. Publisher mengekspor indeks pendamping dan dokumen triwulan di `public/mission`. Naskah, unduhan, posisi, dan sorotan tetap dikelola pembaca Buku yang sama. Panduan aktivitas tidak disisipkan ke dalam narasi cerita.

`python scripts/prepare-mission-experience.py --sync` menyinkronkan teks kanonis, foto, metadata ukuran/hash, dan panduan ke Android. Nomor revisi harus dinaikkan sebelum mengubah berkas yang telah disimpan pada revisi tersebut.

Statistik Finlandia dan Polandia yang berbeda antara cerita dan peta dicatat dalam metadata editorial; kartu negara tidak menampilkan angka yang belum diselaraskan. Perubahan itu tidak menambahkan catatan editorial ke narasi.
