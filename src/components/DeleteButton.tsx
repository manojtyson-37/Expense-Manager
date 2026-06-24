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
      setTimeout(() => setConfirming(false), 3000)
    }
  }

  if (confirming) {
    return (
      <button
        onClick={handleClick}
        className="px-2 py-1 rounded-lg bg-expense text-white text-[10px] font-medium"
      >
        Confirm
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 text-text-muted active:text-expense"
    >
      <Trash2 size={size} />
    </button>
  )
}
