import IconRenderer from '../components/IconRenderer'
import { useState } from 'react'
import { useAccounts, addAccount, updateAccount, deleteAccount } from '../hooks/useAccounts'
import { useAccountInsights } from '../hooks/useTransactions'
import type { AccountType, Account } from '../db'
import { Plus, ArrowLeft, X, Pencil, ChevronDown } from 'lucide-react'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
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
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('credit_card')
  const [color, setColor] = useState('#6366f1')
  const { toast, scheduleDelete, dismiss } = useUndoDelete()
  const insights = useAccountInsights()
  const [expanded, setExpanded] = useState<string | null>(null)

  const selectedTypeInfo = ACCOUNT_TYPES.find(t => t.type === accountType)!

  function openAdd() {
    setEditingId(null)
    setName('')
    setAccountType('credit_card')
    setColor('#6366f1')
    setShowForm(true)
  }

  function openEdit(acc: Account) {
    setEditingId(acc.id!)
    setName(acc.name)
    setAccountType(acc.type)
    setColor(acc.color)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit() {
    if (!name.trim()) return
    if (editingId) {
      await updateAccount(editingId, {
        name: name.trim(),
        type: accountType,
        icon: selectedTypeInfo.icon,
        color,
      })
    } else {
      await addAccount({
        name: name.trim(),
        type: accountType,
        icon: selectedTypeInfo.icon,
        color,
      })
    }
    closeForm()
  }

  const grouped = new Map<AccountType, Account[]>()
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
          onClick={openAdd}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Spend by account — total per account + tap to see category breakdown */}
      {insights && insights.accounts.some(a => a.spent > 0) && (
        <div className="mb-5">
          <h2 className="text-xs text-text-muted uppercase tracking-wider mb-2">Spend by Account (all time)</h2>
          <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
            {insights.accounts.filter(a => a.spent > 0).map(a => (
              <div key={a.name}>
                <button
                  onClick={() => setExpanded(expanded === a.name ? null : a.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 text-left"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: a.color + '20' }}>
                    <IconRenderer icon={a.icon} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    {a.isCredit && <div className="text-[11px] text-expense">Outstanding ₹{a.outstanding.toLocaleString('en-IN')}</div>}
                  </div>
                  <span className="text-sm font-semibold text-expense">₹{a.spent.toLocaleString('en-IN')}</span>
                  <ChevronDown size={16} className={`text-text-muted transition-transform ${expanded === a.name ? 'rotate-180' : ''}`} />
                </button>
                {expanded === a.name && (
                  <div className="px-4 pb-3 pl-16 space-y-1.5">
                    {a.byCategory.map(c => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{c.category}</span>
                        <span>₹{c.total.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={closeForm}>
        <div className="bg-surface rounded-t-2xl p-4 space-y-3 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{editingId ? 'Edit Account' : 'Add Account'}</span>
            <button onClick={closeForm} className="p-3 -m-2 text-text-muted min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={18} /></button>
          </div>

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
                  <IconRenderer icon={t.icon} size={16} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`e.g. HDFC ${selectedTypeInfo.label}`}
            />
          </div>

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
            onClick={handleSubmit}
            className="w-full py-2.5 bg-primary rounded-xl text-white font-medium"
          >
            {editingId ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
        </div>
      )}

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
                  {typeInfo.icon} {typeInfo.label}
                </h2>
                <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
                  {items.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 cursor-pointer" onClick={() => openEdit(acc)}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
                        style={{ backgroundColor: acc.color + '20' }}
                      >
                        <IconRenderer icon={acc.icon} size={18} />
                      </div>
                      <span className="flex-1 text-sm font-medium">{acc.name}</span>
                      <span className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted"><Pencil size={15} /></span>
                      <DeleteButton onConfirm={() => scheduleDelete(
                        `"${acc.name}" deleted`,
                        () => deleteAccount(acc.id!),
                        () => addAccount({ name: acc.name, type: acc.type, icon: acc.icon, color: acc.color }),
                      )} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
