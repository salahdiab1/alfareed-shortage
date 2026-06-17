'use strict';

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'نقص جديد', {
      body: data.body || '',
      icon: '/assets/farid.webp',
      badge: '/assets/farid.webp',
      data: { url: data.url || '/dashboard' },
      vibrate: [200, 100, 200],
      requireInteraction: !!data.urgent,
      dir: 'rtl',
      lang: 'ar'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});
