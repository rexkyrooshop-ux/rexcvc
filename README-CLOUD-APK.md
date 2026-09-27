# Rexcvc — Build APK dari HP dengan GitHub Actions

Proyek ini sudah disiapkan agar Android APK dibangun di cloud. Kamu tidak perlu Android Studio di HP.

## Cara dari HP

1. Buat repository baru di GitHub, misalnya `rexcvc`.
2. Upload semua isi folder proyek ini ke repository tersebut.
3. Pastikan branch utama bernama `main`.
4. Buka tab **Actions** → pilih **Build Rexcvc APK** → **Run workflow**.
5. Tunggu workflow selesai.
6. Buka hasil workflow tersebut → bagian **Artifacts** → download `Rexcvc-debug-apk`.
7. Ekstrak ZIP artifact dan install `app-debug.apk` di Android.

## Backend

APK tidak menjalankan `server.js` di dalam aplikasi. Jika ingin tombol Proses TikTok/Instagram/YouTube memanggil backend, deploy `server.js` ke hosting Node.js yang kamu miliki, lalu buat GitHub repository variable:

`REXCVC_API_BASE_URL=https://alamat-backend-kamu.example`

Jika variable kosong, aplikasi tetap bisa dibuild tetapi request API akan mencoba `/api/download` dari WebView.

## Catatan fungsi

Backend starter Rexcvc saat ini hanya mengembalikan URL video yang dikonfigurasi melalui `DEMO_VIDEO_URL`; proyek ini tidak menambahkan scraping, penghapusan watermark, atau bypass pembatasan platform.
