# Shared Music Session App — Claude Code Prompt

> Copy everything below the line and paste it into a new Claude Code session.

---

Build a full-stack **Shared Music Session** web application. Push the final project to `git@github.com:Nisargkumar-Patel/Study.git` inside a folder called `music-session` on the main branch.

## Concept

A real-time collaborative music listening app where one person (the **Host**) creates a session, links their music source, and controls playback. Anyone with the **session code** joins and hears the same track in sync. Think "listening party in a browser."

---

## Core Functionality

### 1. Create a Session (Host)

- Host clicks **"Start Session"** and gets a unique 6-character alphanumeric code (e.g., `A3X9K2`).
- Host links a music source (see §9 — Music Sources below).
- Host has full playback controls: play, pause, skip, seek, volume, queue management.
- Host can set session as **public** (discoverable) or **private** (code only).
- Host can kick/ban users and toggle chat.

### 2. Join a Session (Listener)

- Listener enters the 6-character code on the landing page or clicks an invite link (`/session/A3X9K2`).
- Listener is prompted for a display name (no account required).
- Listener immediately hears the current track at the exact playback position.
- Listener has personal volume control only — no ability to change the shared playback.

### 3. Real-Time Sync

- All participants hear the same track at the same timestamp (±500 ms tolerance).
- When host plays, pauses, seeks, or skips — every listener mirrors the action within 500 ms.
- New joiners jump to the current playback position instantly.
- Use **WebSockets** for all real-time communication.
- Implement clock-drift compensation: server timestamps every sync event; clients adjust local playback to match.

### 4. Session Queue

- Host can add tracks to a queue.
- Queue is visible to all participants.
- Host can reorder, remove, or clear the queue.
- Optional: allow listeners to **suggest** tracks (host approves/rejects from a suggestion inbox).

### 5. Live Chat

- Real-time text chat sidebar inside the session.
- Messages show display name + timestamp.
- Host can mute individual users or disable chat entirely.
- Basic moderation: profanity filter (use a small word list, nothing heavy).
- Chat auto-scrolls, shows "X new messages" pill if scrolled up.

### 6. Session Info Panel

- Show: session code, host name, number of listeners, current track info (title, artist, album art), elapsed / total time, queue length.
- Listeners list with avatars (auto-generated from initials).

### 7. Reactions & Engagement

- Listeners can send quick emoji reactions (🔥 ❤️ 😂 👏 💀) that float on screen for 3 seconds.
- Show a live "vibe meter" (average reaction sentiment in last 60 seconds).

### 8. Session Lifecycle

- Session persists as long as the host tab is open.
- If the host disconnects for > 30 seconds, listeners see a "Host disconnected — waiting…" banner.
- If the host doesn't return in 5 minutes, session auto-closes and listeners are notified.
- Host can explicitly **end** the session (all listeners get a "Session ended" screen).

---

## 9. Music Sources (Free — No Paid API Keys)

**ALL functionality must work without any paid API keys or premium accounts.**

Use the following **free** sources:

| Source | How |
|--------|-----|
| **Direct Upload** | Host uploads MP3/FLAC/WAV/OGG files (up to 50 MB each). Server stores them temporarily (auto-delete when session ends). Stream to listeners via chunked HTTP. |
| **YouTube Audio** | Host pastes a YouTube URL. Backend extracts audio stream URL using `yt-dlp` (open source). Stream the audio to all participants. **Do not download the full file** — proxy the audio stream in real-time. |
| **SoundCloud (public tracks)** | Host pastes a SoundCloud URL. Use the SoundCloud oEmbed/widget API (no key required for public tracks) to get a playable stream. |
| **Radio Streams** | Host pastes an internet radio stream URL (Icecast/Shoutcast `.m3u`/`.pls`/direct stream). Proxy through the server so all listeners are in sync. |

Priority: Direct Upload and YouTube are **must-have**. SoundCloud and Radio are **nice-to-have**.

### Audio Streaming Architecture

```
Host selects track
        │
        ▼
┌───────────────────┐
│   Backend Server   │
│  (audio pipeline)  │
│                    │
│  yt-dlp / file     │
│  → FFmpeg transcode │
│  → HLS segments     │
│  → Serve via HTTP   │
└────────┬───────────┘
         │
    HLS playlist (.m3u8)
         │
    ┌────┴────┐
    ▼         ▼
 Listener   Listener
 (HLS.js)   (HLS.js)
```

- Transcode all sources to **HLS** (HTTP Live Streaming) with FFmpeg:
  - Codec: AAC 128 kbps
  - Segment duration: 2 seconds (for low latency)
  - Playlist type: EVENT (append-only while playing)
