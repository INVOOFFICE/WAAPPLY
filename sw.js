/* WaApply — PWA cache (same pattern as INVOOffice landing) */
const CACHE = 'waapply-blog-1e1197f874';

const REL_ASSETS = [
  'index.html',
  'styles.min.css',
  'main.min.js',
  'manifest.json',
  'favicon.svg',
  'fonts/syne-latin-400-normal.woff2',
  'fonts/syne-latin-600-normal.woff2',
  'fonts/syne-latin-700-normal.woff2',
  'fonts/syne-latin-800-normal.woff2',
  'fonts/syne-latin-ext-400-normal.woff2',
  'fonts/syne-latin-ext-600-normal.woff2',
  'fonts/syne-latin-ext-700-normal.woff2',
  'fonts/syne-latin-ext-800-normal.woff2',
  'fonts/dm-sans-latin-300-normal.woff2',
  'fonts/dm-sans-latin-300-italic.woff2',
  'fonts/dm-sans-latin-400-normal.woff2',
  'fonts/dm-sans-latin-500-normal.woff2',
  'fonts/dm-sans-latin-ext-300-normal.woff2',
  'fonts/dm-sans-latin-ext-300-italic.woff2',
  'fonts/dm-sans-latin-ext-400-normal.woff2',
  'fonts/dm-sans-latin-ext-500-normal.woff2',
  'images/noise-200.png',
];

function scopedUrl(rel) {
  return new URL(rel, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        [scopedUrl('./'), ...REL_ASSETS.map((rel) => scopedUrl(rel))].map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache skip', url, err);
          })
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function sameOriginPathOnly(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  return url.origin + url.pathname;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => {
            if (hit) return hit;
            const pathOnly = sameOriginPathOnly(request);
            if (pathOnly && pathOnly !== request.url) return caches.match(pathOnly);
            return undefined;
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      const pathOnly = sameOriginPathOnly(request);
      if (pathOnly && pathOnly !== request.url) {
        return caches.match(pathOnly).then((byPath) => byPath || fetch(request));
      }
      return fetch(request);
    })
  );
});
