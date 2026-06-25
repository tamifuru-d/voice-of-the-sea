/**
 * Voice of the Sea — Service Worker
 * Cache strategy:
 *   - App shell: precache on install
 *   - audio/ maps/: cache-first (add to cache on first fetch)
 *   - everything else: network-first
 */

'use strict';

const CACHE_VERSION = 'vots-v3';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/manifest.json',
  './icon.svg',
];

/* ===== Install: precache app shell ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(SHELL_ASSETS.map(u => new Request(u, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

/* ===== Activate: delete old caches ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ===== Fetch: routing ===== */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // audio/ and maps/: cache-first
  if (pathname.includes('/audio/') || pathname.includes('/maps/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // App shell and data: network-first
  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // No network and no cache — return empty 503
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to index.html for navigation requests
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503 });
  }
}
