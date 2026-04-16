import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import { useSessionStore } from '@/stores/sessionStore'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

export function AudioPlayer() {
  const { session } = useSessionStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !session?.currentTrack?.hlsPlaylist) return

    const playlistUrl = `${SERVER_URL}/api/audio/stream/${session.currentTrack.hlsPlaylist}`

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })

      hls.loadSource(playlistUrl)
      hls.attachMedia(audio)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (session.isPlaying) {
          audio.currentTime = session.playbackPosition
          audio.play().catch(() => {})
        }
      })

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
      if (session.isPlaying) {
        audio.currentTime = session.playbackPosition
        audio.play().catch(() => {})
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [session?.currentTrack?.id, session?.currentTrack?.hlsPlaylist])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (session?.isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [session?.isPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !session) return

    const diff = Math.abs(audio.currentTime - session.playbackPosition)
    if (diff > 2) {
      audio.currentTime = session.playbackPosition
    }
  }, [session?.playbackPosition])

  return <audio ref={audioRef} className="hidden" />
}
