import fs from 'fs'
import path from 'path'
import { config } from '../config'

export function ensureTempDir(): void {
  if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir, { recursive: true })
  }
}

export function cleanupSessionFiles(sessionId: string): void {
  const sessionDir = path.join(config.tempDir, sessionId)
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true })
  }
}

export function cleanupOrphanedFiles(): void {
  if (!fs.existsSync(config.tempDir)) return

  const entries = fs.readdirSync(config.tempDir)
  const now = Date.now()

  for (const entry of entries) {
    const fullPath = path.join(config.tempDir, entry)
    try {
      const stats = fs.statSync(fullPath)
      // Remove anything older than 1 hour
      if (now - stats.mtimeMs > 3600000) {
        fs.rmSync(fullPath, { recursive: true, force: true })
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}
