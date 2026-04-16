import { create } from 'zustand'
import type { SessionState, Track, Participant, ChatMessage, Reaction } from '../types'
import { connectSocket, disconnectSocket } from '../utils/socket'

interface SessionStore {
  session: SessionState | null
  participantId: string | null
  isHost: boolean
  messages: ChatMessage[]
  reactions: Reaction[]
  error: string | null
  isConnecting: boolean

  createSession: (hostName: string, isPublic: boolean) => void
  joinSession: (code: string, displayName: string) => void
  leaveSession: () => void
  endSession: () => void

  play: (position: number) => void
  pause: (position: number) => void
  seek: (position: number) => void
  skip: () => void

  sendMessage: (text: string) => void
  sendReaction: (emoji: string) => void

  removeFromQueue: (trackId: string) => void
  addReaction: (reaction: Reaction) => void
  clearError: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  participantId: null,
  isHost: false,
  messages: [],
  reactions: [],
  error: null,
  isConnecting: false,

  createSession: (hostName, isPublic) => {
    set({ isConnecting: true, error: null })
    const socket = connectSocket()

    socket.emit('session:create', { hostName, isPublic })

    socket.on('session:created', ({ session, code }) => {
      set({ session, isHost: true, isConnecting: false })
      setupListeners(socket, set, get)
    })

    socket.on('error', ({ message }) => {
      set({ error: message, isConnecting: false })
    })
  },

  joinSession: (code, displayName) => {
    set({ isConnecting: true, error: null })
    const socket = connectSocket()

    socket.emit('session:join', { code, displayName })

    socket.on('session:joined', ({ session, participantId }) => {
      set({ session, participantId, isHost: false, isConnecting: false })
      setupListeners(socket, set, get)
    })

    socket.on('error', ({ message }) => {
      set({ error: message, isConnecting: false })
    })
  },

  leaveSession: () => {
    const socket = connectSocket()
    socket.emit('session:leave')
    disconnectSocket()
    set({ session: null, participantId: null, isHost: false, messages: [], reactions: [] })
  },

  endSession: () => {
    const socket = connectSocket()
    socket.emit('session:end')
    disconnectSocket()
    set({ session: null, participantId: null, isHost: false, messages: [], reactions: [] })
  },

  play: (position) => {
    connectSocket().emit('playback:play', { position })
  },

  pause: (position) => {
    connectSocket().emit('playback:pause', { position })
  },

  seek: (position) => {
    connectSocket().emit('playback:seek', { position })
  },

  skip: () => {
    connectSocket().emit('playback:skip')
  },

  sendMessage: (text) => {
    connectSocket().emit('chat:message', { text })
  },

  sendReaction: (emoji) => {
    connectSocket().emit('reaction:send', { emoji })
  },

  removeFromQueue: (trackId) => {
    connectSocket().emit('queue:remove', { trackId })
  },

  addReaction: (reaction) => {
    set((state) => ({
      reactions: [...state.reactions.slice(-50), reaction],
    }))
  },

  clearError: () => set({ error: null }),
}))

function setupListeners(socket: any, set: any, get: any) {
  socket.on('playback:update', ({ action, position, timestamp }: any) => {
    set((state: any) => ({
      session: state.session
        ? {
            ...state.session,
            isPlaying: action === 'play',
            playbackPosition: position,
            lastSyncTimestamp: timestamp,
          }
        : null,
    }))
  })

  socket.on('sync:state', ({ track, position, isPlaying, timestamp }: any) => {
    set((state: any) => ({
      session: state.session
        ? {
            ...state.session,
            currentTrack: track,
            playbackPosition: position,
            isPlaying,
            lastSyncTimestamp: timestamp,
          }
        : null,
    }))
  })

  socket.on('queue:updated', ({ queue }: any) => {
    set((state: any) => ({
      session: state.session ? { ...state.session, queue } : null,
    }))
  })

  socket.on('session:userJoined', (user: Participant) => {
    set((state: any) => ({
      session: state.session
        ? { ...state.session, participants: [...state.session.participants, user] }
        : null,
    }))
  })

  socket.on('session:userLeft', ({ userId }: any) => {
    set((state: any) => ({
      session: state.session
        ? {
            ...state.session,
            participants: state.session.participants.filter((p: any) => p.id !== userId),
          }
        : null,
    }))
  })

  socket.on('session:ended', () => {
    disconnectSocket()
    set({ session: null, participantId: null, isHost: false, error: 'Session has ended' })
  })

  socket.on('chat:newMessage', ({ message }: any) => {
    set((state: any) => ({
      messages: [...state.messages.slice(-200), message],
    }))
  })

  socket.on('reaction:received', ({ emoji, userId, displayName }: any) => {
    const reaction: Reaction = {
      id: Math.random().toString(36).slice(2),
      emoji,
      userId,
      displayName,
      timestamp: Date.now(),
    }
    get().addReaction(reaction)
  })

  socket.on('session:hostDisconnected', () => {
    set({ error: 'Host disconnected — waiting for reconnection...' })
  })
}
