import IconRenderer from '../components/IconRenderer'
import { useState } from 'react'
import { useCategories } from '../hooks/useCategories'
import { useBudgets, setBudget, deleteBudget } from '../hooks/useBudgets'
import { useTransactions } from '../hooks/useTransactions'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DeleteButton from '../components/DeleteButton'

interface Props {
  month: string
}

export default function Budgets({ month }: Props) {
  const navigate = useNavigate()
  const categories = useCategories('expense')
  const budgets = useBudgets(month)
  const { categoryTotals } = useTransactions(month)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [limitVal, setLimitVal] = useState('')

  const expenseTotals = new Map(
    (categoryTotals || []).filter(c => c.type === 'expense').map(c => [c.category, c.total])
  )
  const budgetMap = new Map(
    (budgets || []).map(b => [b.category, b])
  )

  function formatMonth(m: string): string {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  async function handleSave(category: string) {
    const val = parseFloat(limitVal)
    if (isNaN(val) || val <= 0) return
    await setBudget(category, val, month)
    setEditingCat(null)
    setLimitVal('')
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Budgets</h1>
          <p className="text-xs text-text-muted">{formatMonth(month)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {categories?.map(cat => {
          const budget = budgetMap.get(cat.name)
          const spent = expenseTotals.get(cat.name) || 0
          const limit = budget?.limit || 0
          const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
          const over = limit > 0 && spent > limit
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
                  <DeleteButton onConfirm={() => deleteBudget(budget.id!)} size={14} />
                )}
              </div>

              {budget && !isEditing ? (
                <>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={over ? 'text-expense font-medium' : 'text-text-muted'}>
                      ₹{spent.toLocaleString('en-IN')} spent
                    </span>
                    <span className="text-text-muted">
                      ₹{limit.toLocaleString('en-IN')} limit
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
                      Over by ₹{(spent - limit).toLocaleString('en-IN')}
                    </p>
                  )}
                  <button
                    onClick={() => { setEditingCat(cat.name); setLimitVal(String(limit)) }}
                    className="text-xs text-primary mt-1"
                  >
                    Edit limit
                  </button>
                </>
              ) : isEditing ? (
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={limitVal}
                      onChange={e => setLimitVal(e.target.value)}
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
                    onClick={() => setEditingCat(null)}
                    className="px-3 py-2 bg-surface-light rounded-xl text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingCat(cat.name); setLimitVal('') }}
                  className="text-xs text-primary mt-1"
                >
                  + Set budget
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
