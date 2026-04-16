import { useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

export function LandingPage() {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const { createSession, joinSession, isConnecting, error, clearError } = useSessionStore()

  const handleCreate = () => {
    if (!name.trim()) return
    createSession(name.trim(), isPublic)
  }

  const handleJoin = () => {
    if (!name.trim() || !code.trim()) return
    joinSession(code.trim().toUpperCase(), name.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="text-5xl">&#127925;</div>
          <h1 className="text-3xl font-bold text-foreground">Music Session</h1>
          <p className="text-muted-foreground text-sm">Listen together in real-time</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex justify-between">
            {error}
            <button onClick={clearError}>&times;</button>
          </div>
        )}

        {/* Idle: Show two buttons */}
        {mode === 'idle' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:opacity-90 transition"
            >
              Start a Session
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl border-2 border-primary text-primary text-lg font-semibold hover:bg-primary/10 transition"
            >
              Join a Session
            </button>
          </div>
        )}

        {/* Create */}
        {mode === 'create' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-3 rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              Make session public (discoverable)
            </label>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isConnecting}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {isConnecting ? 'Creating...' : 'Create Session'}
            </button>
            <button onClick={() => setMode('idle')} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
              Back
            </button>
          </div>
        )}

        {/* Join */}
        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-3 rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder="Session code (e.g., A3X9K2)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              className="w-full px-4 py-3 rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none text-center text-2xl tracking-[0.3em] font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || code.length !== 6 || isConnecting}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {isConnecting ? 'Joining...' : 'Join Session'}
            </button>
            <button onClick={() => setMode('idle')} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
