/* Service worker de OVERCLOCK 9.
   - Navegación: red primero, caché como respaldo (offline completo).
   - Estáticos: stale-while-revalidate.
   - Ranking online (otro origen): nunca se cachea. */

const VERSION = 'overclock9-v4';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/accounts.js',
  './js/audio.js',
  './js/balance.js',
  './js/content.js',
  './js/desktop.js',
  './js/game.js',
  './js/input.js',
  './js/leaderboard.js',
  './js/main.js',
  './js/online-config.js',
  './js/pwa.js',
  './js/render.js',
  './js/ui.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const STATIC_PATTERN = /\.(css|js|png|svg|ico|webmanifest|woff2)$/i;

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) ||
      (await cache.match('./index.html')) ||
      new Response('Sin conexión', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // El ranking online y cualquier servicio externo van directos a la red.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
