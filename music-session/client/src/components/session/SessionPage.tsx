import { useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { NowPlaying } from './NowPlaying'
import { PlaybackControls } from './PlaybackControls'
import { Queue } from './Queue'
import { SessionInfo } from './SessionInfo'
import { ChatPanel } from '../chat/ChatPanel'
import { ReactionBar } from '../reactions/ReactionBar'
import { FloatingReactions } from '../reactions/FloatingReaction'
import { AddTrack } from '../audio/AddTrack'

export function SessionPage() {
  const { session, isHost, leaveSession, endSession } = useSessionStore()
  const [showChat, setShowChat] = useState(true)
  const [showAddTrack, setShowAddTrack] = useState(false)

  if (!session) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">&#127925;</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary tracking-wider">{session.code}</span>
              <button
                onClick={() => navigator.clipboard.writeText(session.code)}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Copy code"
              >
                &#128203;
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{session.participants.length} listening</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowChat(!showChat)} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-accent">
            {showChat ? 'Hide Chat' : 'Chat'}
          </button>
          {isHost ? (
            <button onClick={endSession} className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">
              End Session
            </button>
          ) : (
            <button onClick={leaveSession} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-accent">
              Leave
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center content */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Floating reactions overlay */}
          <FloatingReactions />

          {/* Now playing */}
          <NowPlaying />

          {/* Controls */}
          {isHost && <PlaybackControls />}

          {/* Add track */}
          {isHost && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
              >
                + Add Track
              </button>
            </div>
          )}

          {showAddTrack && isHost && (
            <div className="mt-4">
              <AddTrack onClose={() => setShowAddTrack(false)} />
            </div>
          )}

          {/* Queue */}
          <div className="mt-6">
            <Queue />
          </div>

          {/* Session Info */}
          <div className="mt-6">
            <SessionInfo />
          </div>

          {/* Reactions */}
          <div className="mt-4">
            <ReactionBar />
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l flex flex-col">
            <ChatPanel />
          </div>
        )}
      </div>
    </div>
  )
}
