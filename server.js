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

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

require('./database');

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/reports'));

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`✅ AL FAREED Shortage System running`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${ip}:${PORT}   ← شاركه مع العمال`);
});
