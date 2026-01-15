// Kaulby Service Worker - Optimized for performance
const CACHE_NAME = 'kaulby-v1';
const STATIC_CACHE = 'kaulby-static-v1';
const DYNAMIC_CACHE = 'kaulby-dynamic-v1';

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/logo.jpg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/icon-192.png',
  '/apple-touch-icon.png',
];

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - cache-first for static, network-first for dynamic
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests (analytics, auth, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API routes and auth
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/sign-') ||
      url.pathname.includes('clerk')) {
    return;
  }

  // Static assets: cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Next.js static files: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }
});

function isStaticAsset(pathname) {
  const staticExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp', '.avif',
    '.woff', '.woff2', '.ttf', '.eot',
    '.css', '.js',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}
