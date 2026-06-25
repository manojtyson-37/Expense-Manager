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
    <div className="flex items-center justify-center gap-4 px-4 py-3">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="w-11 h-11 rounded-full flex items-center justify-center text-text-muted active:bg-surface-light transition-colors"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="font-semibold text-sm min-w-[140px] text-center">{formatMonth(month)}</span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="w-11 h-11 rounded-full flex items-center justify-center text-text-muted active:bg-surface-light transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
