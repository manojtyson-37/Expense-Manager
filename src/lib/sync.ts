import { supabase } from './supabase'
import { db, type Transaction, type Category, type Account, seedCategories, seedAccounts } from '../db'

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export { getUserId }

export async function syncFromCloud(userId: string) {
  try {
    const { data: cloudTxns, error: txnErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (txnErr) throw txnErr

    if (cloudTxns && cloudTxns.length > 0) {
      await db.transactions.clear()
      const local = cloudTxns.map(t => ({
        type: t.type as 'income' | 'expense',
        amount: Number(t.amount),
        category: t.category,
        account: t.account || '',
        note: t.note,
        date: t.date,
        createdAt: new Date(t.created_at).getTime(),
      }))
      await db.transactions.bulkAdd(local as Transaction[])
    }

    const { data: cloudCats, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)

    if (catErr) throw catErr

    if (cloudCats && cloudCats.length > 0) {
      await db.categories.clear()
      const local = cloudCats.map(c => ({
        name: c.name,
        type: c.type as 'income' | 'expense',
        icon: c.icon,
        color: c.color,
      }))
      await db.categories.bulkAdd(local as Category[])
    } else {
      const count = await db.categories.count()
      if (count === 0) await seedCategories()
    }

    const { data: cloudAccs, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)

    if (accErr) throw accErr

    if (cloudAccs && cloudAccs.length > 0) {
      await db.accounts.clear()
      const local = cloudAccs.map(a => ({
        name: a.name,
        type: a.type,
        icon: a.icon,
        color: a.color,
      }))
      await db.accounts.bulkAdd(local as Account[])
    } else {
      const count = await db.accounts.count()
      if (count === 0) await seedAccounts()
    }
  } catch (err) {
    console.error('Sync from cloud failed:', err)
  }
}

export async function pushTransaction(userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type: t.type,
    amount: t.amount,
    category: t.category,
    account: t.account || '',
    note: t.note,
    date: t.date,
  })
  if (error) console.error('Push transaction failed:', error)
}

export async function deleteCloudTransaction(userId: string, t: Transaction) {
  const { error } = await supabase.from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('date', t.date)
    .eq('amount', t.amount)
    .eq('category', t.category)
    .eq('note', t.note)
  if (error) console.error('Delete cloud transaction failed:', error)
}

export async function pushCategory(userId: string, c: Omit<Category, 'id'>) {
  const { error } = await supabase.from('categories').insert({
    user_id: userId,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
  })
  if (error) console.error('Push category failed:', error)
}

export async function deleteCloudCategory(userId: string, name: string) {
  const { error } = await supabase.from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('name', name)
  if (error) console.error('Delete cloud category failed:', error)
}

export async function pushAccount(userId: string, a: Omit<Account, 'id'>) {
  const { error } = await supabase.from('accounts').insert({
    user_id: userId,
    name: a.name,
    type: a.type,
    icon: a.icon,
    color: a.color,
  })
  if (error) console.error('Push account failed:', error)
}

export async function deleteCloudAccount(userId: string, name: string) {
  const { error } = await supabase.from('accounts')
    .delete()
    .eq('user_id', userId)
    .eq('name', name)
  if (error) console.error('Delete cloud account failed:', error)
}

export async function fullResync(userId: string) {
  try {
    const transactions = await db.transactions.toArray()
    const categories = await db.categories.toArray()
    const accounts = await db.accounts.toArray()

    await supabase.from('transactions').delete().eq('user_id', userId)
    await supabase.from('categories').delete().eq('user_id', userId)
    await supabase.from('accounts').delete().eq('user_id', userId)

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
  } catch (err) {
    console.error('Full resync failed:', err)
    throw err
  }
}
