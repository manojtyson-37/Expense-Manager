import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import MonthPicker from '../components/MonthPicker'
import TransactionItem from '../components/TransactionItem'
import { deleteTransaction } from '../hooks/useTransactions'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface Props {
  month: string
  onMonthChange: (m: string) => void
}

export default function Dashboard({ month, onMonthChange }: Props) {
  const { transactions, totals, categoryTotals } = useTransactions(month)
  const categories = useCategories()

  const recentTransactions = transactions?.slice(0, 5) || []
  const expenseCategories = categoryTotals?.filter(c => c.type === 'expense') || []
  const totalExpense = totals?.expense || 0

  return (
    <div className="flex-1">
      <MonthPicker month={month} onChange={onMonthChange} />

      {/* Balance Cards */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface rounded-2xl p-4 text-center">
          <TrendingUp size={18} className="mx-auto mb-1 text-income" />
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Income</div>
          <div className="text-income font-bold text-lg mt-1">
            ₹{(totals?.income || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-surface rounded-2xl p-4 text-center">
          <TrendingDown size={18} className="mx-auto mb-1 text-expense" />
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Expense</div>
          <div className="text-expense font-bold text-lg mt-1">
            ₹{(totals?.expense || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-surface rounded-2xl p-4 text-center">
          <Wallet size={18} className="mx-auto mb-1 text-primary-light" />
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Balance</div>
          <div className={`font-bold text-lg mt-1 ${(totals?.balance || 0) >= 0 ? 'text-income' : 'text-expense'}`}>
            ₹{(totals?.balance || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Spending Breakdown */}
      {expenseCategories.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Spending by Category</h2>
          <div className="bg-surface rounded-2xl p-4 space-y-3">
            {expenseCategories.slice(0, 6).map(({ category, total }) => {
              const cat = categories?.find(c => c.name === category)
              const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0
              return (
                <div key={category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span>{cat?.icon || '📦'}</span>
                      <span>{category}</span>
                    </span>
                    <span className="text-text-muted">₹{total.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat?.color || '#6366f1',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="text-sm font-semibold">Recent Transactions</h2>
        </div>
        <div className="bg-surface rounded-2xl mx-4 overflow-hidden divide-y divide-surface-light">
          {recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              No transactions yet. Tap + to add one.
            </div>
          ) : (
            recentTransactions.map(t => (
              <TransactionItem key={t.id} transaction={t} onDelete={deleteTransaction} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
