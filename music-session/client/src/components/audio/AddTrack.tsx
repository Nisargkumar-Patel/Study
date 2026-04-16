import { useState, useRef } from 'react'

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

interface AddTrackProps {
  onClose: () => void
}

export function AddTrack({ onClose }: AddTrackProps) {
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 50MB.')
      return
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
      setError('Unsupported file type. Use MP3, WAV, OGG, FLAC, or AAC.')
      return
    }

    setIsUploading(true)
    setError(null)
    setProgress('Uploading and processing...')

    try {
      const formData = new FormData()
      formData.append('audio', file)

      const res = await fetch(`${API_URL}/api/audio/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed (${res.status})`)
      }

      setProgress('Track added!')
      setTimeout(onClose, 1000)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleYoutube = async () => {
    if (!youtubeUrl.trim()) return

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/
    if (!ytRegex.test(youtubeUrl.trim())) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setIsUploading(true)
    setError(null)
    setProgress('Extracting audio from YouTube...')

    try {
      const res = await fetch(`${API_URL}/api/audio/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to process YouTube URL (${res.status})`)
      }

      setProgress('Track added!')
      setTimeout(onClose, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to process YouTube URL')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 rounded-xl border bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Add Track</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
      </div>

      {/* Mode selector */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          onClick={() => { setMode('upload'); setError(null) }}
          className={`flex-1 py-2 text-sm font-medium transition ${
            mode === 'upload' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => { setMode('youtube'); setError(null) }}
          className={`flex-1 py-2 text-sm font-medium transition ${
            mode === 'youtube' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          }`}
        >
          YouTube URL
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Progress */}
      {isUploading && progress && (
        <div className="text-sm text-primary text-center">{progress}</div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.aac,.m4a"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-8 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition text-center disabled:opacity-50"
          >
            <div className="text-3xl mb-2">&#128228;</div>
            <p className="text-sm text-muted-foreground">
              {isUploading ? 'Processing...' : 'Click to select audio file'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">MP3, WAV, OGG, FLAC, AAC (max 50MB)</p>
          </button>
        </div>
      )}

      {/* YouTube mode */}
      {mode === 'youtube' && (
        <div className="space-y-3">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-4 py-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
          />
          <button
            onClick={handleYoutube}
            disabled={!youtubeUrl.trim() || isUploading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-40 transition"
          >
            {isUploading ? 'Processing...' : 'Add from YouTube'}
          </button>
        </div>
      )}
    </div>
  )
}
