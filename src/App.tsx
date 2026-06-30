import { Routes, Route } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './lib/AuthContext'
import { syncFromCloud } from './lib/sync'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Subscriptions from './pages/Subscriptions'
import Settings from './pages/Settings'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import NavBar from './components/NavBar'
import { useAccounts } from './hooks/useAccounts'
import { Cloud } from 'lucide-react'

export default function App() {
  const { user, loading, recovery } = useAuth()
  const accounts = useAccounts()
  const lastSyncRef = useRef(0)
  const syncingRef = useRef(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const sync = useCallback(() => {
    if (!user || syncingRef.current) return
    const now = Date.now()
    if (now - lastSyncRef.current < 5000) return
    lastSyncRef.current = now
    syncingRef.current = true
    setIsSyncing(true)
    syncFromCloud(user.id)
      .catch(console.error)
      .finally(() => {
        syncingRef.current = false
        setIsSyncing(false)
      })
  }, [user])

  useEffect(() => { sync() }, [sync])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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
      {isSyncing && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-primary/10 text-primary text-xs font-medium">
          <Cloud size={12} className="animate-pulse" />
          Syncing...
        </div>
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
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <NavBar />
    </div>
  )
}
