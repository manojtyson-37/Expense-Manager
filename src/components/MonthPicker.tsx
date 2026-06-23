import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  month: string
  onChange: (month: string) => void
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function MonthPicker({ month, onChange }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="p-2 rounded-full text-text-muted active:bg-surface-light"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm">{formatMonth(month)}</span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="p-2 rounded-full text-text-muted active:bg-surface-light"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
