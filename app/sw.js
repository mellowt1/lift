// Lift offline cache: the app shell, fonts and exercise photos. Workouts are kept by the page in localStorage.
// Bump CACHE with every release so phones pick up the new files on the next launch.
const CACHE = 'lift-2';
const PHOTOS = 'photos-1';
const FILES = ['./', './index.html', './app.css', './app.js', './logic.js', './exercises.js', './exdb.json', './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('lift-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Cache first for the shell, Google Fonts and photos; the network fills the cache the first time.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const same = url.origin === location.origin;
  const photo = url.hostname === 'cdn.jsdelivr.net';
  if (!same && !photo && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  // Photos sit in their own cache that survives releases: the URLs are pinned to one commit.
  const store = photo ? PHOTOS : CACHE;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: same }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(store).then((c) => c.put(e.request, copy)); }
      return res;
    }))
  );
});
