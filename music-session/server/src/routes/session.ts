import { Router } from 'express'
import { sessionManager } from '../services/sessionManager'
import { isValidSessionCode } from '../utils/validation'

const router = Router()

// Get session info by code
router.get('/:code', (req, res) => {
  const code = req.params.code.toUpperCase()

  if (!isValidSessionCode(code)) {
    return res.status(400).json({ error: 'Invalid session code' })
  }

  const session = sessionManager.getSessionByCode(code)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.json({
    code: session.code,
    hostName: session.hostName,
    isPublic: session.isPublic,
    listenerCount: session.participants.size - 1,
    currentTrack: session.currentTrack
      ? { title: session.currentTrack.title, artist: session.currentTrack.artist }
      : null,
  })
})

// List public sessions
router.get('/', (_req, res) => {
  const sessions = sessionManager.getPublicSessions()
  res.json({ sessions })
})

export default router
