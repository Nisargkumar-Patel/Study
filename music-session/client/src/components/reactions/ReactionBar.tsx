import { useSessionStore } from '@/stores/sessionStore'

const REACTIONS = ['🔥', '❤️', '😂', '👏', '💀', '🎵', '🙌', '😍']

export function ReactionBar() {
  const { sendReaction } = useSessionStore()

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => sendReaction(emoji)}
          className="w-10 h-10 rounded-full bg-card border hover:bg-accent hover:scale-110 active:scale-95 transition-all flex items-center justify-center text-lg"
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
