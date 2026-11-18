// Service Worker for بورصة النجار - ERP
// Goal: the installed app must open with NO internet. Everything needed to start (index.html, the
// JS bundle, Tailwind, fonts, html2canvas) is stored in the cache when the worker is installed.
const CACHE_NAME = 'alnajjar-erp-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/icon.svg',
  '/apple-touch-icon.png'
];
const CDN_HOST_RE = /(^|\.)(cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|aistudiocdn\.com)$/;
const NAV_TIMEOUT_MS = 4000;

const putSafe = async (cache, key, response) => {
  try { if (response) await cache.put(key, response); } catch (e) { /* ignore */ }
};

// Download everything index.html needs and store it, so the first offline launch works.
const precacheApp = async (cache) => {
  // 1) static files (one by one so a single failure does not cancel the others)
  await Promise.all(STATIC_ASSETS.map(async (u) => {
    try {
      const r = await fetch(u, { cache: 'reload' });
      if (r && r.ok) await putSafe(cache, u, r);
    } catch (e) { /* ignore */ }
  }));

  // 2) the files referenced by index.html (hashed JS/CSS bundle, CDN scripts, fonts stylesheet)
  let html = '';
  try {
    const r = await fetch('/index.html', { cache: 'reload' });
    if (r && r.ok) {
      await putSafe(cache, '/index.html', r.clone());
      await putSafe(cache, '/', r.clone());
      html = await r.text();
    }
  } catch (e) { /* ignore */ }
  if (!html) return;

  const urls = new Set();
  const re = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith('/assets/')) urls.add(u);
    else if (/^https?:\/\//.test(u)) {
      try { if (CDN_HOST_RE.test(new URL(u).hostname)) urls.add(u); } catch (e) { /* ignore */ }
    }
  }

  await Promise.all([...urls].map(async (u) => {
    try {
      const isFontsCss = u.includes('fonts.googleapis.com');
      if (isFontsCss) {
        // fonts stylesheet: also store the font files it points to
        const r = await fetch(u, { mode: 'cors' });
        if (r && r.ok) {
          await putSafe(cache, u, r.clone());
          const css = await r.text();
          const fontUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(x => x[1]);
          await Promise.all(fontUrls.map(async (fu) => {
            try {
              const fr = await fetch(fu, { mode: 'cors' });
              if (fr && fr.ok) await putSafe(cache, fu, fr);
            } catch (e) { /* ignore */ }
          }));
        }
        return;
      }
      const sameOrigin = u.startsWith('/');
      const r = await fetch(u, sameOrigin ? { cache: 'reload' } : { mode: 'no-cors' });
      if (r && (r.ok || r.type === 'opaque')) await putSafe(cache, u, r);
    } catch (e) { /* ignore */ }
  }));
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => precacheApp(cache)).catch((err) => {
      console.warn('Pre-cache error (non-fatal):', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

const storeIfCacheable = (request, response, url) => {
  const isCdn = CDN_HOST_RE.test(url.hostname);
  const cacheable = response && ((response.status === 200 && response.type === 'basic') ||
    (isCdn && (response.status === 200 || response.type === 'opaque')));
  if (cacheable) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  }
};

// Network first, but give up after a few seconds so a "connected without internet" link cannot hang the app.
const networkFirst = (event, url) => {
  const request = event.request;
  const networkPromise = fetch(request).then((response) => {
    storeIfCacheable(request, response, url);
    return response;
  });
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS));
  networkPromise.catch(() => {}); // avoid unhandled rejection when the timeout wins
  return Promise.race([networkPromise, timeoutPromise]).catch(() =>
    caches.match(request).then((cached) => {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('/index.html').then((idx) => idx || caches.match('/'));
      }
      return new Response('Network error occurred', { status: 408, headers: { 'Content-Type': 'text/plain' } });
    })
  );
};

// Cache first (hashed bundle files and CDN libraries never change for the same URL); refresh in background.
const cacheFirst = (event, url) => {
  const request = event.request;
  return caches.match(request).then((cached) => {
    if (cached) {
      fetch(request).then((response) => storeIfCacheable(request, response, url)).catch(() => {});
      return cached;
    }
    return fetch(request).then((response) => {
      storeIfCacheable(request, response, url);
      return response;
    }).catch(() => new Response('Network error occurred', { status: 408, headers: { 'Content-Type': 'text/plain' } }));
  });
};

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass manifest.json, chrome-extension, and Firebase/API calls from SW interception
  if (
    event.request.method !== 'GET' ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('/manifest.json') ||
    url.protocol === 'chrome-extension:' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken')
  ) {
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if ((sameOrigin && url.pathname.startsWith('/assets/')) || CDN_HOST_RE.test(url.hostname)) {
    event.respondWith(cacheFirst(event, url));
    return;
  }
  event.respondWith(networkFirst(event, url));
});
