'use client';

/**
 * StaplesPanel — high-capacity household staples with 7-person targets.
 * Shows each staple's target vs. current and the resulting auto-injected delta.
 */
import { useEffect, useState } from 'react';

interface Staple {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  baseUnit: string;
}

export default function StaplesPanel() {
  const [staples, setStaples] = useState<Staple[]>([]);

  async function load() {
    const res = await fetch('/api/staples');
    const data = await res.json();
    setStaples(data.staples || []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function setCurrent(item: Staple, value: number) {
    setStaples((prev) =>
      prev.map((s) => (s._id === item._id ? { ...s, currentAmount: value } : s))
    );
    await fetch('/api/staples', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: item.name, currentAmount: value, lastUpdatedBy: 'staples-panel' }),
    });
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold">Household Staples</h2>
      <p className="mb-3 text-sm text-gray-500">
        Set each target to what your house goes through in a week. Any shortfall
        is injected into the grocery list automatically.
      </p>
      <ul className="divide-y divide-gray-100">
        {staples.map((s) => {
          const delta = Math.max(0, s.targetAmount - s.currentAmount);
          return (
            <li key={s._id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-400">
                  target {s.targetAmount} {s.baseUnit} ·{' '}
                  {delta > 0 ? (
                    <span className="text-amber-600">need {delta} {s.baseUnit}</span>
                  ) : (
                    <span className="text-brand-dark">stocked</span>
                  )}
                </p>
              </div>
              <input
                type="number"
                value={s.currentAmount}
                onChange={(e) => setCurrent(s, Number(e.target.value))}
                className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
              <span className="w-8 text-xs text-gray-400">{s.baseUnit}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
