import Dexie, { type EntityTable } from 'dexie'

export interface Transaction {
  id?: number
  uid: string // stable cross-device id (local + cloud) — used for sync match, not Dexie's ++id
  type: 'income' | 'expense'
  amount: number
  category: string
  account: string
  note: string
  date: string // YYYY-MM-DD
  createdAt: number
}

export interface Subscription {
  id?: number
  uid: string // stable cross-device id (local + cloud)
  name: string
  amount: number
  type: 'income' | 'expense' // defaults to 'expense' for rows predating this field
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  status: 'active' | 'paused' | 'cancelled'
  category?: string
  account?: string
  note?: string
  createdAt: number
}

export interface PaymentRecord {
  amount: number
  date: string // YYYY-MM-DD
  createdAt: number
}

export interface Loan {
  id?: number
  uid: string // stable cross-device id (local + cloud)
  type: 'lent' | 'borrowed' // lent = they owe me; borrowed = I owe them
  person: string
  totalAmount: number
  date: string // YYYY-MM-DD
  dueDate?: string // YYYY-MM-DD
  status: 'pending' | 'returned'
  payments: PaymentRecord[]
  note?: string
  createdAt: number
}

export interface Goal {
  id?: number
  uid: string // stable cross-device id (local + cloud)
  name: string
  targetAmount: number
  targetDate?: string // YYYY-MM-DD
  savedAmount: number
  createdAt: number
}

export function newUid(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

export interface OutboxEntry {
  id?: number
  op: 'upsert' | 'insert' | 'delete'
  table: string
  uid?: string // present for uid-keyed tables (transactions/subscriptions/loans)
  matchEq?: Record<string, string> // delete match for non-uid tables (categories/accounts/budgets), e.g. { name: 'Food' }
  matchNeq?: Record<string, string> // delete exclusion, e.g. { type: '_deleted' } to spare a tombstone row
  userId: string
  payload?: Record<string, unknown>
  createdAt: number
  attempts?: number
}

const db = new Dexie('ExpenseTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  accounts: EntityTable<Account, 'id'>
  budgets: EntityTable<Budget, 'id'>
  subscriptions: EntityTable<Subscription, 'id'>
  loans: EntityTable<Loan, 'id'>
  outbox: EntityTable<OutboxEntry, 'id'>
  goals: EntityTable<Goal, 'id'>
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

// v4: stable uid on transactions. Backfill existing rows so every txn has one.
db.version(4).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
}).upgrade(async tx => {
  await tx.table('transactions').toCollection().modify(t => {
    if (!t.uid) t.uid = newUid()
  })
})

// v5: add Subscriptions and Loans tables. No backfill needed — new tables.
db.version(5).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
  subscriptions: '++id, uid, status, startDate, createdAt',
  loans: '++id, uid, person, status, date, createdAt',
}).upgrade(async () => {
  // No backfill needed — new tables
})

// v6: add type field to loans ('lent' | 'borrowed'). Backfill existing as 'lent'.
db.version(6).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
  subscriptions: '++id, uid, status, startDate, createdAt',
  loans: '++id, uid, type, person, status, date, createdAt',
}).upgrade(async tx => {
  await tx.table('loans').toCollection().modify((loan: Loan) => {
    if (!loan.type) loan.type = 'lent'
  })
})

// v7: add outbox table for offline-first mutations.
db.version(7).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
  subscriptions: '++id, uid, status, startDate, createdAt',
  loans: '++id, uid, type, person, status, date, createdAt',
  outbox: '++id, table, uid, createdAt',
})

// v8: add type to subscriptions (backfill existing rows as 'expense', the
// only kind that existed before this field). Add goals table (new — no
// backfill needed).
db.version(8).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
  subscriptions: '++id, uid, status, startDate, createdAt',
  loans: '++id, uid, type, person, status, date, createdAt',
  outbox: '++id, table, uid, createdAt',
  goals: '++id, uid, createdAt',
}).upgrade(async tx => {
  await tx.table('subscriptions').toCollection().modify((sub: Subscription) => {
    if (!sub.type) sub.type = 'expense'
  })
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
