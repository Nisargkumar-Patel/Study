'use client';

/**
 * ServiceWorkerRegister — registers the custom service worker and starts the
 * offline auto-sync engine. Rendered once in the root layout.
 */
import { useEffect } from 'react';
import { initAutoSync } from '@/lib/sync';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => {
          // Begin listening for online/offline + Background Sync flush signals.
          cleanup = initAutoSync();
        })
        .catch((err) => console.error('SW registration failed:', err));
    }

    return () => cleanup?.();
  }, []);

  return null;
}
