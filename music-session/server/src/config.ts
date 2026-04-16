import path from 'path'

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  tempDir: process.env.TEMP_DIR || path.join('/tmp', 'music-session'),
  maxFileSize: 50 * 1024 * 1024, // 50 MB
  maxFilesPerSession: 10,
  hlsSegmentDuration: 2,
  sessionTimeout: 5 * 60 * 1000, // 5 minutes
  hostDisconnectGrace: 30 * 1000, // 30 seconds
  syncInterval: 5000, // 5 seconds
  chatRateLimit: { max: 5, window: 10000 }, // 5 messages per 10s
  reactionRateLimit: { max: 10, window: 10000 }, // 10 per 10s
  sessionCreateRateLimit: { max: 3, window: 3600000 }, // 3 per hour
  cleanupInterval: 10 * 60 * 1000, // 10 minutes
  allowedAudioMimes: [
    'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/wav',
    'audio/ogg', 'audio/x-flac', 'audio/x-wav', 'audio/wave',
  ],
}
