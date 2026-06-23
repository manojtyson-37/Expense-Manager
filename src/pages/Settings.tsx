import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { Download, Trash2, Smartphone, CreditCard } from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)

  // Capture PWA install prompt
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    })
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
        if (data.transactions) {
          await db.transactions.clear()
          await db.transactions.bulkAdd(data.transactions)
        }
        if (data.categories) {
          await db.categories.clear()
          await db.categories.bulkAdd(data.categories)
        }
        if (data.accounts) {
          await db.accounts.clear()
          await db.accounts.bulkAdd(data.accounts)
        }
        alert('Data imported successfully!')
      } catch {
        alert('Invalid backup file.')
      }
    }
    input.click()
  }

  async function handleClearAll() {
    await db.transactions.clear()
    setShowConfirm(false)
  }

  async function handleInstall() {
    if (installPrompt && 'prompt' in installPrompt) {
      (installPrompt as { prompt: () => void }).prompt()
    }
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <h1 className="text-lg font-bold mb-4">Settings</h1>

      <div className="space-y-3">
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
            <p className="text-sm font-medium mb-3">Delete all transactions? This cannot be undone.</p>
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
              <div className="text-xs text-text-muted">Delete all transactions</div>
            </div>
          </button>
        )}
      </div>

      <div className="mt-8 text-center text-text-muted text-xs">
        <p>Expense Tracker v1.0</p>
        <p className="mt-1">Data stored locally on your device</p>
      </div>
    </div>
  )
}
