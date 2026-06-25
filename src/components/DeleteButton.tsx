import { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  onConfirm: () => void
  size?: number
}

export default function DeleteButton({ onConfirm, size = 16 }: Props) {
  const [confirming, setConfirming] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirming) {
      onConfirm()
      setConfirming(false)
    } else {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 5000)
    }
  }

  if (confirming) {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-2 rounded-xl bg-expense text-white text-xs font-semibold min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Delete?
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="p-3 text-text-muted active:text-expense min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <Trash2 size={size} />
    </button>
  )
}
