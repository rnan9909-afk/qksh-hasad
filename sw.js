/* sw.js — Service Worker لتطبيق حصاد (شبكة أولاً + إشعارات دفع) */
const CACHE = 'hasad-v3';

// استقبال إشعار دفع وعرضه
self.addEventListener('push', (e) => {
  let data = { title: 'حصاد', body: '', url: '/' };
  try { data = { ...data, ...(e.data ? e.data.json() : {}) }; } catch { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title || 'حصاد', {
    body: data.body || '',
    icon: 'assets/images/icon-192.png',
    badge: 'assets/images/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  }));
});

// فتح التطبيق عند الضغط على الإشعار
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // نترك موارد الـ CDN للمتصفح

  e.respondWith((async () => {
    try {
      // no-cache: يُجبر المتصفح على التحقق من الخادم فتظهر التحديثات فوراً
      const fresh = await fetch(req, { cache: 'no-cache' });
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      // صفحة تنقّل بلا اتصال → أعِد صفحة الدخول المخزّنة إن وُجدت
      if (req.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
