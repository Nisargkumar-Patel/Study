import { Session, Participant, Track, TrackSuggestion, ChatMessage } from '../types'
import { generateSessionCode } from '../utils/codeGenerator'
import { cleanupSessionFiles } from '../utils/cleanup'
import { v4 as uuid } from 'uuid'
import { config } from '../config'

class SessionManager {
  private sessions = new Map<string, Session>()
  private codeToSessionId = new Map<string, string>()
  private socketToSession = new Map<string, string>()
  private hostDisconnectTimers = new Map<string, NodeJS.Timeout>()

  createSession(hostSocketId: string, hostName: string, isPublic: boolean): Session {
    const sessionId = uuid()
    let code = generateSessionCode()

    // Ensure unique code
    while (this.codeToSessionId.has(code)) {
      code = generateSessionCode()
    }

    const host: Participant = {
      id: uuid(),
      socketId: hostSocketId,
      displayName: hostName,
      isHost: true,
      joinedAt: new Date(),
      isMuted: false,
    }

    const session: Session = {
      id: sessionId,
      code,
      hostId: host.id,
      hostName,
      isPublic,
      chatEnabled: true,
      createdAt: new Date(),
      currentTrack: null,
      isPlaying: false,
      playbackPosition: 0,
      lastSyncTimestamp: Date.now(),
      queue: [],
      participants: new Map([[host.id, host]]),
      suggestions: [],
    }

    this.sessions.set(sessionId, session)
    this.codeToSessionId.set(code, sessionId)
    this.socketToSession.set(hostSocketId, sessionId)

    return session
  }

  joinSession(code: string, socketId: string, displayName: string): { session: Session; participant: Participant } | null {
    const sessionId = this.codeToSessionId.get(code)
    if (!sessionId) return null

    const session = this.sessions.get(sessionId)
    if (!session) return null

    const participant: Participant = {
      id: uuid(),
      socketId,
      displayName,
      isHost: false,
      joinedAt: new Date(),
      isMuted: false,
    }

    session.participants.set(participant.id, participant)
    this.socketToSession.set(socketId, sessionId)

    return { session, participant }
  }

  leaveSession(socketId: string): { session: Session; participant: Participant; wasHost: boolean } | null {
    const sessionId = this.socketToSession.get(socketId)
    if (!sessionId) return null

    const session = this.sessions.get(sessionId)
    if (!session) return null

    let leavingParticipant: Participant | null = null
    for (const [id, p] of session.participants) {
      if (p.socketId === socketId) {
        leavingParticipant = p
        session.participants.delete(id)
        break
      }
    }

    this.socketToSession.delete(socketId)

    if (!leavingParticipant) return null

    const wasHost = leavingParticipant.isHost

    // If host left and no participants remain, end session
    if (wasHost && session.participants.size === 0) {
      this.endSession(session.id)
    }

    return { session, participant: leavingParticipant, wasHost }
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // Cleanup timers
    const timer = this.hostDisconnectTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.hostDisconnectTimers.delete(sessionId)
    }

    // Cleanup socket mappings
    for (const [, p] of session.participants) {
      this.socketToSession.delete(p.socketId)
    }

    // Cleanup code mapping
    this.codeToSessionId.delete(session.code)

    // Cleanup temp files
    cleanupSessionFiles(sessionId)

    // Remove session
    this.sessions.delete(sessionId)
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionByCode(code: string): Session | undefined {
    const sessionId = this.codeToSessionId.get(code)
    return sessionId ? this.sessions.get(sessionId) : undefined
  }

  getSessionBySocket(socketId: string): Session | undefined {
    const sessionId = this.socketToSession.get(socketId)
    return sessionId ? this.sessions.get(sessionId) : undefined
  }

  getParticipantBySocket(socketId: string): { session: Session; participant: Participant } | null {
    const session = this.getSessionBySocket(socketId)
    if (!session) return null

    for (const [, p] of session.participants) {
      if (p.socketId === socketId) {
        return { session, participant: p }
      }
    }
    return null
  }

  isHost(socketId: string): boolean {
    const result = this.getParticipantBySocket(socketId)
    return result?.participant.isHost ?? false
  }

  // Playback controls
  updatePlayback(sessionId: string, isPlaying: boolean, position: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.isPlaying = isPlaying
    session.playbackPosition = position
    session.lastSyncTimestamp = Date.now()
  }

  // Queue management
  addToQueue(sessionId: string, track: Track): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.queue.push(track)
    if (!session.currentTrack) {
      session.currentTrack = session.queue.shift() || null
    }
  }

  skipTrack(sessionId: string): Track | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    session.currentTrack = session.queue.shift() || null
    session.playbackPosition = 0
    session.lastSyncTimestamp = Date.now()
    return session.currentTrack
  }

  removeFromQueue(sessionId: string, trackId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.queue = session.queue.filter((t) => t.id !== trackId)
  }

  reorderQueue(sessionId: string, trackId: string, newIndex: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const idx = session.queue.findIndex((t) => t.id === trackId)
    if (idx === -1) return
    const [track] = session.queue.splice(idx, 1)
    session.queue.splice(newIndex, 0, track)
  }

  // Host disconnect handling
  startHostDisconnectTimer(sessionId: string, onTimeout: () => void): void {
    this.hostDisconnectTimers.set(
      sessionId,
      setTimeout(() => {
        this.hostDisconnectTimers.delete(sessionId)
        onTimeout()
      }, config.sessionTimeout)
    )
  }

  cancelHostDisconnectTimer(sessionId: string): void {
    const timer = this.hostDisconnectTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.hostDisconnectTimers.delete(sessionId)
    }
  }

  // Public sessions
  getPublicSessions(): Array<{ code: string; hostName: string; listenerCount: number; currentTrack: string | null }> {
    const publicSessions: Array<{ code: string; hostName: string; listenerCount: number; currentTrack: string | null }> = []
    for (const [, session] of this.sessions) {
      if (session.isPublic) {
        publicSessions.push({
          code: session.code,
          hostName: session.hostName,
          listenerCount: session.participants.size - 1,
          currentTrack: session.currentTrack?.title || null,
        })
      }
    }
    return publicSessions
  }

  // Serialize session state for sending to clients
  serializeSession(session: Session) {
    return {
      id: session.id,
      code: session.code,
      hostName: session.hostName,
      isPublic: session.isPublic,
      chatEnabled: session.chatEnabled,
      currentTrack: session.currentTrack,
      isPlaying: session.isPlaying,
      playbackPosition: session.playbackPosition,
      lastSyncTimestamp: session.lastSyncTimestamp,
      queue: session.queue,
      participants: Array.from(session.participants.values()).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isHost: p.isHost,
      })),
      suggestions: session.suggestions,
    }
  }
}

export const sessionManager = new SessionManager()
