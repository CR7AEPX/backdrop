// Advanced Caching Service Worker
const CACHE_NAME = 'backdrop-studio-v2';

// Local files to pre-cache immediately
const STATIC_URLS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategy: Stale-While-Revalidate for most things, 
  // Cache First for CDNs (they are versioned usually)

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If found in cache, return it
      if (cachedResponse) {
        // Optional: Update cache in background if it's not a CDN immutable file
        if (!requestUrl.hostname.includes('cdn') && !requestUrl.hostname.includes('esm.sh')) {
             fetch(event.request).then(response => {
                 if(response && response.status === 200) {
                     const responseToCache = response.clone();
                     caches.open(CACHE_NAME).then(cache => {
                         cache.put(event.request, responseToCache);
                     });
                 }
             }).catch(() => {}); // Eat errors if offline
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors' && response.type !== 'opaque') {
          return response;
        }

        // Cache CSS/JS from CDNs and local files
        // We cache opaque responses (CDNs often return opaque if not CORS configured perfectly, though esm.sh usually is CORS)
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});