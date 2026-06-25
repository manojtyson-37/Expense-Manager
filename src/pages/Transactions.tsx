import { useState } from 'react'
import { useTransactions, deleteTransaction } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import MonthPicker from '../components/MonthPicker'
import TransactionItem from '../components/TransactionItem'
import { Download, Search, X } from 'lucide-react'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'

interface Props {
  month: string
  onMonthChange: (m: string) => void
}

function exportCSV(transactions: { type: string; amount: number; category: string; account: string; note: string; date: string }[]) {
  const header = 'Date,Type,Category,Account,Amount,Note'
  const rows = transactions.map(t => {
    const note = t.note.replace(/"/g, '""').replace(/\n/g, ' ')
    const cat = `"${t.category.replace(/"/g, '""')}"`
    const acc = `"${(t.account || '').replace(/"/g, '""')}"`
    return `${t.date},${t.type},${cat},${acc},${t.type === 'expense' ? '-' : ''}${t.amount.toFixed(2)},"${note}"`
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Transactions({ month, onMonthChange }: Props) {
  const { transactions } = useTransactions(month)
  const categories = useCategories()
  const accounts = useAccounts()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const list = (transactions || []).filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.category.toLowerCase().includes(q)
      || t.note.toLowerCase().includes(q)
      || t.account.toLowerCase().includes(q)
      || t.amount.toString().includes(q)
  })

  const grouped = new Map<string, typeof list>()
  for (const t of list) {
    const existing = grouped.get(t.date) || []
    existing.push(t)
    grouped.set(t.date, existing)
  }

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between px-4 pt-2">
        <h1 className="text-lg font-bold">Transactions</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-full text-text-muted active:bg-surface-light"
          >
            {showSearch ? <X size={20} /> : <Search size={20} />}
          </button>
          {list.length > 0 && (
            <button
              onClick={() => exportCSV(list)}
              className="p-2 rounded-full text-text-muted active:bg-surface-light"
            >
              <Download size={20} />
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="px-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by category, note, account, amount..."
            autoFocus
          />
        </div>
      )}

      <MonthPicker month={month} onChange={onMonthChange} />

      <div className="space-y-4 px-4">
        {list.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-sm">
            {search ? 'No matching transactions.' : 'No transactions this month.'}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date}>
              <div className="text-xs text-text-muted font-medium mb-1 px-1">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </div>
              <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
                {items.map(t => (
                  <TransactionItem key={t.id} transaction={t} categories={categories} accounts={accounts} onDelete={(id) => scheduleDelete('Transaction deleted', () => deleteTransaction(id))} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
