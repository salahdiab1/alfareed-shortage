'use strict';

const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const db       = require('../database');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BMyemMiS1sNByC_xWih-MdSLNDgB5pDDhWSf_Onc2uwypMkl1LIK-X4bABYuH71P_tszb584yDYTjQ97l79rYN8';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'JvkzYnkk8HrvLgYqvqyrr-NpbheLgFpiyb5dvjHr2QU';

webpush.setVapidDetails('mailto:salahdiab500@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

// GET /api/push/vapid-key
router.get('/vapid-key', (req, res) => res.json({ publicKey: VAPID_PUBLIC }));

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'بيانات غير صحيحة' });
  db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription) VALUES (?, ?)')
    .run(subscription.endpoint, JSON.stringify(subscription));
  res.json({ ok: true });
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

async function sendPushToAll(payload) {
  const subs = db.prepare('SELECT endpoint, subscription FROM push_subscriptions').all();
  await Promise.all(subs.map(({ endpoint, subscription }) =>
    webpush.sendNotification(JSON.parse(subscription), payload).catch(err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
      }
    })
  ));
}

module.exports = { router, sendPushToAll };
