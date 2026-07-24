const CACHE_NAME = 'quest-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // Guard against build-time development environment differences
        console.log('Pre-caching assets, some might not exist in dev');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Do not intercept external API, auth, or firebase real-time database endpoints
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('googleapis.com') || 
    event.request.url.includes('firebase')
  ) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // If both cache and network fail, or during offline state, return index.html for SPA router
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
