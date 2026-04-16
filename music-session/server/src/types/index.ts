export interface Session {
  id: string
  code: string
  hostId: string
  hostName: string
  isPublic: boolean
  chatEnabled: boolean
  createdAt: Date
  currentTrack: Track | null
  isPlaying: boolean
  playbackPosition: number
  lastSyncTimestamp: number
  queue: Track[]
  participants: Map<string, Participant>
  suggestions: TrackSuggestion[]
}

export interface Participant {
  id: string
  socketId: string
  displayName: string
  isHost: boolean
  joinedAt: Date
  isMuted: boolean
}

export interface Track {
  id: string
  title: string
  artist: string
  duration: number
  source: 'upload' | 'youtube' | 'soundcloud' | 'radio'
  sourceUrl?: string
  filePath?: string
  hlsPlaylist?: string
  addedBy: string
}

export interface TrackSuggestion {
  id: string
  track: Partial<Track>
  suggestedBy: string
  suggestedByName: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface ChatMessage {
  id: string
  userId: string
  displayName: string
  text: string
  timestamp: Date
}

export interface SyncState {
  trackId: string | null
  position: number
  isPlaying: boolean
  timestamp: number
}
