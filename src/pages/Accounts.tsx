import { useState } from 'react'
import { useAccounts, addAccount, deleteAccount } from '../hooks/useAccounts'
import type { AccountType } from '../db'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'credit_card', label: 'Credit Card', icon: '💳' },
  { type: 'upi', label: 'UPI', icon: '📱' },
  { type: 'cash', label: 'Cash', icon: '💵' },
  { type: 'bank', label: 'Bank Account', icon: '🏦' },
  { type: 'wallet', label: 'Wallet', icon: '👛' },
]

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899']

export default function Accounts() {
  const navigate = useNavigate()
  const accounts = useAccounts()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('credit_card')
  const [color, setColor] = useState('#6366f1')

  const selectedTypeInfo = ACCOUNT_TYPES.find(t => t.type === accountType)!

  async function handleAdd() {
    if (!name.trim()) return
    await addAccount({
      name: name.trim(),
      type: accountType,
      icon: selectedTypeInfo.icon,
      color,
    })
    setName('')
    setShowAdd(false)
  }

  const grouped = new Map<AccountType, typeof accounts>()
  for (const acc of accounts || []) {
    const list = grouped.get(acc.type) || []
    list.push(acc)
    grouped.set(acc.type, list)
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">Accounts</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
          {/* Account Type */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Account Type</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setAccountType(t.type)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    accountType === t.type
                      ? 'bg-primary/20 border border-primary'
                      : 'bg-surface-light border border-transparent'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`e.g. HDFC ${selectedTypeInfo.label}`}
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full py-2.5 bg-primary rounded-xl text-white font-medium"
          >
            Add Account
          </button>
        </div>
      )}

      {/* Account List */}
      {(!accounts || accounts.length === 0) ? (
        <div className="py-20 text-center text-text-muted text-sm">
          No accounts added. Tap + to add your first account.
        </div>
      ) : (
        <div className="space-y-4">
          {ACCOUNT_TYPES.map(typeInfo => {
            const items = grouped.get(typeInfo.type)
            if (!items || items.length === 0) return null
            return (
              <div key={typeInfo.type}>
                <h2 className="text-xs text-text-muted uppercase tracking-wider mb-2">
                  {typeInfo.icon} {typeInfo.label}s
                </h2>
                <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
                  {items.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
                        style={{ backgroundColor: acc.color + '20' }}
                      >
                        {acc.icon}
                      </div>
                      <span className="flex-1 text-sm font-medium">{acc.name}</span>
                      <button
                        onClick={() => deleteAccount(acc.id!)}
                        className="p-2 text-text-muted active:text-expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
