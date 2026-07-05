/* eslint-disable no-restricted-globals */
/**
 * sw.js — Custom service worker for Smart Kitchen (offline-first PWA).
 *
 * Caching strategy:
 *   - Navigations: network-first (fresh HTML when online), falling back to the
 *     cached page, then offline.html. The successful response is cached so the
 *     app boots with no network next time.
 *   - Static assets (/_next/static/*, images, fonts, manifest): cache-first
 *     with runtime population. Next.js chunk filenames are content-hashed, so
 *     once cached they are immutable. WITHOUT this, offline navigation would
 *     serve cached HTML whose script tags 404 — a dead app.
 *   - GET /api/* : stale-while-revalidate so the grocery list shows instantly
 *     from cache, then refreshes in the background.
 *   - Mutating /api/* (POST/PUT/PATCH/DELETE) while offline: we DON'T queue
 *     raw requests here. The page persists the change to IndexedDB and
 *     registers a Background Sync; when 'grocery-sync' fires (network
 *     restored), we message every client to flush its mutation queue via
 *     /api/sync (see src/lib/sync.ts). This keeps the typed IndexedDB logic in
 *     the app and keeps the SW focused on caching + the wake-up signal.
 */

const VERSION = 'v2';
const SHELL_CACHE = `sk-shell-${VERSION}`;
const ASSET_CACHE = `sk-assets-${VERSION}`;
const API_CACHE = `sk-api-${VERSION}`;

const SHELL_ASSETS = ['/', '/manifest.json', '/offline.html'];

const ASSET_PATTERN = /^\/(_next\/static\/|icons\/)|\.(js|css|png|jpg|jpeg|svg|ico|webp|woff2?)$/;

// ---- Install: precache the app shell --------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, ASSET_CACHE, API_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---- Fetch: intercept all network requests --------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never intercept non-GET — let mutations hit the network; if they fail
  // while offline, the page has already mirrored the change into IndexedDB.
  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
  } else if (ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstAsset(request));
  }
  // Anything else falls through to the network untouched.
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

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    return (
      (await cache.match(request)) ||
      (await cache.match('/')) ||
      (await cache.match('/offline.html')) ||
      Response.error()
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
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
