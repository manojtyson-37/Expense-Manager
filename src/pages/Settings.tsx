import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type Transaction, type Category, type Account, newUid } from '../db'
import { useAuth } from '../lib/AuthContext'
import { fullResync, syncFromCloud, clearAllData } from '../lib/sync'
import { useCurrency } from '../lib/CurrencyContext'
import { CURRENCIES } from '../lib/currency'
import { Download, Trash2, Smartphone, CreditCard, Cloud, LogOut, RefreshCw, Target, Coins } from 'lucide-react'

function isValidBackup(data: unknown): data is { transactions?: unknown[]; categories?: unknown[]; accounts?: unknown[] } {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d.transactions && !Array.isArray(d.transactions)) return false
  if (d.categories && !Array.isArray(d.categories)) return false
  if (d.accounts && !Array.isArray(d.accounts)) return false
  if (d.transactions) {
    for (const t of d.transactions as Record<string, unknown>[]) {
      if (!t.type || !t.amount || !t.category || !t.date) return false
    }
  }
  return true
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { currency, setCurrency } = useCurrency()
  const [showConfirm, setShowConfirm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)

  useEffect(() => {
    function onInstall(e: Event) {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
  }, [])

  async function handleSync() {
    if (!user) return
    setSyncing(true)
    setSyncMsg('')
    try {
      await fullResync(user.id)
      setSyncMsg('Synced to cloud!')
    } catch {
      setSyncMsg('Sync failed. Try again.')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 3000)
  }

  async function handlePull() {
    if (!user) return
    setSyncing(true)
    setSyncMsg('')
    try {
      await syncFromCloud(user.id)
      setSyncMsg('Pulled from cloud!')
    } catch {
      setSyncMsg('Pull failed. Try again.')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 3000)
  }

  async function handleExportAll() {
    const transactions = await db.transactions.toArray()
    const categories = await db.categories.toArray()
    const accounts = await db.accounts.toArray()
    const data = JSON.stringify({ transactions, categories, accounts }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (!isValidBackup(data)) {
          alert('Invalid backup format. Required: transactions with type, amount, category, date.')
          return
        }
        if (data.transactions) {
          await db.transactions.clear()
          await db.transactions.bulkAdd((data.transactions as Transaction[]).map(t => ({
            ...t,
            uid: t.uid || newUid()
          })))
        }
        if (data.categories) {
          await db.categories.clear()
          await db.categories.bulkAdd(data.categories as Category[])
        }
        if (data.accounts) {
          await db.accounts.clear()
          await db.accounts.bulkAdd(data.accounts as Account[])
        }
        if (user) await fullResync(user.id)
        alert('Data imported & synced!')
      } catch {
        alert('Invalid backup file.')
      }
    }
    input.click()
  }

  async function handleClearAll() {
    try {
      if (user) await clearAllData(user.id)
      else await db.transactions.clear()
    } catch {
      alert('Failed to clear cloud data. Try again.')
    }
    setShowConfirm(false)
  }

  async function handleInstall() {
    if (installPrompt && 'prompt' in installPrompt) {
      (installPrompt as { prompt: () => void }).prompt()
    }
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <h1 className="text-lg font-bold mb-1">Settings</h1>
      {user && (
        <p className="text-xs text-text-muted mb-4">{user.email}</p>
      )}

      <div className="space-y-3">
        <div className="bg-income/10 border border-income/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cloud size={18} className="text-income" />
            <span className="font-semibold text-sm">Cloud Sync</span>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Data auto-syncs on every add/edit/delete. Use these for manual sync.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-income text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <Cloud size={14} />
              Push All
            </button>
            <button
              onClick={handlePull}
              disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface-light rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Pull
            </button>
          </div>
          {syncMsg && (
            <p className="text-xs text-income mt-2 text-center">{syncMsg}</p>
          )}
        </div>

        <div className="bg-surface rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={18} className="text-accent" />
            <span className="font-semibold text-sm">Currency</span>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Applies to all amounts shown across the app.
          </p>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full bg-surface-light rounded-xl px-3 py-2.5 text-sm font-medium"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => navigate('/accounts')}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <CreditCard size={20} className="text-primary shrink-0" />
          <div>
            <div className="font-semibold text-sm">Accounts</div>
            <div className="text-xs text-text-muted">Manage credit cards, UPI, cash accounts</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/budgets')}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <Target size={20} className="text-accent shrink-0" />
          <div>
            <div className="font-semibold text-sm">Budgets</div>
            <div className="text-xs text-text-muted">Set monthly spending limits per category</div>
          </div>
        </button>

        {installPrompt && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 bg-primary/20 border border-primary rounded-2xl p-4 text-left"
          >
            <Smartphone size={20} className="text-primary shrink-0" />
            <div>
              <div className="font-semibold text-sm">Install App</div>
              <div className="text-xs text-text-muted">Add to your home screen for quick access</div>
            </div>
          </button>
        )}

        <button
          onClick={handleExportAll}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <Download size={20} className="text-primary shrink-0" />
          <div>
            <div className="font-semibold text-sm">Export Backup</div>
            <div className="text-xs text-text-muted">Download all data as JSON</div>
          </div>
        </button>

        <button
          onClick={handleImport}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <Download size={20} className="text-primary shrink-0 rotate-180" />
          <div>
            <div className="font-semibold text-sm">Import Backup</div>
            <div className="text-xs text-text-muted">Restore from a JSON backup file</div>
          </div>
        </button>

        {showConfirm ? (
          <div className="bg-expense/10 border border-expense rounded-2xl p-4">
            <p className="text-sm font-medium mb-3">Delete all data? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                className="flex-1 py-2.5 bg-expense text-white rounded-xl font-medium text-sm"
              >
                Yes, Delete All
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-surface-light rounded-xl font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
          >
            <Trash2 size={20} className="text-expense shrink-0" />
            <div>
              <div className="font-semibold text-sm text-expense">Clear All Data</div>
              <div className="text-xs text-text-muted">Delete all data from local + cloud</div>
            </div>
          </button>
        )}

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <LogOut size={20} className="text-text-muted shrink-0" />
          <div>
            <div className="font-semibold text-sm">Sign Out</div>
            <div className="text-xs text-text-muted">Local data stays on device</div>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center text-text-muted text-xs">
        <p>Expense Tracker v1.2</p>
        <p className="mt-1">Data synced to Supabase cloud</p>
      </div>
    </div>
  )
}
