import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import { db } from '../db'
import { ArrowLeft } from 'lucide-react'

export default function AddTransaction() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const categories = useCategories(type)
  const accounts = useAccounts()

  useEffect(() => {
    if (isEdit) {
      db.transactions.get(Number(id)).then(t => {
        if (t) {
          setType(t.type)
          setAmount(String(t.amount))
          setCategory(t.category)
          setAccount(t.account || '')
          setNote(t.note)
          setDate(t.date)
        }
      })
    }
  }, [id, isEdit])

  useEffect(() => {
    if (categories && categories.length > 0 && !category) {
      setCategory(categories[0].name)
    }
  }, [categories, category])

  useEffect(() => {
    if (accounts && accounts.length > 0 && !account) {
      setAccount(accounts[0].name)
    }
  }, [accounts, account])

  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (!category) {
      setError('Select a category')
      return
    }

    if (isEdit) {
      await updateTransaction(Number(id), { type, amount: parsed, category, account, note, date })
    } else {
      await addTransaction({ type, amount: parsed, category, account, note, date })
    }
    navigate(-1)
  }

  return (
    <div className="flex-1">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{isEdit ? 'Edit' : 'Add'} Transaction</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Type Toggle */}
        <div className="flex bg-surface rounded-xl p-1 gap-1">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory('') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                type === t
                  ? t === 'expense' ? 'bg-expense text-white' : 'bg-income text-white'
                  : 'text-text-muted'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-text-muted block mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg">₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-2xl font-bold"
              style={{ paddingLeft: '2.5rem' }}
              autoFocus
              required
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-text-muted block mb-1">Category</label>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {categories?.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-xs transition-colors shrink-0 ${
                  category === c.name
                    ? 'bg-primary/20 border border-primary'
                    : 'bg-surface border border-transparent'
                }`}
              >
                <span className="text-lg">{c.icon}</span>
                <span className="whitespace-nowrap">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <label className="text-xs text-text-muted block mb-1">{type === 'income' ? 'Received in' : 'Paid from'}</label>
          {accounts && accounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAccount(acc.name)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    account === acc.name
                      ? 'bg-primary/20 border border-primary'
                      : 'bg-surface border border-transparent'
                  }`}
                >
                  <span>{acc.icon}</span>
                  <span>{acc.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No accounts added. Add from Settings → Accounts.</p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="text-xs text-text-muted block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-xs text-text-muted block mb-1">Note</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note..."
          />
        </div>

        {error && (
          <div className="text-expense text-xs bg-expense/10 border border-expense/20 rounded-xl px-3 py-2.5">{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-3.5 rounded-xl font-semibold text-white transition-colors min-h-[48px] ${
            type === 'expense' ? 'bg-expense active:bg-red-600' : 'bg-income active:bg-emerald-600'
          }`}
        >
          {isEdit ? 'Update' : 'Add'} {type === 'expense' ? 'Expense' : 'Income'}
        </button>
      </form>
    </div>
  )
}
