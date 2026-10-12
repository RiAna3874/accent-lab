// Accent Lab service worker: offline app shell + cross-origin isolation (enables multi-threaded scoring on CPU).
const VERSION = 'al-__BUILD__';
const SHELL = __SHELL__;
const isolate = (res) => {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const headers = new Headers(res.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('al-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./', copy)); return isolate(r); })
      .catch(() => caches.match('./').then(r => isolate(r || Response.error()))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    if (hit) return isolate(hit);
    return fetch(req).then(r => {
      if (r.ok && (url.pathname.includes('/vendor/') || url.pathname.includes('/assets/'))) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return isolate(r);
    });
  }));
});
