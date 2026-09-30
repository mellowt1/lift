// Lift offline cache: the app shell only. Workouts are kept by the page in localStorage.
// Bump CACHE with every release so phones pick up the new files on the next launch.
const CACHE = 'lift-1';
const FILES = ['./', './index.html', './app.css', './app.js', './logic.js', './exercises.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('lift-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Cache first for the shell (and Google Fonts), network fills the cache the first time.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const same = url.origin === location.origin;
  if (!same && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: same }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }))
  );
});
