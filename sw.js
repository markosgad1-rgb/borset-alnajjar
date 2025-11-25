
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple fetch handler to allow PWA installation criteria
  // We rely on browser HTTP cache for assets
  // This ensures the app works online mainly (Firebase) but is installable
});
