# Music Session

A real-time collaborative music listening app. Create a session, share the 6-character code, and listen together in sync with friends.

## Features

- **Session Codes** - Create sessions with unique 6-character codes. Share the code and anyone can join.
- **Synchronized Playback** - All listeners hear the same track at the same position. Host controls play/pause/skip/seek.
- **Audio Sources** - Upload audio files (MP3, WAV, FLAC, OGG, AAC) or paste YouTube URLs for automatic extraction.
- **HLS Streaming** - Audio is transcoded to HLS format via FFmpeg for efficient streaming to all participants.
- **Live Chat** - Built-in chat with rate limiting and profanity filtering.
- **Emoji Reactions** - Send floating emoji reactions visible to all listeners.
- **Queue Management** - Host can manage the track queue (add, remove, reorder).
- **Public Sessions** - Optionally make sessions discoverable by other users.

## Tech Stack

**Server:** Express.js, Socket.IO, FFmpeg, yt-dlp, TypeScript  
**Client:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, HLS.js  
**Deployment:** Docker + docker-compose

## Quick Start

### Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

### Manual Development

**Prerequisites:** Node.js 20+, FFmpeg, yt-dlp (optional, for YouTube)

**Server:**
```bash
cd server
npm install
npm run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

## How It Works

1. **Host creates a session** - enters display name, gets a 6-character code
2. **Listeners join** - enter the code and their display name
3. **Host adds tracks** - upload audio files or paste YouTube URLs
4. **Audio processing** - server transcodes to HLS segments via FFmpeg
5. **Synchronized playback** - Socket.IO broadcasts play/pause/seek events; HLS.js plays segments on each client
6. **Real-time interaction** - chat messages and emoji reactions flow through WebSocket

## Architecture

```
Client (React + HLS.js)
  ├── Socket.IO ──── Real-time events (playback sync, chat, reactions)
  └── HTTP ────────── File upload, YouTube processing, HLS segment serving

Server (Express + Socket.IO)
  ├── SessionManager ── Session lifecycle, participant tracking
  ├── AudioProcessor ── FFmpeg transcoding, yt-dlp extraction
  ├── Socket Handlers ── Event routing with rate limiting
  └── REST Routes ───── File upload, streaming, session info
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/session/:code` | Get session info |
| GET | `/api/session/` | List public sessions |
| POST | `/api/audio/upload` | Upload audio file |
| POST | `/api/audio/youtube` | Extract from YouTube URL |
| GET | `/api/audio/stream/*` | Serve HLS segments |

## Socket Events

**Client -> Server:**
- `session:create`, `session:join`, `session:leave`, `session:end`
- `playback:play`, `playback:pause`, `playback:seek`, `playback:skip`
- `queue:add`, `queue:remove`
- `chat:message`, `reaction:send`

**Server -> Client:**
- `session:created`, `session:joined`, `session:ended`
- `session:userJoined`, `session:userLeft`
- `playback:update`, `sync:state`
- `queue:updated`
- `chat:newMessage`, `reaction:received`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `VITE_SERVER_URL` | `http://localhost:4000` | Server URL for client |

## License

MIT
