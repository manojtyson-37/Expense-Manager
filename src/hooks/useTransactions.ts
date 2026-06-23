import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction } from '../db'
import { supabase } from '../lib/supabase'
import { pushTransaction } from '../lib/sync'

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

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id
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
    // Delete old + insert updated
    await supabase.from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('date', old.date)
      .eq('amount', old.amount)
      .eq('category', old.category)
      .eq('created_at', new Date(old.createdAt).toISOString())
    const updated = await db.transactions.get(id)
    if (updated) {
      pushTransaction(userId, {
        type: updated.type,
        amount: updated.amount,
        category: updated.category,
        account: updated.account,
        note: updated.note,
        date: updated.date,
      }).catch(console.error)
    }
  }
}

export async function deleteTransaction(id: number) {
  const t = await db.transactions.get(id)
  await db.transactions.delete(id)
  const userId = await getUserId()
  if (userId && t) {
    supabase.from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('date', t.date)
      .eq('amount', t.amount)
      .eq('category', t.category)
      .catch(console.error)
  }
}
