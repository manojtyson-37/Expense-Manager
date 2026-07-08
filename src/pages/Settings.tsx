import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type Transaction, type Category, type Account, type Budget, type Subscription, type Loan, newUid } from '../db'
import { useAuth } from '../lib/AuthContext'
import { fullResync, syncFromCloud, clearAllData, pushSubscription, pushLoan } from '../lib/sync'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../lib/CurrencyContext'
import { CURRENCIES } from '../lib/currency'
import { Download, Trash2, Smartphone, CreditCard, Cloud, LogOut, RefreshCw, Target, Coins, RefreshCcw, Users } from 'lucide-react'

function isValidBackup(data: unknown): data is {
  transactions?: unknown[]; categories?: unknown[]; accounts?: unknown[]
  budgets?: unknown[]; subscriptions?: unknown[]; loans?: unknown[]
} {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  for (const key of ['transactions', 'categories', 'accounts', 'budgets', 'subscriptions', 'loans']) {
    if (d[key] && !Array.isArray(d[key])) return false
  }
  if (d.transactions) {
    for (const t of d.transactions as Record<string, unknown>[]) {
      if (!t.type || !t.amount || !t.category || !t.date) return false
    }
  }
  if (d.budgets) {
    for (const b of d.budgets as Record<string, unknown>[]) {
      if (!b.category || typeof b.limit !== 'number' || !b.month) return false
    }
  }
  if (d.subscriptions) {
    for (const s of d.subscriptions as Record<string, unknown>[]) {
      if (!s.name || typeof s.amount !== 'number' || !s.frequency || !s.startDate) return false
    }
  }
  if (d.loans) {
    for (const l of d.loans as Record<string, unknown>[]) {
      if (!l.person || typeof l.totalAmount !== 'number' || !l.date) return false
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
    const budgets = await db.budgets.toArray()
    const subscriptions = await db.subscriptions.toArray()
    const loans = await db.loans.toArray()
    const data = JSON.stringify({ transactions, categories, accounts, budgets, subscriptions, loans }, null, 2)
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
      // Budgets have no merge-guard in syncFromCloud's pull (unlike
      // subscriptions/loans, which push local-only rows before the cloud
      // replace) — an offline import's local budget writes would otherwise
      // be silently wiped by the next sync's unconditional
      // clear()+bulkAdd(cloudBudgets). Require online so the cloud-push
      // below actually runs and there's nothing left for a later sync to
      // discard.
      if (!navigator.onLine) {
        alert('Import requires an internet connection. Please reconnect and try again.')
        return
      }
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
        if (data.budgets) {
          await db.budgets.clear()
          await db.budgets.bulkAdd(data.budgets as Budget[])
        }
        if (data.subscriptions) {
          await db.subscriptions.clear()
          await db.subscriptions.bulkAdd((data.subscriptions as Subscription[]).map(s => ({
            ...s, uid: s.uid || newUid(),
          })))
        }
        if (data.loans) {
          await db.loans.clear()
          await db.loans.bulkAdd((data.loans as Loan[]).map(l => ({
            ...l, uid: l.uid || newUid(),
          })))
        }
        if (user) {
          await fullResync(user.id)
          // fullResync only covers transactions/categories/accounts (its
          // original scope) — budgets/subscriptions/loans need their own
          // cloud replace so a restored backup isn't left half-synced. This
          // whole import is required to run online (checked above): budgets
          // have no merge-guard in syncFromCloud's pull, so an offline
          // import's local-only writes would get silently wiped by the next
          // sync's unconditional cloud replace — there's no outbox path that
          // would protect them the way it does for everyday edits.
          if (data.budgets) {
            const budgets = await db.budgets.toArray()
            const { error: delErr } = await supabase.from('budgets').delete().eq('user_id', user.id)
            if (delErr) {
              console.error('Import: clearing cloud budgets failed, skipping re-push:', delErr)
            } else if (budgets.length > 0) {
              const { error: insErr } = await supabase.from('budgets').insert(budgets.map(b => ({
                user_id: user.id, category: b.category, limit_amount: b.limit, month: b.month,
              })))
              if (insErr) console.error('Import: pushing budgets to cloud failed:', insErr)
            }
          }
          if (data.subscriptions) {
            const subs = await db.subscriptions.toArray()
            const { error: delErr } = await supabase.from('subscriptions').delete().eq('user_id', user.id)
            if (delErr) {
              console.error('Import: clearing cloud subscriptions failed, skipping re-push:', delErr)
            } else {
              for (const s of subs) await pushSubscription(user.id, s)
            }
          }
          if (data.loans) {
            const loans = await db.loans.toArray()
            const { error: delErr } = await supabase.from('loans').delete().eq('user_id', user.id)
            if (delErr) {
              console.error('Import: clearing cloud loans failed, skipping re-push:', delErr)
            } else {
              for (const l of loans) await pushLoan(l)
            }
          }
        }
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

        <button
          onClick={() => navigate('/subscriptions')}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <RefreshCcw size={20} className="text-primary shrink-0" />
          <div>
            <div className="font-semibold text-sm">Subscriptions</div>
            <div className="text-xs text-text-muted">Track recurring payments and services</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/loans')}
          className="w-full flex items-center gap-3 bg-surface rounded-2xl p-4 text-left active:bg-surface-light"
        >
          <Users size={20} className="text-income shrink-0" />
          <div>
            <div className="font-semibold text-sm">Money Owed</div>
            <div className="text-xs text-text-muted">Track money lent to friends and family</div>
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
