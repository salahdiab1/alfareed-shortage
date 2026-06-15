const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR  = process.env.DATA_DIR || __dirname;
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = require('./database');

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/reports'));

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- 6-month rolling cleanup ---
function cleanOldReports() {
  try {
    const old = db.prepare(
      "SELECT photo_path FROM reports WHERE created_at < datetime('now', '-6 months') AND photo_path IS NOT NULL"
    ).all();

    for (const r of old) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(r.photo_path))); } catch {}
    }

    const { changes } = db.prepare(
      "DELETE FROM reports WHERE created_at < datetime('now', '-6 months')"
    ).run();

    if (changes > 0) console.log(`🗑️  Cleanup: removed ${changes} reports older than 6 months`);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

cleanOldReports();
setInterval(cleanOldReports, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`✅ AL FAREED Shortage System running`);
  console.log(`   Data:     ${DATA_DIR}`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${ip}:${PORT}   ← شاركه مع العمال`);
});
