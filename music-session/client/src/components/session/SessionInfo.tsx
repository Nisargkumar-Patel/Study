import { useSessionStore } from '@/stores/sessionStore'

export function SessionInfo() {
  const { session } = useSessionStore()

  if (!session) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Listeners ({session.participants.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {session.participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-sm"
          >
            <span
              className={`w-2 h-2 rounded-full ${p.isHost ? 'bg-primary' : 'bg-green-500'}`}
            />
            <span className="text-foreground">{p.displayName}</span>
            {p.isHost && (
              <span className="text-xs text-primary font-medium">Host</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
