/* eslint-disable no-restricted-globals */
/**
 * sw.js — Custom service worker for Smart Kitchen (offline-first PWA).
 *
 * Caching strategy:
 *   - App shell (precache): cache-first so the UI boots with no network.
 *   - GET /api/* : stale-while-revalidate so the grocery list shows instantly
 *     from cache, then refreshes in the background.
 *   - Mutating /api/* (POST/PUT/PATCH/DELETE) while offline: we DON'T try to
 *     queue the raw request here. Instead the page persists the change to
 *     IndexedDB and registers a Background Sync. When the 'grocery-sync' event
 *     fires (network restored), we message every client to flush its IndexedDB
 *     mutation queue via /api/sync (see src/lib/sync.ts).
 *
 * This split keeps the typed IndexedDB logic in the app (where the schema lives)
 * and keeps the SW focused on caching + the network-restored wake-up signal.
 */

const VERSION = 'v1';
const SHELL_CACHE = `sk-shell-${VERSION}`;
const API_CACHE = `sk-api-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// ---- Install: precache the app shell --------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: intercept all network requests --------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never intercept non-GET — let mutations hit the network; if they fail while
  // offline, the page has already mirrored the change into IndexedDB.
  if (request.method !== 'GET') return;

  // API GETs: stale-while-revalidate.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigation / shell: cache-first, falling back to offline page.
  event.respondWith(cacheFirst(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached); // offline -> serve whatever we have
  return cached || network;
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok && request.mode === 'navigate') {
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    // Offline navigation fallback.
    if (request.mode === 'navigate') {
      return (await cache.match('/offline.html')) || Response.error();
    }
    return Response.error();
  }
}

// ---- Background Sync: network is back — tell pages to flush IndexedDB ------
self.addEventListener('sync', (event) => {
  if (event.tag === 'grocery-sync') {
    event.waitUntil(notifyClientsToFlush());
  }
});

async function notifyClientsToFlush() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'FLUSH_SYNC' });
  }
}

// ---- Push (SNS-style web push could land here in future) ------------------
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return { title: 'Smart Kitchen', body: event.data ? event.data.text() : '' };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Smart Kitchen', {
      body: data.body || 'You have a kitchen reminder.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});
