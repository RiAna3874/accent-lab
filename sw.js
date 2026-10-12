// Accent Lab service worker: offline app shell + cross-origin isolation (enables multi-threaded scoring on CPU).
const VERSION = 'al-641523a049';
const SHELL = ["./", "assets/app.css", "assets/fonts/gentium-plus-greek-400-normal.woff2", "assets/fonts/gentium-plus-greek-700-normal.woff2", "assets/fonts/gentium-plus-latin-400-normal.woff2", "assets/fonts/gentium-plus-latin-700-normal.woff2", "assets/fonts/gentium-plus-latin-ext-400-normal.woff2", "assets/fonts/gentium-plus-latin-ext-700-normal.woff2", "assets/fonts/ibm-plex-mono-latin-400-normal.woff2", "assets/fonts/ibm-plex-mono-latin-500-normal.woff2", "assets/fonts/ibm-plex-mono-latin-600-normal.woff2", "assets/fonts/schibsted-grotesk-latin-400-normal.woff2", "assets/fonts/schibsted-grotesk-latin-500-normal.woff2", "assets/fonts/schibsted-grotesk-latin-600-normal.woff2", "assets/fonts/schibsted-grotesk-latin-700-normal.woff2", "assets/fonts/schibsted-grotesk-latin-800-normal.woff2", "assets/icons/apple-touch-icon.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "index.html", "js/coach.js", "js/data/practice.js", "js/data/sounds.js", "js/engine/audio.js", "js/engine/fallback.js", "js/engine/formants.js", "js/engine/g2p.js", "js/engine/model.js", "js/engine/model.worker.js", "js/engine/phones.js", "js/engine/prosody.js", "js/engine/scoring.js", "js/engine/speech.js", "js/main.js", "js/store.js", "js/ui/dom.js", "js/ui/drills.js", "js/ui/engine-card.js", "js/ui/mouth.js", "js/ui/recorder.js", "js/ui/result.js", "js/ui/views/check.js", "js/ui/views/coach.js", "js/ui/views/progress.js", "js/ui/views/sounds.js", "js/ui/views/speak.js", "js/ui/views/today.js", "manifest.webmanifest", "vendor/ort/ort-wasm-simd-threaded.jsep.mjs", "vendor/ort/ort.webgpu.min.mjs", "vendor/phonemizer.js"];
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
