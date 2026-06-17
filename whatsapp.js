'use strict';

const QRCode = require('qrcode');
const path   = require('path');

const DATA_DIR   = process.env.DATA_DIR || __dirname;
const AUTH_PATH  = path.join(DATA_DIR, '.wwebjs_auth');

const RECIPIENTS = [
  '972505142161@c.us',
  '972526311934@c.us',
  '972543005884@c.us',
];

let client  = null;
let ready   = false;
let lastQR  = null;
let initErr = null;

function startClient() {
  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
      puppeteer: {
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
      },
    });

    client.on('qr', qr => {
      lastQR = qr;
      console.log('📱 QR كود جاهز — افتح /wa-qr في المتصفح لمسحه');
    });

    client.on('ready', () => {
      ready  = true;
      lastQR = null;
      console.log('✅ واتساب متصل وجاهز للإرسال التلقائي');
    });

    client.on('auth_failure', () => console.error('❌ فشل تسجيل الدخول لواتساب'));

    client.on('disconnected', reason => {
      ready = false;
      console.warn('⚠️  واتساب انقطع:', reason);
      setTimeout(startClient, 5000);
    });

    client.initialize().catch(err => {
      initErr = err.message;
      console.error('❌ خطأ في تهيئة واتساب:', err.message);
    });
  } catch (err) {
    initErr = err.message;
    console.error('❌ تعذّر تحميل whatsapp-web.js:', err.message);
  }
}

startClient();

async function sendMessage(text) {
  if (!ready) {
    console.warn('⚠️  واتساب غير متصل');
    return;
  }
  await Promise.all(
    RECIPIENTS.map(chatId =>
      client.sendMessage(chatId, text)
        .then(() => console.log(`✅ أُرسل إلى ${chatId}`))
        .catch(err => console.error(`❌ فشل الإرسال إلى ${chatId}:`, err.message))
    )
  );
}

async function getQRImage() {
  if (!lastQR) return null;
  return QRCode.toDataURL(lastQR);
}

function isReady() { return ready; }
function getError() { return initErr; }

module.exports = { sendMessage, getQRImage, isReady, getError };
