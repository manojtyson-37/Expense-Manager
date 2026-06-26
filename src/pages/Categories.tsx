import IconRenderer from '../components/IconRenderer'
import { useState } from 'react'
import { useCategories, addCategory, updateCategory, deleteCategory } from '../hooks/useCategories'
import type { Category } from '../db'
import { Plus, X, Pencil } from 'lucide-react'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'

const ICONS = ['💰', '💻', '📈', '🎁', '🍔', '🚗', '🛍️', '📄', '🎬', '🏥', '📚', '🛒', '🏠', '⚡', '📦', '✈️', '💊', '🎮', '👕', '💅']
const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#a855f7', '#64748b']

export default function Categories() {
  const categories = useCategories()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [icon, setIcon] = useState('📦')
  const [color, setColor] = useState('#6366f1')
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const incomeCategories = categories?.filter(c => c.type === 'income') || []
  const expenseCategories = categories?.filter(c => c.type === 'expense') || []

  function openAdd() {
    setEditingId(null)
    setName('')
    setType('expense')
    setIcon('📦')
    setColor('#6366f1')
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id!)
    setName(cat.name)
    setType(cat.type)
    setIcon(cat.icon)
    setColor(cat.color)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit() {
    if (!name.trim()) return
    if (editingId) {
      await updateCategory(editingId, { name: name.trim(), type, icon, color })
    } else {
      await addCategory({ name: name.trim(), type, icon, color })
    }
    closeForm()
  }

  function handleDelete(cat: Category) {
    scheduleDelete(
      `"${cat.name}" deleted`,
      () => deleteCategory(cat.id!),
      () => addCategory({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color }),
    )
  }

  function renderList(items: Category[], label: string) {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <h2 className="text-xs text-text-muted uppercase tracking-wider mb-2">{label}</h2>
        <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
          {items.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 active:bg-surface-light/50 cursor-pointer" onClick={() => openEdit(c)}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c.color + '20' }}
              >
                <IconRenderer icon={c.icon} size={18} />
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <span className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted"><Pencil size={15} /></span>
              <DeleteButton onConfirm={() => handleDelete(c)} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Categories</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={closeForm}>
        <div className="bg-surface rounded-t-2xl p-4 space-y-3 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{editingId ? 'Edit Category' : 'Add Category'}</span>
            <button onClick={closeForm} className="p-3 -m-2 text-text-muted min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={18} /></button>
          </div>
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === t
                    ? t === 'expense' ? 'bg-expense text-white' : 'bg-income text-white'
                    : 'bg-surface-light text-text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name"
          />
          <div>
            <label className="text-xs text-text-muted block mb-1">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                    icon === i ? 'bg-primary/20 ring-2 ring-primary' : 'bg-surface-light'
                  }`}
                >
                  <IconRenderer icon={i} size={20} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-11 h-11 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-primary rounded-xl text-white font-medium"
          >
            {editingId ? 'Save Changes' : 'Add Category'}
          </button>
        </div>
        </div>
      )}

      {renderList(expenseCategories, 'Expenses')}
      {renderList(incomeCategories, 'Income')}

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
