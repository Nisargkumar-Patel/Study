import { useSessionStore } from '@/stores/sessionStore'
import { LandingPage } from '@/components/landing/LandingPage'
import { SessionPage } from '@/components/session/SessionPage'
import { AudioPlayer } from '@/components/audio/AudioPlayer'

export default function App() {
  const { session } = useSessionStore()

  return (
    <>
      {session ? <SessionPage /> : <LandingPage />}
      <AudioPlayer />
    </>
  )
}
