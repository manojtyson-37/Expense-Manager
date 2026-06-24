import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Undo2 } from 'lucide-react'
import type { Transaction, Category, Account } from '../db'

interface Props {
  transaction: Transaction
  categories?: Category[]
  accounts?: Account[]
  onDelete: (id: number) => void
}

export default function TransactionItem({ transaction, categories, accounts, onDelete }: Props) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cat = categories?.find(c => c.name === transaction.category)
  const acc = accounts?.find(a => a.name === transaction.account)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete(transaction.id!)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <div
      onClick={() => navigate(`/edit/${transaction.id}`)}
      className="flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 cursor-pointer"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: (cat?.color || '#10b981') + '20' }}
      >
        {cat?.icon || '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{transaction.category}</div>
        <div className="text-xs text-text-muted truncate">
          {acc ? `${acc.icon} ${acc.name}` : ''}{acc && transaction.note ? ' · ' : ''}{transaction.note || (!acc ? 'No note' : '')}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className={`font-semibold text-sm ${transaction.type === 'income' ? 'text-income' : 'text-expense'}`}>
          {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
        </span>
        {confirmDelete ? (
          <button
            onClick={handleDelete}
            className="px-2 py-1 rounded-lg bg-expense text-white text-[10px] font-medium"
          >
            Confirm
          </button>
        ) : (
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-full text-text-muted active:bg-surface-light"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
