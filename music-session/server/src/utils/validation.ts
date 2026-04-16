// Sanitize text input to prevent XSS
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

// Validate YouTube URL
export function isValidYoutubeUrl(url: string): boolean {
  const pattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}(&[a-zA-Z0-9_=&-]*)?$/
  return pattern.test(url)
}

// Validate SoundCloud URL
export function isValidSoundCloudUrl(url: string): boolean {
  const pattern = /^https?:\/\/(www\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/
  return pattern.test(url)
}

// Validate radio stream URL
export function isValidStreamUrl(url: string): boolean {
  const pattern = /^https?:\/\/.+\.(m3u|pls|mp3|aac|ogg)(\?.*)?$/i
  return pattern.test(url) || url.startsWith('http://') || url.startsWith('https://')
}

// Validate display name
export function isValidDisplayName(name: string): boolean {
  return name.length >= 1 && name.length <= 30 && /^[a-zA-Z0-9_ -]+$/.test(name)
}

// Validate session code
export function isValidSessionCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code)
}

// Simple profanity filter
const BLOCKED_WORDS = ['shit', 'fuck', 'ass', 'bitch', 'damn', 'crap', 'dick', 'piss']

export function filterProfanity(text: string): string {
  let filtered = text
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    filtered = filtered.replace(regex, '*'.repeat(word.length))
  }
  return filtered
}
