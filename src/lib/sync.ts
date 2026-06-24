import { supabase } from './supabase'
import { db, type Transaction, type Category, type Account, seedAccounts, DEFAULT_CATEGORIES } from '../db'

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export { getUserId }

async function ensureDefaultCategories(userId: string) {
  // Check both local and cloud to avoid duplicates
  const existing = await db.categories.toArray()
  const existingNames = new Set(existing.map(c => c.name))

  const { data: allCloud } = await supabase
    .from('categories')
    .select('name, type')
    .eq('user_id', userId)
  const cloudNames = new Set((allCloud || []).map(c => c.name))
  const deletedNames = new Set(
    (allCloud || []).filter(c => c.type === '_deleted').map(c => c.name)
  )

  // Only add defaults missing from BOTH local and cloud, and not tombstoned
  const missingLocal = DEFAULT_CATEGORIES.filter(c =>
    !existingNames.has(c.name) && !deletedNames.has(c.name)
  )
  const missingCloud = DEFAULT_CATEGORIES.filter(c =>
    !cloudNames.has(c.name) && !deletedNames.has(c.name)
  )

  if (missingLocal.length > 0) {
    await db.categories.bulkAdd(missingLocal as Category[])
  }

  if (missingCloud.length > 0) {
    const rows = missingCloud.map(c => ({
      user_id: userId, name: c.name, type: c.type, icon: c.icon, color: c.color,
    }))
    await supabase.from('categories').insert(rows)
  }
}

export async function syncFromCloud(userId: string) {
  try {
    // Fetch ALL data from cloud first — don't touch local until everything succeeds
    const { data: cloudTxns, error: txnErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    if (txnErr) throw txnErr

    const { data: cloudCats, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
    if (catErr) throw catErr

    const { data: cloudAccs, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
    if (accErr) throw accErr

    // All fetches succeeded — now safe to write to local DB
    if (cloudTxns && cloudTxns.length > 0) {
      await db.transactions.clear()
      await db.transactions.bulkAdd(cloudTxns.map(t => ({
        type: t.type as 'income' | 'expense',
        amount: Number(t.amount),
        category: t.category,
        account: t.account || '',
        note: t.note,
        date: t.date,
        createdAt: new Date(t.created_at).getTime(),
      })) as Transaction[])
    }

    const activeCats = (cloudCats || []).filter(c => c.type !== '_deleted')
    const seen = new Set<string>()
    const dedupedCats = activeCats.filter(c => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
    if (dedupedCats.length > 0) {
      await db.categories.clear()
      await db.categories.bulkAdd(dedupedCats.map(c => ({
        name: c.name,
        type: c.type as 'income' | 'expense',
        icon: c.icon,
        color: c.color,
      })) as Category[])
    } else {
      await ensureDefaultCategories(userId)
    }

    if (cloudAccs && cloudAccs.length > 0) {
      await db.accounts.clear()
      await db.accounts.bulkAdd(cloudAccs.map(a => ({
        name: a.name,
        type: a.type,
        icon: a.icon,
        color: a.color,
      })) as Account[])
    } else {
      const count = await db.accounts.count()
      if (count === 0) await seedAccounts()
      const localAccs = await db.accounts.toArray()
      if (localAccs.length > 0) {
        await supabase.from('accounts').insert(
          localAccs.map(a => ({ user_id: userId, name: a.name, type: a.type, icon: a.icon, color: a.color }))
        )
      }
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

  // If it's a default category, insert tombstone so it doesn't come back
  const isDefault = DEFAULT_CATEGORIES.some(c => c.name === name)
  if (isDefault) {
    await supabase.from('categories').insert({
      user_id: userId,
      name,
      type: '_deleted',
      icon: '',
      color: '',
    })
  }
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