- Frontend uses **HLS.js** library to play the stream.
- Sync is handled by combining HLS playback position with WebSocket timestamp corrections.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js with Express + Socket.IO (WebSockets) |
| Audio Processing | FFmpeg (transcoding), yt-dlp (YouTube extraction) |
| Streaming | HLS (HTTP Live Streaming) via hls.js on the client |
| State Management | Zustand |
| Real-Time | Socket.IO |
| File Storage | Local temp directory (auto-cleanup) |
| Containerization | Docker + docker-compose |

---

## Project Structure

```
music-session/
├── server/
│   ├── src/
│   │   ├── index.ts                # Express + Socket.IO entry
│   │   ├── config.ts               # Environment and constants
│   │   ├── routes/
│   │   │   ├── session.ts          # REST: create/join/info
│   │   │   ├── audio.ts            # REST: upload, fetch stream
│   │   │   └── health.ts           # Health check
│   │   ├── sockets/
│   │   │   ├── sessionHandler.ts   # Socket events for session sync
│   │   │   └── chatHandler.ts      # Socket events for chat
│   │   ├── services/
│   │   │   ├── sessionManager.ts   # In-memory session state
│   │   │   ├── audioProcessor.ts   # FFmpeg + yt-dlp pipeline
│   │   │   ├── hlsManager.ts       # HLS segment management
│   │   │   └── syncEngine.ts       # Playback sync logic
│   │   ├── utils/
│   │   │   ├── codeGenerator.ts    # Unique session code
│   │   │   ├── validation.ts       # Input sanitization
│   │   │   └── cleanup.ts          # Temp file cleanup
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── landing/
│   │   │   │   ├── LandingPage.tsx
│   │   │   │   ├── CreateSession.tsx
│   │   │   │   └── JoinSession.tsx
│   │   │   ├── session/
│   │   │   │   ├── SessionPage.tsx
│   │   │   │   ├── NowPlaying.tsx
│   │   │   │   ├── PlaybackControls.tsx
│   │   │   │   ├── Queue.tsx
│   │   │   │   ├── ListenerList.tsx
│   │   │   │   └── SessionInfo.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   └── ChatMessage.tsx
│   │   │   ├── audio/
│   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   ├── AddTrack.tsx
│   │   │   │   └── SourceSelector.tsx
│   │   │   ├── reactions/
│   │   │   │   ├── ReactionBar.tsx
│   │   │   │   └── FloatingReaction.tsx
│   │   │   └── ui/
│   │   │       └── (shadcn components)
│   │   ├── stores/
│   │   │   ├── sessionStore.ts
│   │   │   ├── audioStore.ts
│   │   │   └── chatStore.ts
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   ├── useAudioSync.ts
│   │   │   └── useSession.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── socket.ts
│   │   │   └── time.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `session:create` | `{ hostName, isPublic }` | Host creates session |
| `session:join` | `{ code, displayName }` | Listener joins |
| `session:leave` | `{}` | Participant leaves |
| `session:end` | `{}` | Host ends session |
| `playback:play` | `{ position }` | Host plays |
| `playback:pause` | `{ position }` | Host pauses |
| `playback:seek` | `{ position }` | Host seeks |
| `playback:skip` | `{}` | Host skips to next |
| `queue:add` | `{ source, url/fileId }` | Host adds to queue |
| `queue:remove` | `{ trackId }` | Host removes from queue |
| `queue:reorder` | `{ trackId, newIndex }` | Host reorders |
| `chat:message` | `{ text }` | Send chat message |
| `reaction:send` | `{ emoji }` | Send emoji reaction |
| `suggest:track` | `{ source, url }` | Listener suggests track |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `{ code, sessionId }` | Confirm creation |
| `session:joined` | `{ session state snapshot }` | Full state on join |
| `session:ended` | `{ reason }` | Session closed |
| `session:userJoined` | `{ user }` | New listener |
| `session:userLeft` | `{ userId }` | Listener left |
| `sync:state` | `{ track, position, isPlaying, timestamp }` | Periodic sync (every 5s) |
| `playback:update` | `{ action, position, timestamp }` | Play/pause/seek |
| `queue:updated` | `{ queue[] }` | Queue changed |
| `chat:newMessage` | `{ message }` | New chat message |
| `reaction:received` | `{ emoji, userId }` | Emoji reaction |
| `suggest:new` | `{ suggestion }` | New track suggestion |

---

## UI/UX Requirements

### Theme & Layout
- Dark mode by default with light mode toggle.
- Responsive — works on desktop, tablet, and mobile.
- Landing page: minimal, centered, two large buttons (Create / Join).
- Session page: main area for now-playing + controls, collapsible right sidebar for chat, bottom bar for queue.

### Landing Page
- App name/logo at top.
- **"Start a Session"** button → opens host flow.
- **"Join a Session"** code input field + "Join" button.
- Optional: show public sessions list below.
- Smooth entrance animations.

### Session Page (Host View)
- **Top bar**: Session code (click to copy), listener count, end session button.
- **Center**: Large album art (or waveform visualizer), track title, artist, progress bar with seek.
- **Controls row**: Previous, Play/Pause, Next, Shuffle, Repeat, Volume slider.
- **Below controls**: "Add Track" button (opens modal with source selector: Upload / YouTube URL / SoundCloud URL).
- **Right sidebar**: Collapsible chat panel with reactions bar at bottom.
- **Bottom drawer**: Queue (draggable to reorder), listener list.

### Session Page (Listener View)
- Same layout minus host controls.
- Personal volume slider only.
- "Suggest a Track" button instead of "Add Track".
- Reactions bar always visible.

### Visual Polish
- Animated equalizer bars when music is playing.
- Smooth progress bar with buffering indicator.
- Album art background blur effect.
- Toast notifications: user joined, track changed, etc.
- Floating emoji reactions that drift upward and fade.
- Skeleton loaders for all async content.
- Copy-to-clipboard for session code with tooltip confirmation.

---

## Audio Player Requirements

- Use **HLS.js** for playback in browsers that don't natively support HLS.
- Fallback to native `<audio>` for Safari (native HLS support).
- Show buffering spinner when stream is loading.
- Visualize audio with a simple waveform or equalizer animation (use Web Audio API `AnalyserNode`).
- Gapless playback between queue tracks (preload next segment).

---

## Security & Validation

- **Session codes**: cryptographically random 6-char alphanumeric (no ambiguous chars: 0/O, 1/I/l).
- **Input sanitization**: all user inputs (display name, chat messages, URLs) sanitized against XSS.
- **File uploads**: validate MIME type + magic bytes (not just extension). Max 50 MB. Reject executables.
- **YouTube URLs**: validate against regex before passing to yt-dlp. Never pass raw user input to shell.
- **Rate limiting**: 
  - Chat: max 5 messages per 10 seconds per user.
  - Reactions: max 10 per 10 seconds per user.
  - Session creation: max 3 per IP per hour.
  - File upload: max 10 per session.
- **WebSocket auth**: on connection, validate session code + user token (issued on join). Reject unknown sockets.
- **Temp files**: auto-delete HLS segments and uploads when session ends. Run cleanup cron every 10 minutes for orphaned files.
- **No shell injection**: use `yt-dlp` and `ffmpeg` via their Node.js bindings or spawn with argument arrays (never string concatenation).
- **CORS**: restrict to known origins in production.
- **Helmet.js**: apply security headers.

---

## Important Constraints

- **ALL functionality must work without any paid API keys.** No Spotify API, no Apple Music, no paid services.
- YouTube extraction uses `yt-dlp` (open source, no API key).
- Include a `docker-compose.yml` so the entire app runs with `docker-compose up`.
- Include a `README.md` with setup instructions.
- The app must handle **at least 20 concurrent listeners** per session without degradation.
- Audio latency between host and listeners must be **under 3 seconds** (HLS segment duration helps here).
- Chat messages must deliver in **under 500 ms**.

---

## Docker Configuration

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  server:
    build: ./server
    ports:
      - "4000:4000"
    volumes:
      - temp-audio:/tmp/music-session
    environment:
      - NODE_ENV=production
      - PORT=4000
      - TEMP_DIR=/tmp/music-session
    restart: unless-stopped

  client:
    build: ./client
    ports:
      - "3000:80"
    depends_on:
      - server
    restart: unless-stopped

volumes:
  temp-audio:
```

### Server Dockerfile Requirements
- Base: `node:20-alpine`
- Install `ffmpeg` and `yt-dlp` in the image.
- Install `python3` (required by yt-dlp).

### Client Dockerfile Requirements
- Multi-stage: Node build → Nginx serve.
- Nginx proxies `/api` and `/socket.io` to server.

---

## Performance Requirements

- Server must handle 50 concurrent WebSocket connections per session.
- HLS segments served with proper cache headers.
- Audio transcoding must start streaming within 3 seconds of track selection.
- Memory: each session < 100 MB (segments are short-lived).
- Cleanup: all temp files removed within 60 seconds of session end.

---

## Git Instructions

- Clone `git@github.com:Nisargkumar-Patel/Study.git`
- Create all project files inside a `music-session/` folder
- Commit with clear messages
- Push to main branch
- Git config: `user.name "Nisargkumar-Patel"`
