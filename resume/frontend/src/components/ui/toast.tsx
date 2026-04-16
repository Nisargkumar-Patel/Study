import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'rounded-lg border p-4 shadow-lg animate-in slide-in-from-right',
        toast.variant === 'destructive'
          ? 'border-destructive bg-destructive text-destructive-foreground'
          : toast.variant === 'success'
          ? 'border-green-500 bg-green-500/10 text-foreground'
          : 'border bg-background text-foreground'
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description && <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">
          &times;
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
