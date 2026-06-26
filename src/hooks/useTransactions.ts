import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUid, type Transaction } from '../db'
import { getUserId, pushTransaction, upsertCloudTransaction, deleteCloudTransaction } from '../lib/sync'

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

export interface AccountInsight {
  name: string
  type: string
  icon: string
  color: string
  isCredit: boolean
  spent: number   // expense out of this account
  received: number // income into this account (for cards: payments/refunds)
  outstanding: number // credit cards: spent - received (what you owe)
  net: number     // non-credit: received - spent (cash you hold)
  byCategory: { category: string; total: number }[] // expense breakdown
}

// Per-account spend + the split balance model:
//   cashBalance      = income - expense across NON-credit accounts only
//   creditOutstanding = sum of what's owed across credit-card accounts
// Credit-card spend never reduces cashBalance — it's a liability, shown apart.
export function useAccountInsights(month?: string) {
  return useLiveQuery(async () => {
    const accounts = await db.accounts.toArray()
    const typeByName = new Map(accounts.map(a => [a.name, a.type]))

    const all = await db.transactions.toArray()
    const txns = month ? all.filter(t => t.date.startsWith(month)) : all

    const map = new Map<string, AccountInsight>()
    const ensure = (name: string): AccountInsight => {
      let ins = map.get(name)
      if (!ins) {
        const acc = accounts.find(a => a.name === name)
        ins = {
          name,
          type: acc?.type || 'cash',
          icon: acc?.icon || '💵',
          color: acc?.color || '#64748b',
          isCredit: (typeByName.get(name) || 'cash') === 'credit_card',
          spent: 0, received: 0, outstanding: 0, net: 0, byCategory: [],
        }
        map.set(name, ins)
      }
      return ins
    }

    const catMaps = new Map<string, Map<string, number>>()
    for (const t of txns) {
      const name = t.account || 'Cash'
      const ins = ensure(name)
      if (t.type === 'expense') {
        ins.spent += t.amount
        const cm = catMaps.get(name) || new Map<string, number>()
        cm.set(t.category, (cm.get(t.category) || 0) + t.amount)
        catMaps.set(name, cm)
      } else {
        ins.received += t.amount
      }
    }

    let cashBalance = 0
    let creditOutstanding = 0
    for (const ins of map.values()) {
      ins.outstanding = ins.spent - ins.received
      ins.net = ins.received - ins.spent
      ins.byCategory = Array.from((catMaps.get(ins.name) || new Map()).entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
      if (ins.isCredit) creditOutstanding += ins.outstanding
      else cashBalance += ins.net
    }

    const list = Array.from(map.values()).sort((a, b) => b.spent - a.spent)
    return {
      accounts: list,
      creditCards: list.filter(a => a.isCredit),
      cashBalance,
      creditOutstanding,
    }
  }, [month])
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'uid'>) {
  const uid = newUid()
  const id = await db.transactions.add({ ...data, uid, createdAt: Date.now() })
  const userId = await getUserId()
  if (userId) {
    pushTransaction(userId, { ...data, uid }).catch(console.error)
  }
  return id
}

// Address rows by stable `uid`, never the Dexie auto-id: syncFromCloud does
// clear()+bulkAdd which REASSIGNS every local id, so an id captured before a
// sync points at the wrong row afterwards (root cause of "edit didn't update").
export async function updateTransaction(uid: string, data: Partial<Transaction>) {
  const row = await db.transactions.where('uid').equals(uid).first()
  if (!row) return
  await db.transactions.update(row.id!, data)
  const updated = await db.transactions.get(row.id!)
  const userId = await getUserId()
  // Edit in place by uid — single upsert, no delete+insert.
  if (userId && updated) {
    upsertCloudTransaction(userId, updated).catch(console.error)
  }
}

export async function deleteTransaction(uid: string) {
  const t = await db.transactions.where('uid').equals(uid).first()
  if (!t) return
  await db.transactions.delete(t.id!)
  const userId = await getUserId()
  if (userId) {
    deleteCloudTransaction(userId, t).catch(console.error)
  }
}
