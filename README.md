# Rexcvc — Frontend + Backend

## Jalankan

1. Install Node.js.
2. Buka terminal pada folder ini.
3. Jalankan `npm install`.
4. Jalankan `npm start`.
5. Buka `http://localhost:3000`.

## Uji backend

Backend menyediakan `POST /api/download`. Untuk demo, set `DEMO_VIDEO_URL` ke URL file MP4 yang kamu miliki, lalu jalankan server.

Windows PowerShell:
`$env:DEMO_VIDEO_URL="https://domain-kamu.example/video.mp4"; npm start`

Linux/macOS:
`DEMO_VIDEO_URL="https://domain-kamu.example/video.mp4" npm start`

Endpoint `/health` tersedia untuk pengecekan server.

### Catatan
Starter ini tidak melakukan scraping, penghapusan watermark, atau bypass pembatasan TikTok/Instagram/YouTube. Endpoint mengembalikan file video yang kamu konfigurasi sendiri. Untuk produksi, gunakan sumber video/storage/CDN yang memang kamu miliki hak untuk didistribusikan.
