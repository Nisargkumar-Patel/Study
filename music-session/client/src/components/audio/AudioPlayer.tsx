import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import { useSessionStore } from '@/stores/sessionStore'
import type { SessionState } from '@/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

// Where playback *should* be right now: while playing, extrapolate from the
// last sync using elapsed wall-clock time so we don't snap back to a stale
// server position on every periodic sync.
function expectedPosition(s: SessionState): number {
  if (s.isPlaying) {
    return s.playbackPosition + (Date.now() - s.lastSyncTimestamp) / 1000
  }
  return s.playbackPosition
}

export function AudioPlayer() {
  const { session } = useSessionStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  // Load / switch the HLS source when the current track changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !session?.currentTrack?.hlsPlaylist) return

    const playlistUrl = `${SERVER_URL}${session.currentTrack.hlsPlaylist}`

    const seekToExpected = () => {
      const s = useSessionStore.getState().session
      if (!s) return
      audio.currentTime = expectedPosition(s)
      if (s.isPlaying) audio.play().catch(() => {})
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy()

      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hls.loadSource(playlistUrl)
      hls.attachMedia(audio)
      hls.on(Hls.Events.MANIFEST_PARSED, seekToExpected)

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              hls.destroy()
              break
          }
        }
      })

      hlsRef.current = hls
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = playlistUrl
      audio.addEventListener('loadedmetadata', seekToExpected, { once: true })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [session?.currentTrack?.id, session?.currentTrack?.hlsPlaylist])

  // Play / pause follows the shared state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (session?.isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [session?.isPlaying])

  // Correct drift on each sync update and on a periodic interval
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const correct = () => {
      const s = useSessionStore.getState().session
      if (!audioRef.current || !s?.currentTrack) return
      const expected = expectedPosition(s)
      if (Math.abs(audioRef.current.currentTime - expected) > 2) {
        audioRef.current.currentTime = expected
      }
    }

    correct()
    const interval = setInterval(correct, 3000)
    return () => clearInterval(interval)
  }, [session?.playbackPosition, session?.lastSyncTimestamp, session?.isPlaying])

  return <audio ref={audioRef} className="hidden" />
}
