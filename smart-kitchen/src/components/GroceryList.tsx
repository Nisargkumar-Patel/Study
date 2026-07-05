'use client';

/**
 * GroceryList — the offline-first heart of the in-store experience.
 *
 * - On mount, hydrates instantly from IndexedDB (works with zero network).
 * - In parallel, tries to pull the latest server list and refresh the cache.
 * - Checking an item off or editing it writes to IndexedDB AND enqueues a
 *   mutation; if online it flushes immediately, otherwise it waits for the
 *   Background Sync / `online` event handled by sync.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  getGroceryList,
  cacheGroceryList,
  applyLocalMutation,
  type GroceryItemRecord,
} from '@/lib/idb';
import { syncNow, pullLatest } from '@/lib/sync';
import ManualAddItem from './ManualAddItem';

export default function GroceryList() {
  const [items, setItems] = useState<GroceryItemRecord[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  async function hydrate() {
    const local = await getGroceryList();
    setItems(local);
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    (async () => {
      await hydrate(); // instant, from cache
      if (navigator.onLine) {
        await pullLatest(); // refresh from server
        await hydrate();
      }
      setLoading(false);
    })();

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function toggleChecked(item: GroceryItemRecord) {
    const updated = { ...item, checked: !item.checked };
    // The server persists checked ids on the MealPlan, so include the line id.
    await applyLocalMutation(updated, {
      type: 'CHECK_ITEM',
      payload: { id: item.id, name: item.name, checked: updated.checked },
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    if (navigator.onLine) void syncNow().then(hydrate);
  }

  async function onManualAdd(rec: GroceryItemRecord) {
    // Replace any existing entry with the same id instead of duplicating.
    const next = [...items.filter((i) => i.id !== rec.id), rec];
    await cacheGroceryList(next);
    await applyLocalMutation(rec, {
      type: 'ADD_MANUAL',
      payload: { name: rec.name, amount: rec.amount, unit: rec.unit },
    });
    setItems(next);
    if (navigator.onLine) void syncNow().then(hydrate);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, GroceryItemRecord[]>();
    for (const it of items) {
      const arr = map.get(it.pantryCategory) || [];
      arr.push(it);
      map.set(it.pantryCategory, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Grocery List</h2>
          <p className="text-sm text-gray-500">{remaining} items remaining</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            online ? 'bg-brand-light text-brand-dark' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {online ? 'Online · synced' : 'Offline · saved locally'}
        </span>
      </div>

      <ManualAddItem onAdd={onManualAdd} />

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nothing to buy yet — generate this week's list from the dashboard.
        </p>
      ) : (
        grouped.map(([category, group]) => (
          <div key={category} className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {category}
            </h3>
            <ul className="divide-y divide-gray-100">
              {group.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecked(item)}
                    className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span
                    className={`flex-1 ${
                      item.checked ? 'text-gray-400 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.name}
                    {item.source === 'manual' && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 text-[10px] text-blue-700">
                        manual
                      </span>
                    )}
                    {item.booleanItem && (
                      <span className="ml-2 rounded bg-purple-100 px-1.5 text-[10px] text-purple-700">
                        spice
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-500">{item.display}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
