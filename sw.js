/* ============================================================
   waapply — Service Worker
   Strategy:
   - Shell (HTML/CSS/JS/SVG): Cache-first, background update
   - News data (news.json / news-latest.json): Network-first, fallback cache
   - Images: Cache-first (stale-while-revalidate, 7 days)
   - Article pages: Network-first, fallback cache
   ============================================================ */

var CACHE_VERSION = "waapply-v1";
var SHELL_CACHE   = CACHE_VERSION + "-shell";
var DATA_CACHE    = CACHE_VERSION + "-data";
var IMAGE_CACHE   = CACHE_VERSION + "-images";

var SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/main.js",
  "/favicon.svg",
  "/manifest.json",
  "/contact.html",
  "/privacy-policy.html",
  "/terms-of-use.html",
  "/offline.html"
];

/* ── Install: pre-cache shell ───────────────────────────── */
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // addAll fails silently per file — use individual adds for resilience
      return Promise.allSettled(
        SHELL_ASSETS.map(function (url) {
          return cache.add(url).catch(function () {
            console.warn("[SW] Could not pre-cache:", url);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean old caches ────────────────────────── */
self.addEventListener("activate", function (e) {
  var validCaches = [SHELL_CACHE, DATA_CACHE, IMAGE_CACHE];
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          return !validCaches.includes(k);
        }).map(function (k) {
          console.log("[SW] Deleting old cache:", k);
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: routing strategy ────────────────────────────── */
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  // Only handle same-origin or known CDN requests
  if (e.request.method !== "GET") return;

  // ── News data: network-first, 5s timeout ──────────────
  if (url.pathname.endsWith("news.json") || url.pathname.endsWith("news-latest.json")) {
    e.respondWith(networkFirstWithTimeout(e.request, DATA_CACHE, 5000));
    return;
  }

  // ── Images: cache-first, store up to 7 days ───────────
  if (e.request.destination === "image" || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname)) {
    e.respondWith(cacheFirstWithExpiry(e.request, IMAGE_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }

  // ── Fonts (Google Fonts): cache-first ─────────────────
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }

  // ── Article pages: network-first ─────────────────────
  if (url.pathname.includes("/articles/")) {
    e.respondWith(networkFirstWithFallback(e.request, SHELL_CACHE));
    return;
  }

  // ── Shell assets: stale-while-revalidate ─────────────
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(e.request, SHELL_CACHE));
    return;
  }
});

/* ── Strategies ─────────────────────────────────────────── */

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var networkFetch = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () { return cached; });

      return cached || networkFetch;
    });
  });
}

function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  return caches.open(cacheName).then(function (cache) {
    var timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("timeout")); }, timeoutMs);
    });
    return Promise.race([
      fetch(request).then(function (response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }),
      timeoutPromise
    ]).catch(function () {
      return cache.match(request);
    });
  });
}

function networkFirstWithFallback(request, cacheName) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200) {
      caches.open(cacheName).then(function (cache) {
        cache.put(request, response.clone());
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || caches.match("/offline.html");
    });
  });
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      });
    });
  });
}

function cacheFirstWithExpiry(request, cacheName, maxAgeMs) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) {
        var dateHeader = cached.headers.get("date");
        if (dateHeader) {
          var age = Date.now() - new Date(dateHeader).getTime();
          if (age < maxAgeMs) return cached;
        } else {
          return cached; // no date header, serve anyway
        }
      }
      return fetch(request).then(function (response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        return cached; // expired but better than nothing
      });
    });
  });
}

/* ── Push notifications (future-ready) ─────────────────── */
self.addEventListener("push", function (e) {
  if (!e.data) return;
  var data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || "waapply", {
      body: data.body || "New AI news available.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(clients.openWindow(target));
});
