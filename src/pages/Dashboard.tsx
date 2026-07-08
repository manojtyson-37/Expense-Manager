import { useTransactions, useAccountInsights } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import { useBudgets } from '../hooks/useBudgets'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useLoans } from '../hooks/useLoans'
import { useGoals } from '../hooks/useGoals'
import MonthPicker from '../components/MonthPicker'
import TransactionItem from '../components/TransactionItem'
import { deleteTransaction, restoreTransaction } from '../hooks/useTransactions'
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import IconRenderer from '../components/IconRenderer'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { useCurrency } from '../lib/CurrencyContext'

interface Props {
  month: string
  onMonthChange: (m: string) => void
}

function DonutChart({ segments, size = 120 }: { segments: { pct: number; color: string }[]; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  if (segments.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-light)" strokeWidth="10" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circ
        const gap = circ - dash
        const currentOffset = offset
        offset += dash
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-currentOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
      })}
    </svg>
  )
}

function formatAmount(n: number, symbol: string): string {
  if (n >= 100000) return `${symbol}${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(1)}K`
  return `${symbol}${n.toFixed(0)}`
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard({ month, onMonthChange }: Props) {
  const { transactions, totals, categoryTotals } = useTransactions(month)
  const { totals: prevTotals } = useTransactions(prevMonth(month))
  const insights = useAccountInsights(month)
  const categories = useCategories()
  const accounts = useAccounts()
  const budgets = useBudgets(month)
  const navigate = useNavigate()
  const { toast, scheduleDelete, dismiss } = useUndoDelete()
  const { symbol, format } = useCurrency()
  const { totalRecurring } = useSubscriptions()
  const { totalOwed } = useLoans()
  const { goals } = useGoals()
  const activeGoals = goals?.filter(g => g.savedAmount < g.targetAmount) ?? []
  const featuredGoal = activeGoals[0]

  const recentTransactions = transactions?.slice(0, 5) || []
  const expenseCategories = categoryTotals?.filter(c => c.type === 'expense') || []
  const totalExpense = totals?.expense || 0
  const totalIncome = totals?.income || 0
  const cashBalance = insights?.cashBalance || 0
  const creditCards = insights?.creditCards || []
  const creditOutstanding = insights?.creditOutstanding || 0
  const prevExpense = prevTotals?.expense || 0
  const prevIncome = prevTotals?.income || 0

  const expenseDelta = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : 0
  const incomeDelta = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0

  const today = new Date().toISOString().slice(0, 10)
  const todaySpent = transactions
    ?.filter(t => t.date === today && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0) || 0

  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()

  const donutSegments = expenseCategories.slice(0, 6).map(({ category, total }) => {
    const cat = categories?.find(c => c.name === category)
    return { pct: totalExpense > 0 ? (total / totalExpense) * 100 : 0, color: cat?.color || '#64748b' }
  })

  return (
    <div className="flex-1">
      <MonthPicker month={month} onChange={onMonthChange} />

      {/* Hero Balance Card */}
      <div className="mx-4 mb-5 rounded-3xl p-5 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #1a3a2a 0%, #0d1f17 50%, #1a2a1a 100%)',
        border: '1px solid rgba(16, 185, 129, 0.15)',
      }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{
          background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }} />
        <div className="text-text-muted text-xs uppercase tracking-widest mb-1">Cash Balance</div>
        <div className={`text-3xl font-bold tracking-tight ${cashBalance >= 0 ? 'text-primary-light' : 'text-expense'}`}>
          {format(cashBalance)}
        </div>
        <div className="text-text-muted text-[11px] mt-0.5">Cash, bank, UPI &amp; wallet · card spends shown separately</div>

        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-income/15 flex items-center justify-center">
              <ArrowDownRight size={14} className="text-income" />
            </div>
            <div>
              <div className="text-xs text-text-muted">Income</div>
              <div className="text-sm font-semibold text-income">{formatAmount(totalIncome, symbol)}</div>
              {prevIncome > 0 && (
                <div className={`text-xs flex items-center gap-0.5 ${incomeDelta >= 0 ? 'text-income' : 'text-expense'}`}>
                  {incomeDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(incomeDelta).toFixed(0)}% vs last
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-expense/15 flex items-center justify-center">
              <ArrowUpRight size={14} className="text-expense" />
            </div>
            <div>
              <div className="text-xs text-text-muted">Expense</div>
              <div className="text-sm font-semibold text-expense">{formatAmount(totalExpense, symbol)}</div>
              {prevExpense > 0 && (
                <div className={`text-xs flex items-center gap-0.5 ${expenseDelta <= 0 ? 'text-income' : 'text-expense'}`}>
                  {expenseDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {Math.abs(expenseDelta).toFixed(0)}% vs last
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Cards — outstanding (spend that does NOT reduce cash balance) */}
      {creditCards.length > 0 && (
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Credit Cards · Outstanding</h2>
            <span className="text-xs font-semibold text-expense">{formatAmount(creditOutstanding, symbol)}</span>
          </div>
          <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
            {creditCards.map(card => (
              <button
                key={card.name}
                onClick={() => navigate('/accounts')}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 text-left"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: card.color + '20' }}>
                  <IconRenderer icon={card.icon} size={18} />
                </div>
                <span className="flex-1 text-sm font-medium truncate">{card.name}</span>
                <span className="text-sm font-semibold text-expense">{format(card.outstanding)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="px-4 flex gap-3 mb-3">
        <div className="flex-1 bg-surface rounded-2xl p-3.5">
          <div className="text-xs text-text-muted uppercase tracking-wider">Today</div>
          <div className="text-lg font-bold text-expense mt-0.5">
            {todaySpent > 0 ? format(todaySpent) : format(0)}
          </div>
          <div className="text-xs text-text-muted">spent today</div>
        </div>
        <div className="flex-1 bg-surface rounded-2xl p-3.5">
          <div className="text-xs text-text-muted uppercase tracking-wider">Txns</div>
          <div className="text-lg font-bold mt-0.5">{transactions?.length || 0}</div>
          <div className="text-xs text-text-muted">this month</div>
        </div>
        <div className="flex-1 bg-surface rounded-2xl p-3.5">
          <div className="text-xs text-text-muted uppercase tracking-wider">Avg/Day</div>
          <div className="text-lg font-bold text-accent mt-0.5">
            {totalExpense > 0
              ? format(Math.round(totalExpense / daysInMonth), { minimumFractionDigits: 0 })
              : format(0, { minimumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-text-muted">daily spend</div>
        </div>
      </div>

      {/* Recurring & Loans Row */}
      <div className="px-4 flex gap-3 mb-5">
        <button onClick={() => navigate('/subscriptions')} className="flex-1 bg-surface rounded-2xl p-3.5 text-left active:bg-surface-light/50">
          <div className="text-xs text-text-muted uppercase tracking-wider">Recurring</div>
          <div className="text-lg font-bold text-accent mt-0.5">
            {format(totalRecurring || 0)}
          </div>
          <div className="text-xs text-text-muted">monthly subscriptions</div>
        </button>
        <button onClick={() => navigate('/loans')} className="flex-1 bg-surface rounded-2xl p-3.5 text-left active:bg-surface-light/50">
          <div className="text-xs text-text-muted uppercase tracking-wider">Money Owed</div>
          <div className="text-lg font-bold text-income mt-0.5">
            {format((totalOwed ?? 0))}
          </div>
          <div className="text-xs text-text-muted">from friends</div>
        </button>
      </div>

      {/* Featured Goal */}
      {featuredGoal && (
        <div className="px-4 mb-5">
          <button onClick={() => navigate('/goals')} className="w-full bg-surface rounded-2xl p-3.5 text-left active:bg-surface-light/50">
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted uppercase tracking-wider">Goal · {featuredGoal.name}</div>
              <div className="text-xs text-text-muted">
                {format(featuredGoal.savedAmount)} / {format(featuredGoal.targetAmount)}
              </div>
            </div>
            <div className="h-2 bg-surface-light rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${featuredGoal.targetAmount > 0 ? Math.min(100, (featuredGoal.savedAmount / featuredGoal.targetAmount) * 100) : 0}%` }}
              />
            </div>
          </button>
        </div>
      )}

      {/* Spending Breakdown with Donut */}
      {expenseCategories.length > 0 && (
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Spending Breakdown</h2>
            <button onClick={() => navigate('/trends')} className="text-xs text-primary font-medium">
              View Trends
            </button>
          </div>
          <div className="bg-surface rounded-2xl p-4">
            <div className="flex gap-4">
              {/* Donut */}
              <div className="relative shrink-0">
                <DonutChart segments={donutSegments} size={100} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xs text-text-muted">Total</div>
                  <div className="text-sm font-bold">{formatAmount(totalExpense, symbol)}</div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {expenseCategories.slice(0, 5).map(({ category, total }) => {
                  const cat = categories?.find(c => c.name === category)
                  const pct = totalExpense > 0 ? ((total / totalExpense) * 100).toFixed(0) : '0'
                  return (
                    <div key={category} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color || '#64748b' }} />
                      <span className="truncate flex-1 flex items-center gap-1"><IconRenderer icon={cat?.icon || '📦'} size={14} /> {category}</span>
                      <span className="text-text-muted shrink-0">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Progress */}
      {budgets && budgets.length > 0 && (
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Budget Tracker</h2>
            <button onClick={() => navigate('/budgets')} className="text-xs text-primary font-medium">Manage</button>
          </div>
          <div className="bg-surface rounded-2xl p-4 space-y-3">
            {budgets.map(b => {
              const cat = categories?.find(c => c.name === b.category)
              const spent = expenseCategories.find(c => c.category === b.category)?.total || 0
              const pct = Math.min((spent / b.limit) * 100, 100)
              const over = spent > b.limit
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <IconRenderer icon={cat?.icon || '📦'} size={16} />
                      <span>{b.category}</span>
                    </span>
                    <span className={over ? 'text-expense font-medium' : 'text-text-muted'}>
                      {format(spent)} / {format(b.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? 'var(--color-expense)' : pct > 80 ? 'var(--color-accent)' : 'var(--color-primary)',
                      }}
                    />
                  </div>
                  {over && (
                    <p className="text-xs text-expense mt-0.5">Over by {format(spent - b.limit)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent</h2>
          {recentTransactions.length > 0 && (
            <button onClick={() => navigate('/transactions')} className="text-xs text-primary font-medium">
              See All
            </button>
          )}
        </div>
        <div className="bg-surface rounded-2xl mx-4 overflow-hidden divide-y divide-surface-light">
          {recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              No transactions yet. Tap + to add one.
            </div>
          ) : (
            recentTransactions.map(t => (
              <TransactionItem key={t.id} transaction={t} categories={categories} accounts={accounts} onDelete={(id) => scheduleDelete('Transaction deleted', () => deleteTransaction(id), () => restoreTransaction(t))} />
            ))
          )}
        </div>
      </div>

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
