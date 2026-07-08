import IconRenderer from '../components/IconRenderer'
import { useState } from 'react'
import { useCategories } from '../hooks/useCategories'
import { useBudgets, setBudget, deleteBudget, copyBudgetsFromMonth } from '../hooks/useBudgets'
import { useTransactions } from '../hooks/useTransactions'
import { ArrowLeft, Copy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { useCurrency } from '../lib/CurrencyContext'

interface Props {
  month: string
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Budgets({ month }: Props) {
  const navigate = useNavigate()
  const categories = useCategories('expense')
  const budgets = useBudgets(month)
  const { categoryTotals } = useTransactions(month)
  const lastMonth = prevMonth(month)
  const prevBudgets = useBudgets(lastMonth)
  const { categoryTotals: prevCategoryTotals } = useTransactions(lastMonth)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [limitVal, setLimitVal] = useState('')
  const [rolloverVal, setRolloverVal] = useState(false)
  const [limitError, setLimitError] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const { toast, scheduleDelete, dismiss } = useUndoDelete()
  const { symbol, format } = useCurrency()

  const expenseTotals = new Map(
    (categoryTotals || []).filter(c => c.type === 'expense').map(c => [c.category, c.total])
  )
  const prevExpenseTotals = new Map(
    (prevCategoryTotals || []).filter(c => c.type === 'expense').map(c => [c.category, c.total])
  )
  const budgetMap = new Map(
    (budgets || []).map(b => [b.category, b])
  )
  const prevBudgetMap = new Map(
    (prevBudgets || []).map(b => [b.category, b])
  )

  function formatMonth(m: string): string {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  async function handleSave(category: string) {
    const val = parseFloat(limitVal)
    if (isNaN(val) || val <= 0) {
      setLimitError(true)
      return
    }
    await setBudget(category, val, month, rolloverVal)
    setEditingCat(null)
    setLimitVal('')
    setRolloverVal(false)
    setLimitError(false)
  }

  async function handleCopyFromLastMonth() {
    const copied = await copyBudgetsFromMonth(lastMonth, month)
    setCopyMsg(copied > 0 ? `Copied ${copied} budget${copied === 1 ? '' : 's'} from ${formatMonth(lastMonth)}` : 'Nothing new to copy')
    setTimeout(() => setCopyMsg(''), 3000)
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Budgets</h1>
          <p className="text-xs text-text-muted">{formatMonth(month)}</p>
        </div>
        {(prevBudgets?.length ?? 0) > 0 && (
          <button
            onClick={handleCopyFromLastMonth}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface rounded-xl text-xs font-medium text-primary"
          >
            <Copy size={14} />
            Copy last month
          </button>
        )}
      </div>

      {copyMsg && (
        <p className="text-xs text-text-muted mb-3 -mt-2">{copyMsg}</p>
      )}

      <div className="space-y-3">
        {categories?.map(cat => {
          const budget = budgetMap.get(cat.name)
          const spent = expenseTotals.get(cat.name) || 0
          const baseLimit = budget?.limit || 0
          const prevBudget = prevBudgetMap.get(cat.name)
          const rolloverCarry = budget?.rollover && prevBudget
            ? prevBudget.limit - (prevExpenseTotals.get(cat.name) || 0)
            : 0
          const limit = baseLimit + rolloverCarry
          // A deep-overspent previous month can carry the effective limit
          // below 0 — still budgeted (limit != null via `budget`), just
          // already over before a rupee is spent this month. Don't let the
          // `limit > 0` progress-bar math silently hide that.
          const pct = budget && limit > 0 ? Math.min((spent / limit) * 100, 100) : budget && limit <= 0 ? 100 : 0
          const over = !!budget && (limit <= 0 ? true : spent > limit)
          const isEditing = editingCat === cat.name

          return (
            <div key={cat.id} className="bg-surface rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ backgroundColor: cat.color + '20' }}
                >
                  <IconRenderer icon={cat.icon} size={16} />
                </div>
                <span className="flex-1 text-sm font-medium">{cat.name}</span>
                {budget && !isEditing && (
                  <DeleteButton onConfirm={() => scheduleDelete(
                    `"${cat.name}" budget removed`,
                    () => deleteBudget(budget.id!),
                    () => setBudget(cat.name, budget.limit, month, budget.rollover),
                  )} size={14} />
                )}
              </div>

              {budget && !isEditing ? (
                <>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={over ? 'text-expense font-medium' : 'text-text-muted'}>
                      {format(spent)} spent
                    </span>
                    <span className="text-text-muted">
                      {format(limit)} limit
                    </span>
                  </div>
                  <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? '#ef4444' : pct > 80 ? '#f59e0b' : cat.color,
                      }}
                    />
                  </div>
                  {over && (
                    <p className="text-xs text-expense mt-1">
                      Over by {format(spent - limit)}
                    </p>
                  )}
                  {budget.rollover && (
                    <p className="text-xs text-primary mt-1">
                      🔄 {rolloverCarry >= 0 ? '+' : ''}{format(rolloverCarry)} rolled over from {formatMonth(lastMonth)}
                    </p>
                  )}
                  <button
                    onClick={() => { setEditingCat(cat.name); setLimitVal(String(baseLimit)); setRolloverVal(budget.rollover ?? false) }}
                    className="text-xs text-primary mt-1"
                  >
                    Edit limit
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={limitVal}
                        onChange={e => { setLimitVal(e.target.value); setLimitError(false) }}
                        placeholder="Monthly limit"
                        style={{ paddingLeft: '1.75rem' }}
                        className="text-sm"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => handleSave(cat.name)}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingCat(null); setLimitError(false) }}
                      className="px-3 py-2 bg-surface-light rounded-xl text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  {limitError && (
                    <p className="text-xs text-expense mt-1.5">Enter a limit greater than 0</p>
                  )}
                  <label className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={rolloverVal}
                      onChange={e => setRolloverVal(e.target.checked)}
                    />
                    Roll over unused/overspent from last month
                  </label>
                </>
              ) : (
                <button
                  onClick={() => { setEditingCat(cat.name); setLimitVal(''); setRolloverVal(false); setLimitError(false) }}
                  className="text-xs text-primary mt-1"
                >
                  + Set budget
                </button>
              )}
            </div>
          )
        })}
      </div>

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
