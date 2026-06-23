import { supabase } from './supabase'
import { db, type Transaction, type Category, type Account, seedCategories } from '../db'

export async function syncToCloud(userId: string) {
  const transactions = await db.transactions.toArray()
  const categories = await db.categories.toArray()
  const accounts = await db.accounts.toArray()

  // Upsert transactions
  if (transactions.length > 0) {
    const rows = transactions.map(t => ({
      user_id: userId,
      type: t.type,
      amount: t.amount,
      category: t.category,
      account: t.account || '',
      note: t.note,
      date: t.date,
      created_at: new Date(t.createdAt).toISOString(),
    }))
    await supabase.from('transactions').insert(rows)
  }

  // Upsert categories
  if (categories.length > 0) {
    const rows = categories.map(c => ({
      user_id: userId,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    }))
    await supabase.from('categories').insert(rows)
  }

  // Upsert accounts
  if (accounts.length > 0) {
    const rows = accounts.map(a => ({
      user_id: userId,
      name: a.name,
      type: a.type,
      icon: a.icon,
      color: a.color,
    }))
    await supabase.from('accounts').insert(rows)
  }
}

export async function syncFromCloud(userId: string) {
  // Pull transactions
  const { data: cloudTxns } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (cloudTxns && cloudTxns.length > 0) {
    await db.transactions.clear()
    const local: Omit<Transaction, 'id'>[] = cloudTxns.map(t => ({
      type: t.type,
      amount: Number(t.amount),
      category: t.category,
      account: t.account || '',
      note: t.note,
      date: t.date,
      createdAt: new Date(t.created_at).getTime(),
    }))
    await db.transactions.bulkAdd(local as Transaction[])
  }

  // Pull categories
  const { data: cloudCats } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)

  if (cloudCats && cloudCats.length > 0) {
    await db.categories.clear()
    const local: Omit<Category, 'id'>[] = cloudCats.map(c => ({
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    }))
    await db.categories.bulkAdd(local as Category[])
  } else {
    await seedCategories()
  }

  // Pull accounts
  const { data: cloudAccs } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)

  if (cloudAccs && cloudAccs.length > 0) {
    await db.accounts.clear()
    const local: Omit<Account, 'id'>[] = cloudAccs.map(a => ({
      name: a.name,
      type: a.type,
      icon: a.icon,
      color: a.color,
    }))
    await db.accounts.bulkAdd(local as Account[])
  }
}

export async function pushTransaction(userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) {
  return supabase.from('transactions').insert({
    user_id: userId,
    type: t.type,
    amount: t.amount,
    category: t.category,
    account: t.account || '',
    note: t.note,
    date: t.date,
  })
}

export async function deleteCloudTransaction(userId: string, date: string, amount: number, category: string) {
  return supabase.from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('date', date)
    .eq('amount', amount)
    .eq('category', category)
    .limit(1)
}

export async function pushCategory(userId: string, c: Omit<Category, 'id'>) {
  return supabase.from('categories').insert({
    user_id: userId,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
  })
}

export async function pushAccount(userId: string, a: Omit<Account, 'id'>) {
  return supabase.from('accounts').insert({
    user_id: userId,
    name: a.name,
    type: a.type,
    icon: a.icon,
    color: a.color,
  })
}

export async function fullResync(userId: string) {
  // Clear cloud data and re-push everything from local
  await supabase.from('transactions').delete().eq('user_id', userId)
  await supabase.from('categories').delete().eq('user_id', userId)
  await supabase.from('accounts').delete().eq('user_id', userId)
  await syncToCloud(userId)
}
