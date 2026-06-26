import { useState, useCallback, useRef } from 'react'

interface UndoState {
  message: string
  onUndo: () => void
}

export function useUndoDelete() {
  const [toast, setToast] = useState<UndoState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The delete happens immediately (a page refresh can't cancel a pending
  // timer and silently un-delete the row). "Undo" reverses an already-
  // completed delete by re-creating the record, rather than cancelling it.
  const scheduleDelete = useCallback(async (
    message: string,
    doDelete: () => unknown,
    undo: () => unknown,
    duration = 5000,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await doDelete()

    setToast({
      message,
      onUndo: async () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setToast(null)
        await undo()
      },
    })

    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const dismiss = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, scheduleDelete, dismiss }
}
