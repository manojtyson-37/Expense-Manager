import { Routes, Route, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './lib/AuthContext'
import { syncFromCloud } from './lib/sync'
import { processSubscriptions, dedupeSubscriptionTransactions } from './lib/subscriptionProcessor'
import { db } from './db'
import { notify } from './lib/notifications'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Subscriptions from './pages/Subscriptions'
import Loans from './pages/Loans'
import Goals from './pages/Goals'
import Trends from './pages/Trends'
import Settings from './pages/Settings'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import NavBar from './components/NavBar'
import OfflineBadge from './components/OfflineBadge'
import { useAccounts } from './hooks/useAccounts'
import { Cloud } from 'lucide-react'

// Local date, not UTC — avoids the "overdue at midnight in a different
// timezone than the user's" bug from toISOString().
function localToday(): string {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export default function App() {
  const navigate = useNavigate()
  const { user, loading, recovery } = useAuth()
  const accounts = useAccounts()
  const lastSyncRef = useRef(0)
  const syncingRef = useRef(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [subToast, setSubToast] = useState<string | null>(null)
  const [loanToast, setLoanToast] = useState<string | null>(null)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // At most once per day per user (not every sync) — a running toast every
  // app-open would be noise, not a reminder.
  const checkOverdueLoans = useCallback(async (userId: string) => {
    const today = localToday()
    const key = `loan-reminder-shown:${userId}:${today}`
    if (localStorage.getItem(key)) return
    const overdue = await db.loans
      .filter(l => l.status === 'pending' && !!l.dueDate && l.dueDate < today)
      .count()
    if (overdue > 0) {
      const msg = `${overdue} loan${overdue === 1 ? ' is' : 's are'} overdue`
      setLoanToast(msg)
      notify('Loan overdue', msg)
      localStorage.setItem(key, '1')
      setTimeout(() => setLoanToast(null), 8000)
    }
  }, [])

  // Forward-looking: smallest occurrence of startDate + N*frequency that
  // isn't before today. Deterministic from startDate alone — doesn't need
  // the processor's lastPosted tracking, since this only asks "when's next",
  // not "what did I miss".
  const checkSubscriptionsDueSoon = useCallback(async (userId: string) => {
    const today = localToday()
    const key = `sub-reminder-shown:${userId}:${today}`
    if (localStorage.getItem(key)) return
    const active = await db.subscriptions
      .filter(s => s.status === 'active' && s.startDate <= today && (!s.endDate || s.endDate >= today))
      .toArray()
    const fmtDate = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
    const soonCutoff = new Date()
    soonCutoff.setDate(soonCutoff.getDate() + 2)
    const soonCutoffStr = fmtDate(soonCutoff)

    const dueSoonNames: string[] = []
    for (const s of active) {
      const [y, m, d] = s.startDate.split('-').map(Number)
      const cur = new Date(y, m - 1, d)
      const advance = () => {
        if (s.frequency === 'daily') cur.setDate(cur.getDate() + 1)
        else if (s.frequency === 'weekly') cur.setDate(cur.getDate() + 7)
        else if (s.frequency === 'monthly') cur.setMonth(cur.getMonth() + 1)
        else cur.setFullYear(cur.getFullYear() + 1)
      }
      while (fmtDate(cur) < today) advance()
      const next = fmtDate(cur)
      if (next >= today && next <= soonCutoffStr) dueSoonNames.push(s.name)
    }
    if (dueSoonNames.length > 0) {
      notify('Subscription due soon', `${dueSoonNames.join(', ')} renew${dueSoonNames.length === 1 ? 's' : ''} within 2 days`)
      localStorage.setItem(key, '1')
    }
  }, [])

  const checkBudgetsOverLimit = useCallback(async (userId: string) => {
    const today = localToday()
    const key = `budget-reminder-shown:${userId}:${today}`
    if (localStorage.getItem(key)) return
    const month = today.slice(0, 7)
    const [budgets, monthTxns] = await Promise.all([
      db.budgets.where('month').equals(month).toArray(),
      db.transactions.where('date').startsWith(month).and(t => t.type === 'expense').toArray(),
    ])
    if (budgets.length === 0) return
    const spentByCategory = new Map<string, number>()
    for (const t of monthTxns) spentByCategory.set(t.category, (spentByCategory.get(t.category) || 0) + t.amount)
    const overLimit = budgets.filter(b => (spentByCategory.get(b.category) || 0) >= b.limit)
    if (overLimit.length > 0) {
      notify('Budget over limit', `${overLimit.map(b => b.category).join(', ')} ${overLimit.length === 1 ? 'is' : 'are'} over budget this month`)
      localStorage.setItem(key, '1')
    }
  }, [])

  const sync = useCallback(() => {
    if (!user || syncingRef.current) return
    const now = Date.now()
    if (now - lastSyncRef.current < 5000) return
    lastSyncRef.current = now
    syncingRef.current = true
    setIsSyncing(true)
    syncFromCloud(user.id)
      .then(() => dedupeSubscriptionTransactions())
      .then(() => processSubscriptions())
      .then(count => {
        if (count > 0) {
          setSubToast(`${count} subscription transaction${count === 1 ? '' : 's'} added`)
          setTimeout(() => setSubToast(null), 4000)
        }
      })
      .then(() => checkOverdueLoans(user.id))
      .then(() => checkSubscriptionsDueSoon(user.id))
      .then(() => checkBudgetsOverLimit(user.id))
      .catch(console.error)
      .finally(() => {
        syncingRef.current = false
        setIsSyncing(false)
      })
  }, [user, checkOverdueLoans, checkSubscriptionsDueSoon, checkBudgetsOverLimit])

  useEffect(() => { sync() }, [sync])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sync])

  useEffect(() => {
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [sync])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-svh">
        <div className="text-text-muted">Loading...</div>
      </div>
    )
  }

  if (recovery) {
    return <ResetPassword />
  }

  if (!user) {
    return <Login />
  }

  if (!onboardingDone && accounts !== undefined && accounts.length === 0) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />
  }

  return (
    <div className="flex flex-col min-h-svh pb-20">
      <OfflineBadge />
      {isSyncing && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-primary/10 text-primary text-xs font-medium">
          <Cloud size={12} className="animate-pulse" />
          Syncing...
        </div>
      )}
      {subToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-surface border border-border rounded-2xl shadow-lg text-sm font-medium text-text whitespace-nowrap">
          {subToast}
        </div>
      )}
      {loanToast && (
        <button
          onClick={() => { setLoanToast(null); navigate('/loans') }}
          className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-expense text-white rounded-2xl shadow-lg text-sm font-medium whitespace-nowrap ${subToast ? 'bottom-36' : 'bottom-24'}`}
        >
          {loanToast} — tap to view
        </button>
      )}
      <Routes>
        <Route path="/" element={<Dashboard month={currentMonth} onMonthChange={setCurrentMonth} />} />
        <Route path="/transactions" element={<Transactions month={currentMonth} onMonthChange={setCurrentMonth} />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/edit/:uid" element={<AddTransaction />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/budgets" element={<Budgets month={currentMonth} />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <NavBar />
    </div>
  )
}
