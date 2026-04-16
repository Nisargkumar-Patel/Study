import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { config } from '../config'
import { AudioProcessor } from '../services/audioProcessor'
import { sessionManager } from '../services/sessionManager'
import { isValidYoutubeUrl } from '../utils/validation'

const router = Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const sessionId = req.body?.sessionId || 'uploads'
    const dir = path.join(config.tempDir, sessionId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuid()}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (config.allowedAudioMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid audio file type'))
    }
  },
})

// Upload audio file
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const sessionId = req.body?.sessionId
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' })
    }

    // Get duration
    const duration = await AudioProcessor.getDuration(req.file.path)

    // Transcode to HLS
    const { playlistPath, outputDir } = await AudioProcessor.transcodeToHLS(req.file.path, sessionId)

    // Build relative paths for serving
    const relativePlaylist = path.relative(config.tempDir, playlistPath)

    const track = {
      id: uuid(),
      title: path.parse(req.file.originalname).name,
      artist: 'Uploaded',
      duration,
      source: 'upload' as const,
      filePath: req.file.path,
      hlsPlaylist: `/api/audio/stream/${relativePlaylist}`,
      addedBy: req.body?.userId || 'unknown',
    }

    res.json({ success: true, track })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Upload processing failed' })
  }
})

// Process YouTube URL
router.post('/youtube', async (req, res) => {
  try {
    const { url, sessionId, userId } = req.body

    if (!url || !isValidYoutubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' })
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' })
    }

    const { playlistPath, title, duration } = await AudioProcessor.processYoutubeUrl(url, sessionId)
    const relativePlaylist = path.relative(config.tempDir, playlistPath)

    const track = {
      id: uuid(),
      title,
      artist: 'YouTube',
      duration,
      source: 'youtube' as const,
      sourceUrl: url,
      hlsPlaylist: `/api/audio/stream/${relativePlaylist}`,
      addedBy: userId || 'unknown',
    }

    res.json({ success: true, track })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'YouTube processing failed' })
  }
})

// Serve HLS stream files
router.get('/stream/*', (req, res) => {
  const filePath = path.join(config.tempDir, req.params[0])

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(config.tempDir))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const ext = path.extname(resolved)
  const contentTypes: Record<string, string> = {
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/MP2T',
    '.mp3': 'audio/mpeg',
    '.aac': 'audio/aac',
  }

  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', ext === '.m3u8' ? 'no-cache' : 'max-age=3600')
  fs.createReadStream(resolved).pipe(res)
})

export default router
