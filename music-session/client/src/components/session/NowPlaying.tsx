import { useEffect, useState, useRef } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

export function NowPlaying() {
  const { session } = useSessionStore()
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!session) return

    if (session.isPlaying && session.currentTrack) {
      const startTime = Date.now()
      const startPosition = session.playbackPosition

      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const delta = (now - startTime) / 1000
        setElapsed(Math.min(startPosition + delta, session.currentTrack!.duration))
      }, 250)
    } else {
      setElapsed(session.playbackPosition)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.isPlaying, session?.playbackPosition, session?.currentTrack?.id])

  if (!session?.currentTrack) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">&#127926;</div>
        <h2 className="text-xl font-semibold text-foreground">No track playing</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {session ? 'Add a track to get started' : 'Waiting for session...'}
        </p>
      </div>
    )
  }

  const track = session.currentTrack
  const progress = track.duration > 0 ? (elapsed / track.duration) * 100 : 0

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const sourceIcon: Record<string, string> = {
    upload: '&#128190;',
    youtube: '&#9654;&#65039;',
    soundcloud: '&#9729;&#65039;',
    radio: '&#128225;',
  }

  return (
    <div className="text-center space-y-4">
      {/* Track visualization */}
      <div className="relative mx-auto w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center overflow-hidden">
        <div
          className={`text-7xl transition-transform duration-1000 ${session.isPlaying ? 'animate-pulse' : ''}`}
          dangerouslySetInnerHTML={{ __html: sourceIcon[track.source] || '&#127925;' }}
        />
        {session.isPlaying && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 items-end h-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Track info */}
      <div>
        <h2 className="text-xl font-bold text-foreground">{track.title}</h2>
        <p className="text-muted-foreground text-sm">{track.artist || 'Unknown Artist'}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Added by {track.addedBy}</p>
      </div>

      {/* Progress bar */}
      <div className="max-w-sm mx-auto space-y-1">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(track.duration)}</span>
        </div>
      </div>
    </div>
  )
}
