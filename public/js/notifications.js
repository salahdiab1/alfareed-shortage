'use strict';

(async function initNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.register('/sw.js');
  const btn = document.getElementById('notifBtn');
  if (!btn) return;

  updateBtn(btn, Notification.permission);

  btn.addEventListener('click', async () => {
    if (Notification.permission !== 'default') return;
    const result = await Notification.requestPermission();
    updateBtn(btn, result);
    if (result === 'granted') await subscribe(reg);
  });

  if (Notification.permission === 'granted') await subscribe(reg);
})();

function updateBtn(btn, permission) {
  if (permission === 'granted') {
    btn.textContent = '🔔';
    btn.title = 'الإشعارات مفعّلة';
    btn.disabled = true;
    btn.style.opacity = '1';
    btn.style.background = 'rgba(255,255,255,0.35)';
  } else if (permission === 'denied') {
    btn.textContent = '🔕';
    btn.title = 'الإشعارات محظورة — افتح إعدادات المتصفح لتفعيلها';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else {
    btn.textContent = '🔔';
    btn.title = 'اضغط لتفعيل الإشعارات';
    btn.disabled = false;
  }
}

async function subscribe(reg) {
  try {
    const { publicKey } = await fetch('/api/push/vapid-key').then(r => r.json());
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });
  } catch (err) {
    console.error('Push subscribe error:', err);
  }
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
