import { useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/

// Host-only panel listing pending track suggestions with approve/reject.
export function SuggestionPanel() {
  const { pendingSuggestions, approveSuggestion, rejectSuggestion } = useSessionStore()

  if (pendingSuggestions.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Suggestions ({pendingSuggestions.length})
      </h3>
      <div className="space-y-2">
        {pendingSuggestions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{s.track.sourceUrl}</p>
              <p className="text-xs text-muted-foreground">Suggested by {s.suggestedByName}</p>
            </div>
            <button
              onClick={() => approveSuggestion(s.id)}
              className="text-green-400 hover:text-green-300 text-lg"
              title="Approve"
            >
              &#10003;
            </button>
            <button
              onClick={() => rejectSuggestion(s.id)}
              className="text-red-400 hover:text-red-300 text-lg"
              title="Reject"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Listener-only control to suggest a YouTube track to the host.
export function SuggestTrackButton() {
  const { suggestTrack, suggestionNotice } = useSessionStore()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    if (!YT_REGEX.test(url.trim())) {
      setErr('Enter a valid YouTube URL')
      return
    }
    suggestTrack(url.trim())
    setUrl('')
    setErr(null)
    setOpen(false)
  }

  return (
    <div className="mt-4 text-center">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg border hover:bg-accent text-sm"
        >
          Suggest a track
        </button>
      ) : (
        <div className="max-w-md mx-auto p-4 rounded-xl border bg-card space-y-3 text-left">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Suggest a YouTube track</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              &times;
            </button>
          </div>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
          />
          <button
            onClick={submit}
            disabled={!url.trim()}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
          >
            Send suggestion
          </button>
        </div>
      )}
      {suggestionNotice && <p className="text-xs text-primary mt-2">{suggestionNotice}</p>}
    </div>
  )
}
