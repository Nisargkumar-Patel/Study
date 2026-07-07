/**
 * sync.ts — Background sync reconciliation between IndexedDB and MongoDB.
 *
 * Strategy (last-write-wins on the server):
 *   1. On regaining connectivity (or a Background Sync `sync` event), drain the
 *      IndexedDB mutation queue and POST it to /api/sync.
 *   2. The server applies each mutation idempotently and returns the canonical
 *      grocery list, which we write back into IndexedDB as the new truth.
 *   3. Successfully-replayed mutations are marked synced locally.
 *
 * This module is also invoked by the service worker's Background Sync handler
 * via a postMessage bridge, so a queued change made fully offline still flushes
 * automatically the moment the OS reports the network is back.
 */
'use client';

import {
  getPendingMutations,
  markMutationsSynced,
  cacheGroceryList,
  type GroceryItemRecord,
} from './idb';

export interface SyncResult {
  pushed: number;
  conflicts: number;
  ok: boolean;
}

export async function syncNow(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { pushed: 0, conflicts: 0, ok: false };
  }

  const pending = await getPendingMutations();
  if (pending.length === 0) {
    // Still pull the latest server list so other housemates' edits show up.
    await pullLatest();
    return { pushed: 0, conflicts: 0, ok: true };
  }

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations: pending }),
  });

  if (!res.ok) {
    return { pushed: 0, conflicts: 0, ok: false };
  }

  const data: { groceryList: GroceryItemRecord[]; conflicts: number } =
    await res.json();

  // Server response is canonical truth — overwrite local cache.
  await cacheGroceryList(data.groceryList);

  const syncedIds = pending
    .map((m) => m.id)
    .filter((id): id is number => typeof id === 'number');
  await markMutationsSynced(syncedIds);

  return { pushed: pending.length, conflicts: data.conflicts ?? 0, ok: true };
}

/** Pull the latest server grocery list without pushing anything. */
export async function pullLatest(): Promise<void> {
  try {
    const res = await fetch('/api/grocery', { method: 'GET' });
    if (!res.ok) return;
    const data: { groceryList: GroceryItemRecord[] } = await res.json();
    if (Array.isArray(data.groceryList)) {
      await cacheGroceryList(data.groceryList);
    }
  } catch {
    /* offline — fine, IndexedDB still serves the cached list */
  }
}

/**
 * Wire automatic sync triggers. Call once on app mount.
 *   - Replays the queue whenever the browser fires `online`.
 *   - Registers a Background Sync tag so the SW can flush even if the tab closed
 *     (Chromium only).
 *   - Fallback for browsers WITHOUT Background Sync (Safari, Firefox): a
 *     30-second heartbeat that flushes any pending mutations while online, plus
 *     a flush whenever the tab regains focus — covering "phone came back online
 *     while the app was backgrounded".
 */
export function initAutoSync(): () => void {
  const onOnline = () => void syncNow();
  window.addEventListener('online', onOnline);

  // Best-effort Background Sync registration.
  const hasBackgroundSync = 'serviceWorker' in navigator && 'SyncManager' in window;
  if (hasBackgroundSync) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('grocery-sync'))
      .catch(() => {/* sync API unavailable — rely on the fallbacks below */});
  }

  // Heartbeat fallback: only fires a network call when there is actually
  // something queued, so it costs nothing in the steady state.
  const heartbeat = setInterval(async () => {
    if (!navigator.onLine) return;
    const pending = await getPendingMutations();
    if (pending.length > 0) void syncNow();
  }, 30_000);

  // Flush when the tab becomes visible again (e.g. returning to the app after
  // leaving the store's dead zone with the phone in your pocket).
  const onVisible = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void syncNow();
  };
  document.addEventListener('visibilitychange', onVisible);

  // Listen for the SW asking the page to flush (it can't touch IndexedDB schema
  // typed helpers, so it delegates the actual replay back to the page).
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'FLUSH_SYNC') void syncNow();
  };
  navigator.serviceWorker?.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(heartbeat);
    navigator.serviceWorker?.removeEventListener('message', onMessage);
  };
}
