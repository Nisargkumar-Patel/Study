import { useSessionStore } from '@/stores/sessionStore'

export function PlaybackControls() {
  const { session, play, pause, skip } = useSessionStore()

  if (!session) return null

  const handlePlayPause = () => {
    if (session.isPlaying) {
      pause(session.playbackPosition)
    } else {
      play(session.playbackPosition)
    }
  }

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      {/* Skip / Previous placeholder */}
      <button
        onClick={skip}
        className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        title="Skip track"
      >
        &#9197;
      </button>

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        disabled={!session.currentTrack}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl hover:opacity-90 disabled:opacity-40 transition"
        title={session.isPlaying ? 'Pause' : 'Play'}
      >
        {session.isPlaying ? '\u23F8' : '\u25B6'}
      </button>

      {/* Skip forward */}
      <button
        onClick={skip}
        disabled={session.queue.length === 0}
        className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition"
        title="Next track"
      >
        &#9199;
      </button>
    </div>
  )
}
