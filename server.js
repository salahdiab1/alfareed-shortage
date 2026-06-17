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
const { getQRImage, isReady, getError } = require('./whatsapp');

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

app.get('/wa-debug', (req, res) => {
  const { execSync } = require('child_process');
  let info = {};
  try { info.which_chromium = execSync('which chromium 2>/dev/null').toString().trim(); } catch { info.which_chromium = 'not found'; }
  try { info.which_chrome = execSync('which google-chrome 2>/dev/null').toString().trim(); } catch { info.which_chrome = 'not found'; }
  info.CHROMIUM_PATH = process.env.CHROMIUM_PATH || '(empty)';
  info.PATH = process.env.PATH;
  res.json(info);
});

app.get('/wa-qr', async (req, res) => {
  if (isReady()) return res.send('<h2 style="font-family:sans-serif;color:green;padding:40px">✅ واتساب متصل بالفعل</h2>');
  const err = getError();
  if (err) return res.send(`<h2 style="font-family:sans-serif;color:red;padding:40px">❌ خطأ: ${err}</h2>`);
  const img = await getQRImage();
  if (!img) return res.send('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>⏳ جاري تشغيل واتساب، انتظر ثوانٍ...</h2><script>setTimeout(()=>location.reload(),5000)</script></body></html>');
  res.send(`<html><body style="text-align:center;font-family:sans-serif;padding:40px">
    <h2>امسح QR بواتساب لربط الحساب</h2>
    <img src="${img}" style="width:280px"><br>
    <small>الصفحة تتحدث تلقائياً كل 15 ثانية</small>
    <script>setTimeout(()=>location.reload(),15000)</script>
  </body></html>`);
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
