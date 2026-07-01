import { useState } from 'react'
import { ArrowLeft, Plus, RefreshCw, PauseCircle, PlayCircle, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSubscriptions, addSubscription, editSubscription, toggleSubscriptionStatus, cancelSubscription, deleteSubscription } from '../hooks/useSubscriptions'
import { useCategories } from '../hooks/useCategories'
import { useCurrency } from '../lib/CurrencyContext'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import type { Subscription } from '../db'

type Frequency = Subscription['frequency']
type Status = Subscription['status']

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const STATUS_COLORS: Record<Status, string> = {
  active: 'text-income bg-income/10',
  paused: 'text-amber-500 bg-amber-500/10',
  cancelled: 'text-text-muted bg-surface-light',
}

const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

interface FormState {
  name: string
  amount: string
  frequency: Frequency
  startDate: string
  category: string
  note: string
}

const emptyForm = (): FormState => ({
  name: '',
  amount: '',
  frequency: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
  category: '',
  note: '',
})

export default function Subscriptions() {
  const navigate = useNavigate()
  const { subscriptions, totalRecurring } = useSubscriptions()
  const categories = useCategories()
  const { format, symbol } = useCurrency()
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const [showModal, setShowModal] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [errors, setErrors] = useState<Partial<FormState>>({})

  function openAdd() {
    setForm(emptyForm())
    setErrors({})
    setEditingUid(null)
    setShowModal(true)
  }

  function openEdit(sub: Subscription) {
    setForm({
      name: sub.name,
      amount: String(sub.amount),
      frequency: sub.frequency,
      startDate: sub.startDate,
      category: sub.category ?? '',
      note: sub.note ?? '',
    })
    setErrors({})
    setEditingUid(sub.uid)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUid(null)
    setForm(emptyForm())
    setErrors({})
  }

  function validate(): boolean {
    const e: Partial<FormState> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0'
    if (!form.startDate) e.startDate = 'Start date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const amt = parseFloat(form.amount)
    if (editingUid) {
      await editSubscription(editingUid, {
        name: form.name.trim(),
        amount: amt,
        frequency: form.frequency,
        startDate: form.startDate,
        category: form.category || undefined,
        note: form.note.trim() || undefined,
      })
    } else {
      await addSubscription(
        form.name.trim(),
        amt,
        form.frequency,
        form.startDate,
        form.category || undefined,
        form.note.trim() || undefined,
      )
    }
    closeModal()
  }

  async function handleToggle(uid: string) {
    await toggleSubscriptionStatus(uid)
  }

  function handleDelete(sub: Subscription) {
    scheduleDelete(
      `"${sub.name}" deleted`,
      () => deleteSubscription(sub.uid),
      () => {},
    )
  }

  const active = subscriptions?.filter(s => s.status === 'active') ?? []
  const paused = subscriptions?.filter(s => s.status === 'paused') ?? []
  const cancelled = subscriptions?.filter(s => s.status === 'cancelled') ?? []

  function SubCard({ sub }: { sub: Subscription }) {
    return (
      <div className="bg-surface rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{sub.name}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>
                {STATUS_LABELS[sub.status]}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-base font-bold">{format(sub.amount)}</span>
              <span className="text-xs text-text-muted">/ {FREQUENCY_LABELS[sub.frequency]}</span>
              {sub.category && (
                <span className="text-xs text-text-muted">· {sub.category}</span>
              )}
            </div>
            {sub.note && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{sub.note}</p>
            )}
            <p className="text-xs text-text-muted mt-0.5">
              Since {new Date(sub.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle status */}
            {sub.status === 'active' && (
              <button
                onClick={() => handleToggle(sub.uid)}
                className="p-2 text-amber-500 active:opacity-60 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Pause"
              >
                <PauseCircle size={18} />
              </button>
            )}
            {sub.status === 'paused' && (
              <>
                <button
                  onClick={() => handleToggle(sub.uid)}
                  className="p-2 text-income active:opacity-60 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Resume"
                >
                  <PlayCircle size={18} />
                </button>
                <button
                  onClick={() => cancelSubscription(sub.uid)}
                  className="p-2 text-text-muted active:opacity-60 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Cancel"
                >
                  <XCircle size={18} />
                </button>
              </>
            )}
            {sub.status === 'cancelled' && (
              <button
                onClick={() => handleToggle(sub.uid)}
                className="p-2 text-income active:opacity-60 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Reactivate"
              >
                <PlayCircle size={18} />
              </button>
            )}

            {/* Edit */}
            <button
              onClick={() => openEdit(sub)}
              className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center text-sm font-medium"
            >
              Edit
            </button>

            {/* Delete */}
            <DeleteButton onConfirm={() => handleDelete(sub)} size={14} />
          </div>
        </div>
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: Subscription[] }) {
    if (items.length === 0) return null
    return (
      <div className="mb-4">
        <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2 px-1">{title}</p>
        <div className="space-y-3">
          {items.map(sub => <SubCard key={sub.uid} sub={sub} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Subscriptions</h1>
          {totalRecurring !== undefined && totalRecurring > 0 && (
            <p className="text-xs text-text-muted">{format(totalRecurring)} / month total</p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* List */}
      {subscriptions === undefined ? (
        <div className="text-center text-text-muted py-12 text-sm">Loading...</div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={36} className="text-text-muted opacity-40" />
          <p className="text-text-muted text-sm">No subscriptions yet</p>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium mt-1"
          >
            Add your first subscription
          </button>
        </div>
      ) : (
        <>
          <Section title="Active" items={active} />
          <Section title="Paused" items={paused} />
          <Section title="Cancelled" items={cancelled} />
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            {/* Header — not scrollable */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <h2 className="text-base font-bold">{editingUid ? 'Edit Subscription' : 'Add Subscription'}</h2>
              <button
                onClick={closeModal}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Scrollable fields */}
            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
                {/* Name */}
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Netflix, Spotify"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm"
                    autoFocus
                  />
                  {errors.name && <p className="text-xs text-expense mt-1">{errors.name}</p>}
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ paddingLeft: '1.75rem' }}
                      className="w-full text-sm"
                    />
                  </div>
                  {errors.amount && <p className="text-xs text-expense mt-1">{errors.amount}</p>}
                </div>

                {/* Frequency */}
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Frequency</label>
                  <div className="flex gap-2 flex-wrap">
                    {FREQUENCIES.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setForm(prev => ({ ...prev, frequency: f.value }))}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          form.frequency === f.value
                            ? 'bg-primary text-white'
                            : 'bg-surface-light text-text-muted'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full text-sm"
                  />
                  {errors.startDate && <p className="text-xs text-expense mt-1">{errors.startDate}</p>}
                </div>

                {/* Category (optional) */}
                {categories && categories.length > 0 && (
                  <div>
                    <label className="text-xs text-text-muted font-medium block mb-1.5">Category (optional)</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full text-sm"
                    >
                      <option value="">None</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Note (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Family plan"
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save button — sticky footer, always visible above keyboard */}
            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handleSave}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                {editingUid ? 'Save Changes' : 'Add Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
