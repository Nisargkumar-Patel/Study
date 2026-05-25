import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

export function ChatPanel() {
  const { messages, sendMessage, session, isHost, selfMuted, toggleChat } = useSessionStore()
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chatEnabled = session?.chatEnabled !== false
  const disabled = !chatEnabled || selfMuted
  const disabledReason = !chatEnabled ? 'Chat has been disabled by the host' : selfMuted ? 'You have been muted by the host' : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    sendMessage(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chat</h3>
        {isHost && (
          <button
            onClick={() => toggleChat(!chatEnabled)}
            className="text-xs px-2 py-1 rounded border hover:bg-accent"
          >
            {chatEnabled ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground/60 text-center mt-8">No messages yet</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">{msg.displayName}</span>
              <span className="text-xs text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
            </div>
            <p className="text-sm text-foreground/80 break-words">{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        {disabledReason && (
          <p className="text-xs text-muted-foreground text-center mb-2">{disabledReason}</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Chat unavailable' : 'Type a message...'}
            maxLength={500}
            disabled={disabled}
            className="flex-1 px-3 py-2 rounded-lg border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
