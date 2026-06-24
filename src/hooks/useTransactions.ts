import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction } from '../db'
import { getUserId, pushTransaction, deleteCloudTransaction } from '../lib/sync'

export function useTransactions(month?: string) {
  const transactions = useLiveQuery(async () => {
    const collection = db.transactions.orderBy('date').reverse()
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
      const key = `${t.type}:${t.category}`
      const existing = map.get(key) || { total: 0, type: t.type }
      existing.total += t.amount
      map.set(key, existing)
    }
    return Array.from(map.entries())
      .map(([key, data]) => ({ category: key.split(':').slice(1).join(':'), ...data }))
      .sort((a, b) => b.total - a.total)
  }, [month])

  return { transactions, totals, categoryTotals }
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>) {
  const id = await db.transactions.add({ ...data, createdAt: Date.now() })
  const userId = await getUserId()
  if (userId) {
    pushTransaction(userId, data).catch(console.error)
  }
  return id
}

export async function updateTransaction(id: number, data: Partial<Transaction>) {
  const old = await db.transactions.get(id)
  await db.transactions.update(id, data)
  const userId = await getUserId()
  if (userId && old) {
    try {
      await deleteCloudTransaction(userId, old)
      const updated = await db.transactions.get(id)
      if (updated) {
        await pushTransaction(userId, {
          type: updated.type, amount: updated.amount, category: updated.category,
          account: updated.account, note: updated.note, date: updated.date,
        })
      }
    } catch (err) {
      // Re-push old record if delete succeeded but insert failed
      pushTransaction(userId, {
        type: old.type, amount: old.amount, category: old.category,
        account: old.account, note: old.note, date: old.date,
      }).catch(console.error)
      console.error('Update cloud transaction failed:', err)
    }
  }
}

export async function deleteTransaction(id: number) {
  const t = await db.transactions.get(id)
  await db.transactions.delete(id)
  const userId = await getUserId()
  if (userId && t) {
    deleteCloudTransaction(userId, t).catch(console.error)
  }
}
