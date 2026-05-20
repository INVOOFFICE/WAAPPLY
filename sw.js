/* Service Worker — Cache blog JSON + static assets for offline */
const DATA_CACHE = 'visapath-data-v2';
const STATIC_CACHE = 'visapath-static-v2';
const OFFLINE_URL = '/404.html';

const JSON_PATTERN = /\/blogs-(latest|archive)\.json$/;
const STATIC_PATTERN = /\.(css|js|xml|txt|svg|ico)$/;
const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp|avif|gif)$/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll([
        '/',
        '/404.html',
        '/assets/css/main.css',
        '/assets/js/main.js',
        '/assets/js/news.js',
        '/sitemap.xml',
        '/llms.txt',
        '/blog/',
      ]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== DATA_CACHE && k !== STATIC_CACHE) return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Blog JSON data → stale-while-revalidate
  if (JSON_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Static assets → cache-first
  if (STATIC_PATTERN.test(url.pathname) || url.pathname === '/sw.js') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Images → cache-first
  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match(OFFLINE_URL);
    if (fallback) return fallback;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const revalidate = async () => {
    try {
      const headers = new Headers();
      if (cached) {
        const etag = cached.headers.get('ETag');
        if (etag) headers.set('If-None-Match', etag);
        const lm = cached.headers.get('Last-Modified');
        if (lm) headers.set('If-Modified-Since', lm);
      }
      const res = await fetch(new Request(request, { headers }));
      if (res.ok) {
        await cache.put(request, res.clone());
      }
    } catch {}
  };

  if (cached) {
    revalidate();
    return cached;
  }

  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}
