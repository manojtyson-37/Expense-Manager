import Dexie, { type EntityTable } from 'dexie'

export interface Transaction {
  id?: number
  type: 'income' | 'expense'
  amount: number
  category: string
  account: string
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

export type AccountType = 'credit_card' | 'upi' | 'cash' | 'bank' | 'wallet'

export interface Account {
  id?: number
  name: string
  type: AccountType
  icon: string
  color: string
}

export interface Budget {
  id?: number
  category: string
  limit: number
  month: string // YYYY-MM
}

const db = new Dexie('ExpenseTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  accounts: EntityTable<Account, 'id'>
  budgets: EntityTable<Budget, 'id'>
}

db.version(1).stores({
  transactions: '++id, type, category, date, createdAt',
  categories: '++id, name, type',
})

db.version(2).stores({
  transactions: '++id, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
})

db.version(3).stores({
  transactions: '++id, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
})

export async function seedAccounts() {
  const count = await db.accounts.count()
  if (count > 0) return

  const defaults: Omit<Account, 'id'>[] = [
    { name: 'Cash', type: 'cash', icon: '💵', color: '#22c55e' },
  ]
  await db.accounts.bulkAdd(defaults)
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
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

export async function seedCategories() {
  const count = await db.categories.count()
  if (count > 0) return
  await db.categories.bulkAdd(DEFAULT_CATEGORIES)
}

export { db }
