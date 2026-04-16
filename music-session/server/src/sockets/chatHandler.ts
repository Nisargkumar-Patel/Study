import { Server, Socket } from 'socket.io'
import { sessionManager } from '../services/sessionManager'
import { sanitizeText, filterProfanity } from '../utils/validation'
import { config } from '../config'
import { v4 as uuid } from 'uuid'

const messageTimes = new Map<string, number[]>()

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on('chat:message', ({ text }: { text: string }) => {
    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    const { session, participant } = result

    // Check if chat is enabled
    if (!session.chatEnabled) {
      socket.emit('error', { message: 'Chat is disabled' })
      return
    }

    // Check if user is muted
    if (participant.isMuted) {
      socket.emit('error', { message: 'You are muted' })
      return
    }

    // Rate limit
    const now = Date.now()
    const times = messageTimes.get(socket.id) || []
    const recent = times.filter((t) => now - t < config.chatRateLimit.window)

    if (recent.length >= config.chatRateLimit.max) {
      socket.emit('error', { message: 'Slow down! Too many messages' })
      return
    }

    recent.push(now)
    messageTimes.set(socket.id, recent)

    // Sanitize and filter
    const sanitized = sanitizeText(text.slice(0, 500)) // Max 500 chars
    const filtered = filterProfanity(sanitized)

    if (!filtered.trim()) return

    const message = {
      id: uuid(),
      userId: participant.id,
      displayName: participant.displayName,
      text: filtered,
      timestamp: new Date(),
    }

    io.to(session.id).emit('chat:newMessage', { message })
  })

  // Host: toggle chat
  socket.on('chat:toggle', ({ enabled }: { enabled: boolean }) => {
    if (!sessionManager.isHost(socket.id)) return

    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    result.session.chatEnabled = enabled
    io.to(result.session.id).emit('chat:toggled', { enabled })
  })

  // Host: mute user
  socket.on('chat:muteUser', ({ userId }: { userId: string }) => {
    if (!sessionManager.isHost(socket.id)) return

    const result = sessionManager.getParticipantBySocket(socket.id)
    if (!result) return

    const target = result.session.participants.get(userId)
    if (target) {
      target.isMuted = true
      io.to(target.socketId).emit('chat:muted', { reason: 'You have been muted by the host' })
    }
  })

  socket.on('disconnect', () => {
    messageTimes.delete(socket.id)
  })
}
