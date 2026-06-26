import { useState, useCallback, useRef } from 'react'

interface UndoState {
  message: string
  onUndo: () => void
}

export function useUndoDelete() {
  const [toast, setToast] = useState<UndoState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleDelete = useCallback((
    message: string,
    doDelete: () => void | Promise<void>,
    duration = 5000,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    setToast({
      message,
      onUndo: () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setToast(null)
      },
    })

    timerRef.current = setTimeout(async () => {
      await doDelete()
      setToast(null)
    }, duration)
  }, [])

  const dismiss = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, scheduleDelete, dismiss }
}
