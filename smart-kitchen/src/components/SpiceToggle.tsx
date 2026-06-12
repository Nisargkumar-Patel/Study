'use client';

/**
 * SpiceToggle — Boolean Spices & Condiments control.
 *
 * Spices bypass quantity math: each is simply in-stock or not. This panel lists
 * the household's spice inventory with a toggle switch per item, PATCHing the
 * inventory `inStock` flag on change.
 */
import { useEffect, useState } from 'react';

interface SpiceItem {
  _id: string;
  name: string;
  inStock: boolean;
  pantryCategory: string;
}

export default function SpiceToggle() {
  const [spices, setSpices] = useState<SpiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      const list: SpiceItem[] = (data.inventory || []).filter(
        (i: SpiceItem) => i.pantryCategory === 'Spices' || i.pantryCategory === 'Condiments'
      );
      setSpices(list);
      setLoading(false);
    })();
  }, []);

  async function toggle(item: SpiceItem) {
    const next = !item.inStock;
    setSpices((prev) =>
      prev.map((s) => (s._id === item._id ? { ...s, inStock: next } : s))
    );
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: item.name, inStock: next, lastUpdatedBy: 'spice-toggle' }),
    });
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold">Spices & Condiments</h2>
      <p className="mb-3 text-sm text-gray-500">
        Tracked by in-stock status only — no measuring.
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : spices.length === 0 ? (
        <p className="text-sm text-gray-400">No spices tracked yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {spices.map((item) => (
            <li key={item._id} className="flex items-center justify-between py-2">
              <span className={item.inStock ? 'text-gray-800' : 'text-amber-700'}>
                {item.name}
                {!item.inStock && (
                  <span className="ml-2 text-xs font-medium text-amber-600">
                    (out — will be added to list)
                  </span>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={item.inStock}
                onClick={() => toggle(item)}
                className="toggle"
                data-on={item.inStock}
              >
                <span className="toggle-knob" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
