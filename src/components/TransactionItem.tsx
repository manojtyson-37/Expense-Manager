import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { Transaction } from '../db'
import { useCategories } from '../hooks/useCategories'

interface Props {
  transaction: Transaction
  onDelete: (id: number) => void
}

export default function TransactionItem({ transaction, onDelete }: Props) {
  const navigate = useNavigate()
  const categories = useCategories(transaction.type)
  const cat = categories?.find(c => c.name === transaction.category)

  return (
    <div
      onClick={() => navigate(`/edit/${transaction.id}`)}
      className="flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 cursor-pointer"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: (cat?.color || '#6366f1') + '20' }}
      >
        {cat?.icon || '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{transaction.category}</div>
        <div className="text-xs text-text-muted truncate">{transaction.note || 'No note'}</div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className={`font-semibold text-sm ${transaction.type === 'income' ? 'text-income' : 'text-expense'}`}>
          {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(transaction.id!) }}
          className="p-1.5 rounded-full text-text-muted active:bg-surface-light"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
