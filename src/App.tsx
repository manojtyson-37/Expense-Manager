import { Routes, Route, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './lib/AuthContext'
import { syncFromCloud } from './lib/sync'
import { processSubscriptions, dedupeSubscriptionTransactions } from './lib/subscriptionProcessor'
import { db } from './db'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Subscriptions from './pages/Subscriptions'
import Loans from './pages/Loans'
import Goals from './pages/Goals'
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
      setLoanToast(`${overdue} loan${overdue === 1 ? ' is' : 's are'} overdue`)
      localStorage.setItem(key, '1')
      setTimeout(() => setLoanToast(null), 8000)
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
      .catch(console.error)
      .finally(() => {
        syncingRef.current = false
        setIsSyncing(false)
      })
  }, [user, checkOverdueLoans])

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
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <NavBar />
    </div>
  )
}
