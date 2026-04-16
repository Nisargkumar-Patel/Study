import { useSessionStore } from '@/stores/sessionStore'

export function Queue() {
  const { session, isHost, removeFromQueue } = useSessionStore()

  if (!session || session.queue.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Queue</h3>
        <p className="text-sm text-muted-foreground/60 italic">No tracks in queue</p>
      </div>
    )
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const sourceLabel: Record<string, string> = {
    upload: 'Upload',
    youtube: 'YouTube',
    soundcloud: 'SoundCloud',
    radio: 'Radio',
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Queue ({session.queue.length})
      </h3>
      <div className="space-y-2">
        {session.queue.map((track, index) => (
          <div
            key={track.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:border-primary/30 transition group"
          >
            <span className="text-sm text-muted-foreground w-6 text-center font-mono">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {track.artist || 'Unknown'} &middot; {sourceLabel[track.source] || track.source} &middot;{' '}
                {formatDuration(track.duration)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground/60 hidden sm:block">{track.addedBy}</span>
            {isHost && (
              <button
                onClick={() => removeFromQueue(track.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-sm transition"
                title="Remove from queue"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
