import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
import { ensureTempDir, cleanupOrphanedFiles } from './utils/cleanup'
import sessionRoutes from './routes/session'
import audioRoutes from './routes/audio'
import healthRoutes from './routes/health'
import { registerSessionHandlers } from './sockets/sessionHandler'
import { registerChatHandlers } from './sockets/chatHandler'

// Initialize
ensureTempDir()

const app = express()
const server = http.createServer(app)

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // 1 MB max for socket messages
})

// Middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// REST Routes
app.use('/api/session', sessionRoutes)
app.use('/api/audio', audioRoutes)
app.use('/api/health', healthRoutes)

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'Music Session Server',
    version: '1.0.0',
    status: 'running',
  })
})

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`)

  registerSessionHandlers(io, socket)
  registerChatHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`)
  })
})

// Periodic cleanup of orphaned files
setInterval(cleanupOrphanedFiles, config.cleanupInterval)

// Start server
server.listen(config.port, () => {
  console.log(`Music Session Server running on port ${config.port}`)
  console.log(`Environment: ${config.nodeEnv}`)
})

export { app, server, io }
