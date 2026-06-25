import { useState, useCallback, useRef } from 'react'

interface UndoState {
  message: string
  onUndo: () => void
}

export function useUndoDelete() {
  const [toast, setToast] = useState<UndoState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

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
      setToast(null)
      await doDelete()
    }, duration)
  }, [])

  const dismiss = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, scheduleDelete, dismiss }
}
