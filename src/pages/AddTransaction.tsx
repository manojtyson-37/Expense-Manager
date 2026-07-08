import IconRenderer from '../components/IconRenderer'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import { db } from '../db'
import { ArrowLeft } from 'lucide-react'
import { useCurrency } from '../lib/CurrencyContext'
import { useAuth } from '../lib/AuthContext'
import { matchRule } from '../lib/categoryRules'
import { useReceipt, setReceipt, deleteReceipt } from '../hooks/useReceipts'
import { Camera, Trash2 } from 'lucide-react'

export default function AddTransaction() {
  const navigate = useNavigate()
  const { uid } = useParams()
  const isEdit = !!uid

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const categories = useCategories(type)
  const accounts = useAccounts()
  const { symbol, format } = useCurrency()
  const { user } = useAuth()
  const [anomalyAvg, setAnomalyAvg] = useState<number | null>(null)
  const [autoCategorized, setAutoCategorized] = useState<string | null>(null)

  function applyRuleMatch() {
    if (isEdit || !user) return // don't second-guess a category the user already chose while editing
    const matched = matchRule(user.id, note)
    if (matched && categories?.some(c => c.name === matched)) {
      setCategory(matched)
      // Rule match silently overwrites a manual pick otherwise — flag it so
      // it's not invisible when it disagrees with what the user chose.
      setAutoCategorized(matched)
      setTimeout(() => setAutoCategorized(null), 4000)
    }
  }

  // Flags an unusually large expense against this category's own recent
  // history — not a hard limit, just a "are you sure?" nudge. Needs at least
  // 3 prior expenses in the category to avoid flagging a brand-new category's
  // first entry (there's no baseline yet, so nothing to compare against).
  useEffect(() => {
    if (type !== 'expense' || !category) { setAnomalyAvg(null); return }
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    // Local date, not toISOString() — this codebase has a documented past
    // incident from UTC-vs-local date bugs (see App.tsx's localToday()).
    const cutoffStr = [cutoff.getFullYear(), String(cutoff.getMonth() + 1).padStart(2, '0'), String(cutoff.getDate()).padStart(2, '0')].join('-')
    db.transactions
      .where('date').aboveOrEqual(cutoffStr)
      .and(t => t.type === 'expense' && t.category === category)
      .toArray()
      .then(rows => {
        if (rows.length < 3) { setAnomalyAvg(null); return }
        setAnomalyAvg(rows.reduce((s, t) => s + t.amount, 0) / rows.length)
      })
  }, [type, category])

  const parsedAmount = parseFloat(amount)
  const isAnomaly = !isNaN(parsedAmount) && anomalyAvg !== null && parsedAmount > anomalyAvg * 2

  const receipt = useReceipt(isEdit ? uid : undefined)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!receipt) { setReceiptUrl(null); return }
    const url = URL.createObjectURL(receipt.blob)
    setReceiptUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt])

  async function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    await setReceipt(uid, file)
    e.target.value = ''
  }

  async function handleReceiptRemove() {
    if (!uid) return
    await deleteReceipt(uid)
  }

  useEffect(() => {
    if (isEdit) {
      db.transactions.where('uid').equals(uid!).first().then(t => {
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
  }, [uid, isEdit])

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
      await updateTransaction(uid!, { type, amount: parsed, category, account, note, date })
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
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg">{symbol}</span>
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
            />
          </div>
          {isAnomaly && (
            <p className="text-xs text-amber-500 mt-1.5">
              ⚠️ That's over 2× your usual {category} spend (avg {format(anomalyAvg!)}) — just flagging, not blocking.
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-text-muted block mb-1">
            Category
            {autoCategorized && (
              <span className="text-primary font-medium ml-1.5">— auto-set to {autoCategorized} by rule</span>
            )}
          </label>
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
                <IconRenderer icon={c.icon} size={20} />
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
                  <IconRenderer icon={acc.icon} size={14} />
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

        {/* Note / Merchant */}
        <div>
          <label className="text-xs text-text-muted block mb-1">Note / Merchant</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={applyRuleMatch}
            placeholder="e.g. Swiggy, Amazon, Rent"
          />
        </div>

        {/* Receipt — edit mode only, needs a stable uid that only exists once saved */}
        {isEdit && (
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Receipt <span className="text-text-muted/70">(this device only, not synced)</span>
            </label>
            {receiptUrl ? (
              <div className="relative inline-block">
                <img src={receiptUrl} alt="Receipt" className="w-24 h-24 object-cover rounded-xl border border-surface-light" />
                <button
                  type="button"
                  onClick={handleReceiptRemove}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-expense text-white rounded-full flex items-center justify-center"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 w-fit px-4 py-2.5 bg-surface rounded-xl text-sm text-text-muted cursor-pointer">
                <Camera size={16} />
                Attach photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptSelect} />
              </label>
            )}
          </div>
        )}

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
