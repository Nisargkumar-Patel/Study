import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { config } from '../config'
import { v4 as uuid } from 'uuid'

export class AudioProcessor {
  /**
   * Transcode an uploaded audio file to HLS format
   */
  static async transcodeToHLS(inputPath: string, sessionId: string): Promise<{ playlistPath: string; outputDir: string }> {
    const outputDir = path.join(config.tempDir, sessionId, uuid())
    fs.mkdirSync(outputDir, { recursive: true })

    const playlistPath = path.join(outputDir, 'stream.m3u8')

    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-ar', '44100',
        '-f', 'hls',
        '-hls_time', String(config.hlsSegmentDuration),
        '-hls_list_size', '0',
        '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
        playlistPath,
      ]

      const ffmpeg = spawn('ffmpeg', args)

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve({ playlistPath, outputDir })
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`))
      })
    })
  }

  /**
   * Extract audio from YouTube URL using yt-dlp and transcode to HLS
   */
  static async processYoutubeUrl(url: string, sessionId: string): Promise<{ playlistPath: string; outputDir: string; title: string; duration: number }> {
    const outputDir = path.join(config.tempDir, sessionId, uuid())
    fs.mkdirSync(outputDir, { recursive: true })

    const audioPath = path.join(outputDir, 'audio.webm')

    // Step 1: Extract audio info and download
    const info = await AudioProcessor.getYoutubeInfo(url)

    await new Promise<void>((resolve, reject) => {
      const args = [
        '--no-playlist',
        '-x',
        '--audio-format', 'best',
        '-o', audioPath,
        '--no-check-certificates',
        url,
      ]

      const ytdlp = spawn('yt-dlp', args)

      ytdlp.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`yt-dlp exited with code ${code}`))
      })

      ytdlp.on('error', (err) => {
        reject(new Error(`yt-dlp error: ${err.message}`))
      })
    })

    // Find the actual downloaded file (yt-dlp may change extension)
    const files = fs.readdirSync(outputDir).filter((f) => f.startsWith('audio'))
    const downloadedFile = files[0] ? path.join(outputDir, files[0]) : audioPath

    // Step 2: Transcode to HLS
    const playlistPath = path.join(outputDir, 'stream.m3u8')

    await new Promise<void>((resolve, reject) => {
      const args = [
        '-i', downloadedFile,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-ar', '44100',
        '-f', 'hls',
        '-hls_time', String(config.hlsSegmentDuration),
        '-hls_list_size', '0',
        '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
        playlistPath,
      ]

      const ffmpeg = spawn('ffmpeg', args)

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg transcode exited with code ${code}`))
      })

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`))
      })
    })

    // Cleanup original download
    try { fs.unlinkSync(downloadedFile) } catch {}

    return {
      playlistPath,
      outputDir,
      title: info.title,
      duration: info.duration,
    }
  }

  /**
   * Get YouTube video info without downloading
   */
  static async getYoutubeInfo(url: string): Promise<{ title: string; duration: number }> {
    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '--print', '%(title)s',
        '--print', '%(duration)s',
        '--no-check-certificates',
        url,
      ]

      let output = ''
      const ytdlp = spawn('yt-dlp', args)

      ytdlp.stdout.on('data', (data) => {
        output += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code === 0) {
          const lines = output.trim().split('\n')
          resolve({
            title: lines[0] || 'Unknown',
            duration: parseInt(lines[1] || '0', 10),
          })
        } else {
          reject(new Error(`yt-dlp info failed with code ${code}`))
        }
      })

      ytdlp.on('error', (err) => {
        reject(new Error(`yt-dlp error: ${err.message}`))
      })
    })
  }

  /**
   * Get audio duration using ffprobe
   */
  static async getDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        filePath,
      ]

      let output = ''
      const probe = spawn('ffprobe', args)

      probe.stdout.on('data', (data) => {
        output += data.toString()
      })

      probe.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(output.trim()) || 0)
        } else {
          resolve(0)
        }
      })

      probe.on('error', () => resolve(0))
    })
  }
}
