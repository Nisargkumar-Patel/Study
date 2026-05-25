import { create } from 'zustand'
import type { SessionState, Track, Participant, ChatMessage, Reaction, Suggestion } from '../types'
import { connectSocket, disconnectSocket } from '../utils/socket'

interface SessionStore {
  session: SessionState | null
  participantId: string | null
  isHost: boolean
  messages: ChatMessage[]
  reactions: Reaction[]
  pendingSuggestions: Suggestion[]
  suggestionNotice: string | null
  selfMuted: boolean
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

  addToQueue: (track: Track) => void
  removeFromQueue: (trackId: string) => void
  reorderQueue: (trackId: string, newIndex: number) => void

  suggestTrack: (url: string) => void
  approveSuggestion: (suggestionId: string) => void
  rejectSuggestion: (suggestionId: string) => void

  toggleChat: (enabled: boolean) => void
  muteUser: (userId: string) => void
  unmuteUser: (userId: string) => void

  addReaction: (reaction: Reaction) => void
  clearError: () => void
}

const initialTransient = {
  messages: [] as ChatMessage[],
  reactions: [] as Reaction[],
  pendingSuggestions: [] as Suggestion[],
  suggestionNotice: null as string | null,
  selfMuted: false,
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  participantId: null,
  isHost: false,
  ...initialTransient,
  error: null,
  isConnecting: false,

  createSession: (hostName, isPublic) => {
    set({ isConnecting: true, error: null })
    const socket = connectSocket()

    socket.emit('session:create', { hostName, isPublic })

    socket.on('session:created', ({ session }) => {
      set({
        session,
        isHost: true,
        isConnecting: false,
        pendingSuggestions: (session.suggestions || []).filter((s: Suggestion) => s.status === 'pending'),
      })
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
    set({ session: null, participantId: null, isHost: false, ...initialTransient })
  },

  endSession: () => {
    const socket = connectSocket()
    socket.emit('session:end')
    disconnectSocket()
    set({ session: null, participantId: null, isHost: false, ...initialTransient })
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

  addToQueue: (track) => {
    connectSocket().emit('queue:add', { track })
  },

  removeFromQueue: (trackId) => {
    connectSocket().emit('queue:remove', { trackId })
  },

  reorderQueue: (trackId, newIndex) => {
    connectSocket().emit('queue:reorder', { trackId, newIndex })
  },

  suggestTrack: (url) => {
    connectSocket().emit('suggest:track', { source: 'youtube', url })
    set({ suggestionNotice: 'Suggestion sent to the host' })
  },

  approveSuggestion: (suggestionId) => {
    connectSocket().emit('suggest:approve', { suggestionId })
  },

  rejectSuggestion: (suggestionId) => {
    connectSocket().emit('suggest:reject', { suggestionId })
  },

  toggleChat: (enabled) => {
    connectSocket().emit('chat:toggle', { enabled })
  },

  muteUser: (userId) => {
    connectSocket().emit('chat:muteUser', { userId })
  },

  unmuteUser: (userId) => {
    connectSocket().emit('chat:unmuteUser', { userId })
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
            // 'seek' keeps the current play/pause state; only play/pause change it
            isPlaying: action === 'seek' ? state.session.isPlaying : action === 'play',
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
    set({ session: null, participantId: null, isHost: false, ...initialTransient, error: 'Session has ended' })
  })

  socket.on('chat:newMessage', ({ message }: any) => {
    set((state: any) => ({
      messages: [...state.messages.slice(-200), message],
    }))
  })

  socket.on('chat:toggled', ({ enabled }: any) => {
    set((state: any) => ({
      session: state.session ? { ...state.session, chatEnabled: enabled } : null,
    }))
  })

  socket.on('chat:muted', () => set({ selfMuted: true }))
  socket.on('chat:unmuted', () => set({ selfMuted: false }))

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

  socket.on('suggest:new', ({ suggestion }: any) => {
    set((state: any) => ({ pendingSuggestions: [...state.pendingSuggestions, suggestion] }))
  })

  socket.on('suggest:resolved', ({ suggestionId }: any) => {
    set((state: any) => ({
      pendingSuggestions: state.pendingSuggestions.filter((s: Suggestion) => s.id !== suggestionId),
    }))
  })

  socket.on('session:hostDisconnected', () => {
    set({ error: 'Host disconnected — waiting for reconnection...' })
  })
}
