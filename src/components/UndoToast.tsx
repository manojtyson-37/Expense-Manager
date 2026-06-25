import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'

interface Props {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: Props) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        const next = p - (100 / (duration / 50))
        if (next <= 0) { onDismiss(); return 0 }
        return next
      })
    }, 50)
    return () => clearInterval(interval)
  }, [duration, onDismiss])

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-[slideUp_0.2s_ease-out]">
      <div className="bg-surface-light border border-surface-lighter rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{message}</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold shrink-0 min-h-[44px]"
          >
            <Undo2 size={14} />
            Undo
          </button>
        </div>
        <div className="h-0.5 bg-surface rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
