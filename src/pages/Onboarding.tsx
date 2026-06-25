import { useState } from 'react'
import { addAccount } from '../hooks/useAccounts'
import { useAccounts } from '../hooks/useAccounts'
import type { AccountType } from '../db'
import { ChevronRight, Plus } from 'lucide-react'

const QUICK_ACCOUNTS: { name: string; type: AccountType; icon: string; color: string }[] = [
  { name: 'Cash', type: 'cash', icon: '💵', color: '#22c55e' },
  { name: 'UPI', type: 'upi', icon: '📱', color: '#6366f1' },
  { name: 'Credit Card', type: 'credit_card', icon: '💳', color: '#f59e0b' },
  { name: 'Bank Account', type: 'bank', icon: '🏦', color: '#3b82f6' },
]

interface Props {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: Props) {
  const accounts = useAccounts()
  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState<AccountType>('credit_card')
  const [showCustom, setShowCustom] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())

  async function handleQuickAdd(acc: typeof QUICK_ACCOUNTS[0]) {
    if (added.has(acc.name)) return
    await addAccount(acc)
    setAdded(prev => new Set(prev).add(acc.name))
  }

  async function handleCustomAdd() {
    if (!customName.trim()) return
    const typeInfo = QUICK_ACCOUNTS.find(a => a.type === customType) || QUICK_ACCOUNTS[0]
    await addAccount({
      name: customName.trim(),
      type: customType,
      icon: typeInfo.icon,
      color: typeInfo.color,
    })
    setAdded(prev => new Set(prev).add(customName.trim()))
    setCustomName('')
    setShowCustom(false)
  }

  const hasAccounts = (accounts?.length || 0) > 0 || added.size > 0

  return (
    <div className="flex-1 flex flex-col px-6 pt-12 pb-8">
      <div className="flex-1">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="text-text-muted text-sm mt-2 leading-relaxed">
            First, add the accounts you spend from.<br />
            This helps track where each rupee goes.
          </p>
        </div>

        <h2 className="text-xs text-text-muted uppercase tracking-wider mb-3">Quick Add</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {QUICK_ACCOUNTS.map(acc => (
            <button
              key={acc.name}
              onClick={() => handleQuickAdd(acc)}
              disabled={added.has(acc.name)}
              className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all ${
                added.has(acc.name)
                  ? 'bg-primary/15 border-2 border-primary'
                  : 'bg-surface border-2 border-transparent active:bg-surface-light'
              }`}
            >
              <span className="text-2xl">{acc.icon}</span>
              <div>
                <div className="text-sm font-medium">{acc.name}</div>
                {added.has(acc.name) && (
                  <div className="text-xs text-primary">Added ✓</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-2 text-sm text-primary font-medium mb-4"
          >
            <Plus size={16} /> Add specific account (e.g. HDFC Card, GPay)
          </button>
        ) : (
          <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex gap-2">
              {(['credit_card', 'upi', 'bank', 'wallet'] as const).map(t => {
                const info = QUICK_ACCOUNTS.find(a => a.type === t) || { icon: '👛', name: t }
                return (
                  <button
                    key={t}
                    onClick={() => setCustomType(t)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${
                      customType === t ? 'bg-primary/20 text-primary' : 'bg-surface-light text-text-muted'
                    }`}
                  >
                    {info.icon} {t.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="e.g. HDFC 8682, GPay, Paytm"
                autoFocus
              />
              <button
                onClick={handleCustomAdd}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {hasAccounts && (
          <div className="bg-surface-light/30 rounded-xl p-3 mt-2">
            <div className="text-xs text-text-muted mb-1">Added accounts:</div>
            <div className="flex flex-wrap gap-1.5">
              {accounts?.map(a => (
                <span key={a.id} className="text-xs bg-surface px-2 py-1 rounded-lg">
                  {a.icon} {a.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onComplete}
        className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
          hasAccounts
            ? 'bg-primary text-white'
            : 'bg-surface-light text-text-muted'
        }`}
      >
        {hasAccounts ? 'Start Tracking' : 'Skip for now'}
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
