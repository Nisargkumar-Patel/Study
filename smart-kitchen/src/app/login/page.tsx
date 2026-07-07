'use client';

/**
 * Login — household passcode sign-in.
 *
 * Every member signs in with their own name + the shared household passcode.
 * A name the house hasn't seen before automatically joins as a new member
 * (they get the next cooking-rotation slot), so onboarding a fresh household
 * is just: deploy, share the passcode, everyone signs in.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign-in failed');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not reach the server — check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-light px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-dark">🍳 Smart Kitchen</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with your name and the household passcode.
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nisarg"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Household passcode
          </span>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-xs text-gray-400">
          First time here? Signing in with a new name joins you to the household
          and adds you to the cooking rotation.
        </p>
      </form>
    </main>
  );
}
