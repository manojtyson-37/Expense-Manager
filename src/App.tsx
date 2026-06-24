import { Routes, Route } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './lib/AuthContext'
import { syncFromCloud } from './lib/sync'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NavBar from './components/NavBar'

export default function App() {
  const { user, loading } = useAuth()
  const lastSyncRef = useRef(0)
  const syncingRef = useRef(false)
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
    syncFromCloud(user.id)
      .catch(console.error)
      .finally(() => { syncingRef.current = false })
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

  if (!user) {
    return <Login />
  }

  return (
    <div className="flex flex-col min-h-svh pb-20">
      <Routes>
        <Route path="/" element={<Dashboard month={currentMonth} onMonthChange={setCurrentMonth} />} />
        <Route path="/transactions" element={<Transactions month={currentMonth} onMonthChange={setCurrentMonth} />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/edit/:id" element={<AddTransaction />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <NavBar />
    </div>
  )
}
