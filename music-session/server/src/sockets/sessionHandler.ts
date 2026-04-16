import { Server, Socket } from 'socket.io'
import { sessionManager } from '../services/sessionManager'
import { sanitizeText, isValidDisplayName, isValidSessionCode } from '../utils/validation'
import { config } from '../config'

export function registerSessionHandlers(io: Server, socket: Socket) {
  // Create session
  socket.on('session:create', ({ hostName, isPublic }: { hostName: string; isPublic: boolean }) => {
    const name = sanitizeText(hostName)
    if (!isValidDisplayName(name)) {
      socket.emit('error', { message: 'Invalid display name' })
      return
    }

    const session = sessionManager.createSession(socket.id, name, isPublic)

    // Join socket room
    socket.join(session.id)

    socket.emit('session:created', {
      code: session.code,
      sessionId: session.id,
      session: sessionManager.serializeSession(session),
    })
  })

  // Join session
  socket.on('session:join', ({ code, displayName }: { code: string; displayName: string }) => {
    const sanitizedCode = code.toUpperCase().trim()
    const name = sanitizeText(displayName)

    if (!isValidSessionCode(sanitizedCode)) {
      socket.emit('error', { message: 'Invalid session code' })
      return
    }

    if (!isValidDisplayName(name)) {
      socket.emit('error', { message: 'Invalid display name' })
      return
    }

    const result = sessionManager.joinSession(sanitizedCode, socket.id, name)
    if (!result) {
      socket.emit('error', { message: 'Session not found' })
      return
    }

    const { session, participant } = result

    // Join socket room
    socket.join(session.id)

    // Send full state to joiner
    socket.emit('session:joined', {
      session: sessionManager.serializeSession(session),
      participantId: participant.id,
    })

    // Notify others
    socket.to(session.id).emit('session:userJoined', {
      id: participant.id,
      displayName: participant.displayName,
      isHost: false,
    })
  })

  // Leave session
  socket.on('session:leave', () => {
    handleDisconnect(io, socket)
  })

  // End session (host only)
  socket.on('session:end', () => {
    if (!sessionManager.isHost(socket.id)) return

    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    io.to(result.session.id).emit('session:ended', { reason: 'Host ended the session' })
    sessionManager.endSession(result.session.id)
  })

  // Playback controls (host only)
  socket.on('playback:play', ({ position }: { position: number }) => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    sessionManager.updatePlayback(result.session.id, true, position)

    io.to(result.session.id).emit('playback:update', {
      action: 'play',
      position,
      timestamp: Date.now(),
    })
  })

  socket.on('playback:pause', ({ position }: { position: number }) => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    sessionManager.updatePlayback(result.session.id, false, position)

    io.to(result.session.id).emit('playback:update', {
      action: 'pause',
      position,
      timestamp: Date.now(),
    })
  })

  socket.on('playback:seek', ({ position }: { position: number }) => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    sessionManager.updatePlayback(result.session.id, result.session.isPlaying, position)

    io.to(result.session.id).emit('playback:update', {
      action: 'seek',
      position,
      timestamp: Date.now(),
    })
  })

  socket.on('playback:skip', () => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    const nextTrack = sessionManager.skipTrack(result.session.id)

    io.to(result.session.id).emit('queue:updated', { queue: result.session.queue })
    io.to(result.session.id).emit('sync:state', {
      track: nextTrack,
      position: 0,
      isPlaying: false,
      timestamp: Date.now(),
    })
  })

  // Queue management
  socket.on('queue:remove', ({ trackId }: { trackId: string }) => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    sessionManager.removeFromQueue(result.session.id, trackId)
    io.to(result.session.id).emit('queue:updated', { queue: result.session.queue })
  })

  socket.on('queue:reorder', ({ trackId, newIndex }: { trackId: string; newIndex: number }) => {
    if (!sessionManager.isHost(socket.id)) return
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    sessionManager.reorderQueue(result.session.id, trackId, newIndex)
    io.to(result.session.id).emit('queue:updated', { queue: result.session.queue })
  })

  // Track suggestions (listeners)
  socket.on('suggest:track', ({ source, url }: { source: string; url: string }) => {
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    const suggestion = {
      id: Math.random().toString(36).slice(2),
      track: { source, sourceUrl: url },
      suggestedBy: result.participant.id,
      suggestedByName: result.participant.displayName,
      status: 'pending' as const,
    }

    result.session.suggestions.push(suggestion)

    // Notify host
    const hostParticipant = Array.from(result.session.participants.values()).find((p) => p.isHost)
    if (hostParticipant) {
      io.to(hostParticipant.socketId).emit('suggest:new', { suggestion })
    }
  })

  // Emoji reactions
  const reactionTimes: Map<string, number[]> = new Map()

  socket.on('reaction:send', ({ emoji }: { emoji: string }) => {
    const allowed = ['🔥', '❤️', '😂', '👏', '💀']
    if (!allowed.includes(emoji)) return

    // Rate limit
    const now = Date.now()
    const times = reactionTimes.get(socket.id) || []
    const recent = times.filter((t) => now - t < config.reactionRateLimit.window)
    if (recent.length >= config.reactionRateLimit.max) return

    recent.push(now)
    reactionTimes.set(socket.id, recent)

    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    io.to(result.session.id).emit('reaction:received', {
      emoji,
      userId: result.participant.id,
      displayName: result.participant.displayName,
    })
  })

  // Periodic sync
  const syncInterval = setInterval(() => {
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    socket.emit('sync:state', {
      track: result.session.currentTrack,
      position: result.session.playbackPosition,
      isPlaying: result.session.isPlaying,
      timestamp: result.session.lastSyncTimestamp,
    })
  }, config.syncInterval)

  // Handle disconnect
  socket.on('disconnect', () => {
    clearInterval(syncInterval)
    handleDisconnect(io, socket)
  })
}

function handleDisconnect(io: Server, socket: Socket) {
  const result = sessionManager.leaveSession(socket.id)
  if (!result) return

  const { session, participant, wasHost } = result

  socket.leave(session.id)

  if (wasHost) {
    // Start disconnect timer
    io.to(session.id).emit('session:hostDisconnected', {
      gracePeriod: config.sessionTimeout,
    })

    sessionManager.startHostDisconnectTimer(session.id, () => {
      io.to(session.id).emit('session:ended', { reason: 'Host did not return' })
      sessionManager.endSession(session.id)
    })
  } else {
    io.to(session.id).emit('session:userLeft', {
      userId: participant.id,
      displayName: participant.displayName,
    })
  }
}
