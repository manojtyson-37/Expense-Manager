import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction } from '../db'

export function useTransactions(month?: string) {
  const transactions = useLiveQuery(async () => {
    let collection = db.transactions.orderBy('date').reverse()
    if (month) {
      const items = await collection.toArray()
      return items.filter(t => t.date.startsWith(month))
    }
    return collection.toArray()
  }, [month])

  const totals = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const filtered = month ? all.filter(t => t.date.startsWith(month)) : all
    const income = filtered
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expense = filtered
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    return { income, expense, balance: income - expense }
  }, [month])

  const categoryTotals = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const filtered = month ? all.filter(t => t.date.startsWith(month)) : all
    const map = new Map<string, { total: number; type: 'income' | 'expense' }>()
    for (const t of filtered) {
      const existing = map.get(t.category) || { total: 0, type: t.type }
      existing.total += t.amount
      map.set(t.category, existing)
    }
    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [month])

  return { transactions, totals, categoryTotals }
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>) {
  return db.transactions.add({ ...data, createdAt: Date.now() })
}

export async function updateTransaction(id: number, data: Partial<Transaction>) {
  return db.transactions.update(id, data)
}

export async function deleteTransaction(id: number) {
  return db.transactions.delete(id)
}
