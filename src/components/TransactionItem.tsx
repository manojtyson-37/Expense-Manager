import { useNavigate } from 'react-router-dom'
import type { Transaction, Category, Account } from '../db'
import DeleteButton from './DeleteButton'

interface Props {
  transaction: Transaction
  categories?: Category[]
  accounts?: Account[]
  onDelete: (id: number) => void
}

export default function TransactionItem({ transaction, categories, accounts, onDelete }: Props) {
  const navigate = useNavigate()
  const cat = categories?.find(c => c.name === transaction.category)
  const acc = accounts?.find(a => a.name === transaction.account)

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
        <DeleteButton onConfirm={() => onDelete(transaction.id!)} size={14} />
      </div>
    </div>
  )
}
