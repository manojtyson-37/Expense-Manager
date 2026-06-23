import Dexie, { type EntityTable } from 'dexie'

export interface Transaction {
  id?: number
  type: 'income' | 'expense'
  amount: number
  category: string
  note: string
  date: string // YYYY-MM-DD
  createdAt: number
}

export interface Category {
  id?: number
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
}

const db = new Dexie('ExpenseTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
}

db.version(1).stores({
  transactions: '++id, type, category, date, createdAt',
  categories: '++id, name, type',
})

export async function seedCategories() {
  const count = await db.categories.count()
  if (count > 0) return

  const defaults: Omit<Category, 'id'>[] = [
    { name: 'Salary', type: 'income', icon: '💰', color: '#10b981' },
    { name: 'Freelance', type: 'income', icon: '💻', color: '#06b6d4' },
    { name: 'Investment', type: 'income', icon: '📈', color: '#8b5cf6' },
    { name: 'Other Income', type: 'income', icon: '🎁', color: '#f59e0b' },
    { name: 'Food', type: 'expense', icon: '🍔', color: '#ef4444' },
    { name: 'Transport', type: 'expense', icon: '🚗', color: '#f97316' },
    { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#ec4899' },
    { name: 'Bills', type: 'expense', icon: '📄', color: '#6366f1' },
    { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#8b5cf6' },
    { name: 'Health', type: 'expense', icon: '🏥', color: '#14b8a6' },
    { name: 'Education', type: 'expense', icon: '📚', color: '#3b82f6' },
    { name: 'Groceries', type: 'expense', icon: '🛒', color: '#22c55e' },
    { name: 'Rent', type: 'expense', icon: '🏠', color: '#a855f7' },
    { name: 'Utilities', type: 'expense', icon: '⚡', color: '#eab308' },
    { name: 'Other', type: 'expense', icon: '📦', color: '#64748b' },
  ]

  await db.categories.bulkAdd(defaults)
}

export { db }
