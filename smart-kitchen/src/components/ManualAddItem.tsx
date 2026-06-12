'use client';

/**
 * ManualAddItem — Ad-Hoc Manual Override Additions.
 *
 * Lets a user append a one-off item (with optional quantity + unit) to the
 * weekly grocery list. Emits a fully-formed GroceryItemRecord upward so the
 * parent can cache it in IndexedDB and enqueue the sync mutation.
 */
import { useState } from 'react';
import type { GroceryItemRecord } from '@/lib/idb';

const UNITS = ['pcs', 'g', 'ml'] as const;

export default function ManualAddItem({
  onAdd,
}: {
  onAdd: (item: GroceryItemRecord) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('pcs');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const amt = amount ? Number(amount) : 1;
    onAdd({
      id: `${trimmed}|manual`,
      name: trimmed,
      amount: amt,
      unit,
      display: amount ? `${amt} ${unit}` : '—',
      source: 'manual',
      pantryCategory: 'Other',
      checked: false,
      booleanItem: false,
      updatedAt: Date.now(),
    });

    setName('');
    setAmount('');
    setUnit('pcs');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a one-off item…"
        className="min-w-[10rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Qty"
        inputMode="decimal"
        className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand focus:outline-none"
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Add
      </button>
    </form>
  );
}
