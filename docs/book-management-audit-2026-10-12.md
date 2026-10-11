# Audit pengelolaan buku — 12 Oktober 2026

Lingkup: katalog dan pembaca Android, cache SQLite, WorkManager, publisher buku, serta inventaris konten bawaan Android. Perubahan sebelumnya pada sorotan/Peraturan Jemaat dan perubahan dashboard yang berjalan bersamaan dipertahankan.

| Temuan | Perbaikan |
| --- | --- |
| Pergantian bab/buku dapat menerima hasil permintaan sebelumnya | Batalkan permintaan lama dan cocokkan identitas permintaan sebelum memperbarui tampilan; berlaku juga untuk verifikasi PDF dan tombol kembali. |
| Penyegaran katalog memakai status pemuatan pembaca | Status penyegaran dipisahkan agar pembaca tidak kehilangan indikator atau menerima keadaan keliru. |
| “Baca” pada buku biasa selalu mulai dari awal | Lanjutkan bab terakhir yang masih valid, lalu pulihkan posisi baca yang sudah tersedia. Riwayat dicatat setelah teks berhasil dimuat. |
| Bacaan berkala dapat memilih minggu sesudah Sabat yang dimaksud | Pilih tanggal Sabat yang persis cocok; Sabtu memakai tanggal hari itu. Jika bacaan belum ada, tampilkan keadaan kosong. |
| Pengelompokan karya menyembunyikan edisi tahun/triwulan lain | Bahasa dikelompokkan hanya dalam edisi periode yang sama; periode berbeda menjadi buku terpisah. |
| Katalog segar masih mencampur entri cache yang telah dihapus | Saat koneksi berhasil, pertahankan katalog segar, aset bawaan, dan salinan yang benar-benar diunduh. |
| Edisi lama offline selalu mendahului manifest baru | Cari salinan dengan revisi yang cocok; gunakan revisi lama sebagai cadangan ketika manifest baru tidak dapat diambil. |
| Pekerjaan unduhan lama mengalahkan pekerjaan aktif | Prioritaskan pekerjaan aktif; pekerjaan baru menyimpan waktu pembaruan untuk pemilihan status terminal. PDF dicocokkan per sumber. |
| Manager sulit digunakan setelah jumlah buku bertambah | Tambahkan pencarian, filter status, ringkasan penyimpanan, dan inventaris revisi yang masih tersimpan. |
| Renungan bawaan tidak tercantum di manager buku | Tambahkan inventaris Renungan offline dan tindakan yang membuka pembaca Renungan. |
| Penghapusan salinan terjadi tanpa konfirmasi | Konfirmasi singkat sebelum menghapus buku atau PDF. |
| Detail dan deskripsi terpecah ke modal tambahan | Tampilkan sampul, deskripsi, klasifikasi, periode dan tindakan utama di detail pertama. |
| Sampul offline masih menampilkan tombol tambahan | Sampul offline bersih; sentuh sampul untuk membuka detail. Ikon memiliki target sentuh lebih besar. |
| Indeks SQLite melabeli buku lengkap meski bab hilang | Periksa keberadaan/ukuran berkas saat menyusun status offline; checksum tetap diperiksa ketika membaca. |
| Validasi umum belum menjamin jadwal terbit lengkap | Tolak tanggal ganda, tanggal tidak valid, bacaan di luar periode, Sabat kosong, dan posisi saudara TOC yang bentrok. |
| Buku bisa melewati batas cache Android | Publisher memeriksa batas ukuran offline 128 MiB. |
| Pemeriksaan tanpa menulis melewatkan perubahan revisi immutable | `npm run validate` sekarang juga menolak perubahan artefak revisi yang sudah ada. |
| Peraturan Jemaat dan Renungan tidak masuk inventaris publisher | Panel review lokal juga membaca aset bawaan kedua fitur, memeriksa checksum dan kelengkapan bacaan harian. |

## Pengelolaan konten

Jalankan `npm run manage:books` dari `sabatku-books`; panel tersedia di `http://127.0.0.1:4317`. Panel membaca sumber lokal, menampilkan sampul, metadata, filter dan isi bab. Konten preview ditampilkan sebagai teks sumber, sehingga HTML dalam sumber tidak dieksekusi. Server hanya menerima GET pada localhost dan berkas sampul yang sudah masuk inventaris.

Panel ini untuk inventaris dan review. Penyuntingan tetap pada sumber repositori dan penerbitan tetap melalui pipeline yang ada. Modul publikasi buku di server Studio masih ditunda sesuai arsitektur proyek; audit ini tidak mengklaim modul tersebut sudah aktif. Renungan tetap memakai pembaca dan katalog tahunannya sendiri di Android.

## Verifikasi

Verifikasi mencakup kompilasi Android, unit test kebijakan edisi/tanggal dan cache buku/PDF, validasi publisher, suite publisher, serta alur panel melalui browser (pencarian, bahasa, daftar isi, isi bab dan sampul). Tidak ada build APK atau publikasi GitHub dalam pekerjaan ini. Interaksi Android pada perangkat belum diverifikasi dalam audit ini.

Hasil akhir: `BUILD SUCCESSFUL`; 8 unit test Android lulus dan 15 test publisher lulus. Hasil tes Android ditempatkan di `app/build/book-audit-results` karena direktori tes biasa sedang dipakai proses lain. Satu ketidakcocokan `AutoCloseable` pada Android lama ditemukan saat pengujian dan diperbaiki dengan penutupan database secara eksplisit.
