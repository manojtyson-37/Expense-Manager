import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTransactions, deleteTransaction, restoreTransaction, addTransaction } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import { db } from '../db'
import MonthPicker from '../components/MonthPicker'
import TransactionItem from '../components/TransactionItem'
import { Download, Upload, Search, X } from 'lucide-react'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'

interface Props {
  month: string
  onMonthChange: (m: string) => void
}

// A field starting with =, +, -, or @ is interpreted as a formula by
// Excel/Sheets when the CSV is opened — a note or category imported from
// someone else's file (or just typed by the user) could otherwise execute
// arbitrary formulas on export/reopen. Prefixing with a single quote forces
// spreadsheet apps to treat it as literal text.
function escapeCSVFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function exportCSV(transactions: { type: string; amount: number; category: string; account: string; note: string; date: string }[]) {
  const header = 'Date,Type,Category,Account,Amount,Note'
  const rows = transactions.map(t => {
    const note = escapeCSVFormula(t.note).replace(/"/g, '""').replace(/\n/g, ' ')
    const cat = `"${escapeCSVFormula(t.category).replace(/"/g, '""')}"`
    const acc = `"${escapeCSVFormula(t.account || '').replace(/"/g, '""')}"`
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

// Minimal CSV line parser — handles quoted fields with embedded commas and
// escaped "" quotes, since exportCSV above quotes category/account/note.
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cur += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(cur); cur = '' }
      else cur += ch
    }
  }
  fields.push(cur)
  return fields
}

interface ParsedCSVRow {
  type: 'income' | 'expense'
  amount: number
  category: string
  account: string
  note: string
  date: string
}

// Expects the same "Date,Type,Category,Account,Amount,Note" shape exportCSV
// produces — matching the export format is the whole point of round-tripping.
function parseCSV(text: string): { rows: ParsedCSVRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  const rows: ParsedCSVRow[] = []
  let skipped = 0
  const dataLines = lines[0]?.toLowerCase().startsWith('date,') ? lines.slice(1) : lines
  for (const line of dataLines) {
    const [date, type, category, account, amountStr, note] = parseCSVLine(line)
    const amount = Math.abs(parseFloat(amountStr))
    const validType = type === 'income' || type === 'expense'
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validType || !category || isNaN(amount) || amount <= 0) {
      skipped++
      continue
    }
    // Undo exportCSV's formula-injection guard so a round-tripped
    // export→import doesn't leave a literal leading quote in the text.
    const unescape = (v: string) => /^'[=+\-@]/.test(v) ? v.slice(1) : v
    rows.push({ date, type, category: unescape(category), account: unescape(account || ''), amount, note: unescape(note || '') })
  }
  return { rows, skipped }
}

async function handleImportCSV() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const { rows, skipped } = parseCSV(text)
    if (rows.length === 0) {
      alert(skipped > 0 ? `No valid rows found (${skipped} skipped — check date is YYYY-MM-DD and Type is income/expense).` : 'No rows found in file.')
      return
    }
    for (const r of rows) {
      await addTransaction({ type: r.type, amount: r.amount, category: r.category, account: r.account, note: r.note, date: r.date })
    }
    alert(`Imported ${rows.length} transaction${rows.length === 1 ? '' : 's'}${skipped > 0 ? `, skipped ${skipped} invalid row${skipped === 1 ? '' : 's'}` : ''}.`)
  }
  input.click()
}

export default function Transactions({ month, onMonthChange }: Props) {
  const { transactions } = useTransactions(month)
  const categories = useCategories()
  const accounts = useAccounts()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const { toast, scheduleDelete, dismiss } = useUndoDelete()
  const receiptUids = useLiveQuery(async () => new Set((await db.receipts.toArray()).map(r => r.transactionUid)))

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
          <button
            onClick={handleImportCSV}
            className="p-2 rounded-full text-text-muted active:bg-surface-light"
            title="Import CSV"
          >
            <Upload size={20} />
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
                  <TransactionItem key={t.id} transaction={t} categories={categories} accounts={accounts} hasReceipt={receiptUids?.has(t.uid)} onDelete={(id) => scheduleDelete('Transaction deleted', () => deleteTransaction(id), () => restoreTransaction(t))} />
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
