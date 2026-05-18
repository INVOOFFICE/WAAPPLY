/* Service Worker — Cache blog JSON data with ETag revalidation */
const CACHE = 'blog-data-v1';
const JSON_PATTERN = /\/blogs-(latest|archive)\.json$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!JSON_PATTERN.test(new URL(request.url).pathname)) return;

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const revalidate = async () => {
    const headers = new Headers();
    if (cached) {
      const etag = cached.headers.get('ETag');
      if (etag) headers.set('If-None-Match', etag);
      const lm = cached.headers.get('Last-Modified');
      if (lm) headers.set('If-Modified-Since', lm);
    }

    try {
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
  if (res.ok) {
    cache.put(request, res.clone());
  }
  return res;
}
