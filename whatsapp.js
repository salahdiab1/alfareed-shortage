'use strict';

const INSTANCE_ID = process.env.GREEN_API_INSTANCE;
const API_TOKEN   = process.env.GREEN_API_TOKEN;
const BASE_URL    = process.env.GREEN_API_URL || 'https://api.green-api.com';

const RECIPIENTS = [
  '972505142161@c.us',
  '972526311934@c.us',
  '972543005884@c.us',
];

async function sendToOne(chatId, message) {
  try {
    const res = await fetch(`${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    if (res.ok) console.log(`✅ أُرسل إلى ${chatId}`);
    else console.warn(`⚠️  Green API (${chatId}): ${res.status}`);
  } catch (err) {
    console.error(`❌ خطأ (${chatId}):`, err.message);
  }
}

async function sendMessage(text) {
  if (!INSTANCE_ID || !API_TOKEN) {
    console.warn('⚠️  GREEN_API_INSTANCE أو GREEN_API_TOKEN غير محددين');
    return;
  }
  await Promise.all(RECIPIENTS.map(id => sendToOne(id, text)));
}

module.exports = { sendMessage };
