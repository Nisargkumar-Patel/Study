'use client';

/**
 * Dashboard — the Smart Kitchen home screen.
 *
 * A lightweight tabbed shell that stitches together the grocery list (offline
 * first), staples, spices, and the cooking rotation. The "Generate" action runs
 * the server-side scaling + delta pipeline and refreshes the offline cache.
 */
import { useState } from 'react';
import GroceryList from '@/components/GroceryList';
import StaplesPanel from '@/components/StaplesPanel';
import SpiceToggle from '@/components/SpiceToggle';
import RotationSchedule from '@/components/RotationSchedule';
import HouseholdPanel from '@/components/HouseholdPanel';
import { cacheGroceryList, type GroceryItemRecord } from '@/lib/idb';

type Tab = 'grocery' | 'staples' | 'spices' | 'rotation' | 'household';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'staples', label: 'Staples', icon: '🥛' },
  { id: 'spices', label: 'Spices', icon: '🌶️' },
  { id: 'rotation', label: 'Rotation', icon: '👩‍🍳' },
  { id: 'household', label: 'House', icon: '🏠' },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('grocery');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  async function generate() {
    setGenerating(true);
    setGenMsg('');
    try {
      const res = await fetch('/api/grocery');
      const data = await res.json();
      const list: GroceryItemRecord[] = data.groceryList || [];
      await cacheGroceryList(list);
      setGenMsg(`Generated ${list.length} items for this week.`);
      setTab('grocery');
    } catch {
      setGenMsg('Could not reach the server — showing your cached list.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">🍳 Smart Kitchen</h1>
          <p className="text-sm text-gray-500">Meal planner for the whole house</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate list'}
        </button>
      </header>

      {genMsg && (
        <p className="mb-4 rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
          {genMsg}
        </p>
      )}

      {/* Tab content */}
      <section>
        {tab === 'grocery' && <GroceryList />}
        {tab === 'staples' && <StaplesPanel />}
        {tab === 'spices' && <SpiceToggle />}
        {tab === 'rotation' && <RotationSchedule />}
        {tab === 'household' && <HouseholdPanel />}
      </section>

      {/* Bottom tab bar (mobile-first) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                tab === t.id ? 'text-brand-dark' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
