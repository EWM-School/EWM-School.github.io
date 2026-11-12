// Hybrid Offline-First Service Worker (Web / GitHub Pages / Desktop PWA)
// Scope-relative (`self.registration.scope`) so it works identically at `/` and `/<repo-name>/`.

const SHELL_CACHE = 'ewm-hybrid-shell-v7';
const RUNTIME_CACHE = 'ewm-hybrid-assets-v7';

const RELATIVE_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './ewm-logo.jpg',
  './assets/aistudio/WhatsApp_Image_2026-11-08_at_14.38.24_7c01daed.jpeg',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './apple-touch-icon-precomposed.png',
  './apple-touch-icon-76x76.png',
  './apple-touch-icon-120x120.png',
  './apple-touch-icon-152x152.png',
  './apple-touch-icon-167x167.png',
  './apple-touch-icon-180x180.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-192x192.png',
  './pwa-maskable-512x512.png',
];

function resolveScopedUrls() {
  const scope = self.registration ? self.registration.scope : self.location.origin + '/';
  return RELATIVE_SHELL_ASSETS.map((rel) => new URL(rel, scope).href);
}

function getIndexUrl() {
  const scope = self.registration ? self.registration.scope : self.location.origin + '/';
  return new URL('./index.html', scope).href;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(resolveScopedUrls().map((assetUrl) => cache.add(assetUrl)))
      )
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = new Set([SHELL_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !allowedCaches.has(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticBundleAsset(pathname) {
  return (
    pathname.includes('/assets/') ||
    /\.(?:js|css|woff2?|ttf|png|jpe?g|webp|svg|ico|webmanifest)$/i.test(pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && (response.ok || response.type === 'opaque')) {
              cache.put(request, response.clone()).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/@') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  const indexUrl = getIndexUrl();

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(indexUrl, copy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const shellCache = await caches.open(SHELL_CACHE);
          return (
            (await shellCache.match(indexUrl)) ||
            (await shellCache.match(request)) ||
            Response.error()
          );
        })
    );
    return;
  }

  if (isStaticBundleAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const cloned = networkResponse.clone();
              caches
                .open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, cloned))
                .catch(() => undefined);
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
