import { useState } from 'react'
import { useCategories, addCategory, deleteCategory } from '../hooks/useCategories'
import { Trash2, Plus } from 'lucide-react'

const ICONS = ['💰', '💻', '📈', '🎁', '🍔', '🚗', '🛍️', '📄', '🎬', '🏥', '📚', '🛒', '🏠', '⚡', '📦', '✈️', '💊', '🎮', '👕', '💅']
const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#a855f7', '#64748b']

export default function Categories() {
  const categories = useCategories()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [icon, setIcon] = useState('📦')
  const [color, setColor] = useState('#6366f1')

  const incomeCategories = categories?.filter(c => c.type === 'income') || []
  const expenseCategories = categories?.filter(c => c.type === 'expense') || []

  async function handleAdd() {
    if (!name.trim()) return
    await addCategory({ name: name.trim(), type, icon, color })
    setName('')
    setShowAdd(false)
  }

  return (
    <div className="flex-1 px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Categories</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
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
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    icon === i ? 'bg-primary/20 ring-2 ring-primary' : 'bg-surface-light'
                  }`}
                >
                  {i}
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
            Add Category
          </button>
        </div>
      )}

      {/* Expense Categories */}
      <div className="mb-6">
        <h2 className="text-xs text-text-muted uppercase tracking-wider mb-2">Expenses</h2>
        <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
          {expenseCategories.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c.color + '20' }}
              >
                {c.icon}
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <button
                onClick={() => deleteCategory(c.id!)}
                className="p-2 text-text-muted active:text-expense"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Income Categories */}
      <div className="mb-6">
        <h2 className="text-xs text-text-muted uppercase tracking-wider mb-2">Income</h2>
        <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-surface-light">
          {incomeCategories.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c.color + '20' }}
              >
                {c.icon}
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <button
                onClick={() => deleteCategory(c.id!)}
                className="p-2 text-text-muted active:text-expense"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
