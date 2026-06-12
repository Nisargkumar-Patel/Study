'use client';

/**
 * RotationSchedule — 7-housemate cooking-duty matrix for the active week.
 *
 * Shows each day's dish + assigned cook, lets an admin recompute the rotation,
 * and dispatches AWS SNS SMS reminders (all reminders for the week, or just the
 * selected day) via the API.
 */
import { useEffect, useState } from 'react';

interface RotationEntry {
  date: string;
  dish: string;
  cookName: string;
  reminderSentAt: string | null;
}

export default function RotationSchedule() {
  const [rotation, setRotation] = useState<RotationEntry[]>([]);
  const [week, setWeek] = useState<{ weekStart: string; weekEnd: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');

  async function load() {
    const res = await fetch('/api/rotation');
    const data = await res.json();
    setRotation(data.rotation || []);
    setWeek(data.week || null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function resolve() {
    setBusy(true);
    setStatus('');
    await fetch('/api/rotation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await load();
    setBusy(false);
    setStatus('Rotation recomputed.');
  }

  async function notifyWeek() {
    setBusy(true);
    setStatus('');
    const res = await fetch('/api/rotation/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    setStatus(
      data.sent !== undefined
        ? `Sent ${data.sent} reminder(s)${data.failures?.length ? `, ${data.failures.length} failed` : ''}.`
        : data.message || 'No reminders due.'
    );
    await load();
    setBusy(false);
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cooking Rotation</h2>
          {week && (
            <p className="text-sm text-gray-500">
              {fmt(week.weekStart)} – {fmt(week.weekEnd)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={resolve}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Recompute
          </button>
          <button
            onClick={notifyWeek}
            disabled={busy}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Send SMS reminders
          </button>
        </div>
      </div>

      {status && <p className="mb-2 text-sm text-brand-dark">{status}</p>}

      {rotation.length === 0 ? (
        <p className="text-sm text-gray-400">No rotation yet — click Recompute.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rotation.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-800">{r.dish}</p>
                <p className="text-xs text-gray-400">{fmt(r.date)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-brand-dark">{r.cookName}</p>
                <p className="text-[11px] text-gray-400">
                  {r.reminderSentAt ? 'reminder sent' : 'not notified'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
