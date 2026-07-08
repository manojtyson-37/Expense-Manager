import { useState } from 'react'
import { ArrowLeft, Plus, Target, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGoals, addGoal, updateGoal, addToGoalSaved, deleteGoal } from '../hooks/useGoals'
import { useCurrency } from '../lib/CurrencyContext'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import type { Goal } from '../db'

interface FormState {
  name: string
  targetAmount: string
  targetDate: string
}

interface AddFormState {
  amount: string
}

const emptyForm = (): FormState => ({ name: '', targetAmount: '', targetDate: '' })
const emptyAddForm = (): AddFormState => ({ amount: '' })

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface GoalCardProps {
  goal: Goal
  format: (n: number) => string
  onEdit: (goal: Goal) => void
  onAddSaved: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

function GoalCard({ goal, format, onEdit, onAddSaved, onDelete }: GoalCardProps) {
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
  const complete = goal.savedAmount >= goal.targetAmount

  return (
    <div className="bg-surface rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{goal.name}</span>
            {complete && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-income bg-income/10">
                Complete
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-base font-bold">{format(goal.savedAmount)}</span>
            <span className="text-xs text-text-muted">of {format(goal.targetAmount)}</span>
          </div>
          {goal.targetDate && (
            <p className="text-xs text-text-muted mt-0.5">Target {fmtDate(goal.targetDate)}</p>
          )}
        </div>
        <div className="flex items-center gap-0 shrink-0">
          {!complete && (
            <button
              onClick={() => onAddSaved(goal)}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] flex items-center justify-center whitespace-nowrap bg-income/10 text-income"
            >
              Add Savings
            </button>
          )}
          <button
            onClick={() => onEdit(goal)}
            className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted active:text-primary"
          >
            <Pencil size={15} />
          </button>
          <DeleteButton onConfirm={() => onDelete(goal)} size={14} />
        </div>
      </div>
      <div className="h-2 bg-surface-light rounded-full overflow-hidden mt-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: complete ? 'var(--color-income)' : 'var(--color-primary)' }}
        />
      </div>
    </div>
  )
}

export default function Goals() {
  const navigate = useNavigate()
  const { goals } = useGoals()
  const { format, symbol } = useCurrency()
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [editingUid, setEditingUid] = useState<string | null>(null)

  const [savedGoal, setSavedGoal] = useState<Goal | null>(null)
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm())
  const [addError, setAddError] = useState<string | undefined>()

  function openAdd() {
    setForm(emptyForm())
    setErrors({})
    setEditingUid(null)
    setShowAddModal(true)
  }

  function openEdit(goal: Goal) {
    setForm({ name: goal.name, targetAmount: String(goal.targetAmount), targetDate: goal.targetDate ?? '' })
    setErrors({})
    setEditingUid(goal.uid)
    setShowAddModal(true)
  }

  function closeModal() {
    setShowAddModal(false)
    setForm(emptyForm())
    setErrors({})
    setEditingUid(null)
  }

  function validate(): boolean {
    const e: Partial<FormState> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    const amt = parseFloat(form.targetAmount)
    if (isNaN(amt) || amt <= 0) e.targetAmount = 'Enter an amount greater than 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const amt = parseFloat(form.targetAmount)
    if (editingUid) {
      await updateGoal(editingUid, {
        name: form.name.trim(),
        targetAmount: amt,
        targetDate: form.targetDate || undefined,
      })
    } else {
      await addGoal(form.name.trim(), amt, form.targetDate || undefined)
    }
    closeModal()
  }

  function openAddSaved(goal: Goal) {
    setSavedGoal(goal)
    setAddForm(emptyAddForm())
    setAddError(undefined)
  }

  function closeAddSaved() {
    setSavedGoal(null)
    setAddForm(emptyAddForm())
    setAddError(undefined)
  }

  async function handleAddSaved() {
    const amt = parseFloat(addForm.amount)
    if (isNaN(amt) || amt <= 0) {
      setAddError('Enter an amount greater than 0')
      return
    }
    if (savedGoal) await addToGoalSaved(savedGoal.uid, amt)
    closeAddSaved()
  }

  function handleDelete(goal: Goal) {
    scheduleDelete(
      `"${goal.name}" deleted`,
      () => deleteGoal(goal.uid),
      () => {},
    )
  }

  return (
    <div className="flex-1 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">Goals</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* List */}
      {goals === undefined ? (
        <div className="text-center text-text-muted py-12 text-sm">Loading...</div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Target size={36} className="text-text-muted opacity-40" />
          <p className="text-text-muted text-sm">No savings goals yet</p>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium mt-1"
          >
            Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => (
            <GoalCard key={g.uid} goal={g} format={format} onEdit={openEdit} onAddSaved={openAddSaved} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <h2 className="text-base font-bold">{editingUid ? 'Edit Goal' : 'Add Goal'}</h2>
              <button
                onClick={closeModal}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Emergency fund, New laptop"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm"
                    autoFocus
                  />
                  {errors.name && <p className="text-xs text-expense mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Target Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.targetAmount}
                      onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                      style={{ paddingLeft: '1.75rem' }}
                      className="w-full text-sm"
                    />
                  </div>
                  {errors.targetAmount && <p className="text-xs text-expense mt-1">{errors.targetAmount}</p>}
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Target Date (optional)</label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handleSave}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                {editingUid ? 'Save Changes' : 'Add Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Savings Modal */}
      {savedGoal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeAddSaved() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold">Add Savings</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {savedGoal.name} · {format(Math.max(0, savedGoal.targetAmount - savedGoal.savedAmount))} remaining
                </p>
              </div>
              <button
                onClick={closeAddSaved}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={addForm.amount}
                      onChange={e => setAddForm({ amount: e.target.value })}
                      style={{ paddingLeft: '1.75rem' }}
                      className="w-full text-sm"
                      autoFocus
                    />
                  </div>
                  {addError && <p className="text-xs text-expense mt-1">{addError}</p>}
                </div>
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handleAddSaved}
                className="w-full py-3 bg-income text-white rounded-xl text-sm font-semibold"
              >
                Add Savings
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
