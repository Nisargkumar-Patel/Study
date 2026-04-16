import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import type { Reaction } from '@/types'

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
  startTime: number
}

export function FloatingReactions() {
  const { reactions } = useSessionStore()
  const [floating, setFloating] = useState<FloatingEmoji[]>([])

  useEffect(() => {
    if (reactions.length === 0) return

    const latest = reactions[reactions.length - 1]

    const newEmoji: FloatingEmoji = {
      id: latest.id,
      emoji: latest.emoji,
      x: 10 + Math.random() * 80,
      startTime: Date.now(),
    }

    setFloating((prev) => [...prev.slice(-20), newEmoji])

    const timer = setTimeout(() => {
      setFloating((prev) => prev.filter((e) => e.id !== newEmoji.id))
    }, 3000)

    return () => clearTimeout(timer)
  }, [reactions.length])

  if (floating.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {floating.map((item) => (
        <div
          key={item.id}
          className="absolute text-3xl animate-float-up"
          style={{
            left: `${item.x}%`,
            bottom: '10%',
          }}
        >
          {item.emoji}
        </div>
      ))}

      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-60vh) scale(0.5);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
