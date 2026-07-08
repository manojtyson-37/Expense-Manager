import { useNavigate } from 'react-router-dom'
import type { Transaction, Category, Account } from '../db'
import IconRenderer from './IconRenderer'
import DeleteButton from './DeleteButton'
import { useCurrency } from '../lib/CurrencyContext'
import { Camera } from 'lucide-react'

interface Props {
  transaction: Transaction
  categories?: Category[]
  accounts?: Account[]
  onDelete: (uid: string) => void
  hasReceipt?: boolean
}

export default function TransactionItem({ transaction, categories, accounts, onDelete, hasReceipt }: Props) {
  const navigate = useNavigate()
  const { format } = useCurrency()
  const cat = categories?.find(c => c.name === transaction.category)
  const acc = accounts?.find(a => a.name === transaction.account)

  return (
    <div
      onClick={() => navigate(`/edit/${transaction.uid}`)}
      className="flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 cursor-pointer"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: (cat?.color || '#10b981') + '20' }}
        aria-label={transaction.category}
      >
        <IconRenderer icon={cat?.icon || '📦'} size={20} color={cat?.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate flex items-center gap-1.5">
          {transaction.category}
          {hasReceipt && <Camera size={12} className="text-text-muted shrink-0" />}
        </div>
        <div className="text-xs text-text-muted truncate">
          {acc ? <><IconRenderer icon={acc.icon} size={12} className="inline-block align-middle mr-1" />{acc.name}</> : null}
          {acc && transaction.note ? ' · ' : ''}{transaction.note || (!acc ? '' : '')}
        </div>
      </div>
      <span className={`font-semibold text-sm shrink-0 ${transaction.type === 'income' ? 'text-income' : 'text-expense'}`}>
        {transaction.type === 'income' ? '+' : '-'}{format(transaction.amount)}
      </span>
      <DeleteButton onConfirm={() => onDelete(transaction.uid)} size={14} />
    </div>
  )
}
