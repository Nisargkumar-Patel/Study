'use client';

/**
 * HouseholdPanel — manage the members of the house.
 *
 * Add or remove housemates, mark someone away (inactive members are skipped by
 * the cooking rotation AND excluded from portion scaling), and set the phone
 * number used for SMS cooking reminders. Also hosts sign-out.
 */
import { useEffect, useState } from 'react';

interface Member {
  id: string;
  name: string;
  phone: string;
  rotationSlot: number;
  active: boolean;
  notifyBySms: boolean;
}

const PLACEHOLDER_PHONE = '+10000000000';

export default function HouseholdPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.users || []);
  }
  useEffect(() => {
    void load();
  }, []);

  const activeCount = members.filter((m) => m.active).length;

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not add member');
      return;
    }
    setNewName('');
    await load();
  }

  async function toggleActive(m: Member) {
    setMembers((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, active: !m.active } : x))
    );
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, active: !m.active }),
    });
  }

  async function savePhone(m: Member) {
    const phone = (phoneDrafts[m.id] ?? '').trim();
    if (!phone) return;
    setError('');
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Invalid phone');
      return;
    }
    setPhoneDrafts((d) => ({ ...d, [m.id]: '' }));
    await load();
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.name} from the household?`)) return;
    await fetch(`/api/users?id=${m.id}`, { method: 'DELETE' });
    await load();
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Household</h2>
        <p className="mb-3 text-sm text-gray-500">
          {activeCount} active member{activeCount === 1 ? '' : 's'} — portions and
          the cooking rotation scale to this number automatically.
        </p>

        <form onSubmit={addMember} className="mb-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a housemate…"
            required
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Add
          </button>
        </form>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <ul className="divide-y divide-gray-100">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${m.active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {m.name}
                    {!m.active && <span className="ml-2 text-xs">(away)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {m.phone === PLACEHOLDER_PHONE
                      ? 'no phone — SMS reminders off'
                      : `${m.phone} · SMS ${m.notifyBySms ? 'on' : 'off'}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={m.active}
                    onClick={() => toggleActive(m)}
                    className="toggle"
                    data-on={m.active}
                    title={m.active ? 'Mark away' : 'Mark home'}
                  >
                    <span className="toggle-knob" />
                  </button>
                  <button
                    onClick={() => removeMember(m)}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={phoneDrafts[m.id] ?? ''}
                  onChange={(e) => setPhoneDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                  placeholder="+14155550123"
                  inputMode="tel"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-brand focus:outline-none"
                />
                <button
                  onClick={() => savePhone(m)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  Save phone
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <button
          onClick={signOut}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
