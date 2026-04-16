export interface Track {
  id: string
  title: string
  artist: string
  duration: number
  source: 'upload' | 'youtube' | 'soundcloud' | 'radio'
  sourceUrl?: string
  hlsPlaylist?: string
  addedBy: string
}

export interface Participant {
  id: string
  displayName: string
  isHost: boolean
}

export interface ChatMessage {
  id: string
  userId: string
  displayName: string
  text: string
  timestamp: string
}

export interface SessionState {
  id: string
  code: string
  hostName: string
  isPublic: boolean
  chatEnabled: boolean
  currentTrack: Track | null
  isPlaying: boolean
  playbackPosition: number
  lastSyncTimestamp: number
  queue: Track[]
  participants: Participant[]
  suggestions: any[]
}

export interface Reaction {
  id: string
  emoji: string
  userId: string
  displayName: string
  timestamp: number
}
