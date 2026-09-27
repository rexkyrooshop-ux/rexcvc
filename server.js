const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/download', (req, res) => {
  const { platform, url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL video wajib diisi.' });
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'URL tidak valid.' }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'Protokol URL tidak didukung.' });

  // Safe starter: only returns a video URL that you explicitly configure.
  // It does not scrape or bypass platform restrictions.
  const demoVideoUrl = process.env.DEMO_VIDEO_URL;
  if (!demoVideoUrl) return res.status(501).json({
    error: 'Backend aktif. Set DEMO_VIDEO_URL ke URL video yang kamu miliki untuk menguji download.'
  });

  res.json({ platform: platform || 'unknown', title: 'Video Rexcvc', message: 'Video siap diunduh.', url: demoVideoUrl });
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'Rexcvc' }));

app.listen(PORT, () => console.log(`Rexcvc berjalan di http://localhost:${PORT}`));
