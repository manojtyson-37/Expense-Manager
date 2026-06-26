import { supabase } from './supabase'
import { db, newUid, type Transaction, type Category, type Account, type Budget, seedAccounts, DEFAULT_CATEGORIES } from '../db'

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export { getUserId }

async function ensureDefaultCategories(userId: string) {
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
    await supabase.from('categories').insert(
      missingCloud.map(c => ({ user_id: userId, name: c.name, type: c.type, icon: c.icon, color: c.color }))
    )
  }
}

function txnKey(t: { type: string; amount: number; category: string; account?: string; note: string; date: string }): string {
  return [t.type, t.amount, t.category, t.account || '', t.note, t.date].join('|')
}

export async function syncFromCloud(userId: string) {
  try {
    const { data: cloudTxns, error: txnErr } = await supabase
      .from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
    if (txnErr) throw txnErr

    const { data: cloudCats, error: catErr } = await supabase
      .from('categories').select('*').eq('user_id', userId)
    if (catErr) throw catErr

    const { data: cloudAccs, error: accErr } = await supabase
      .from('accounts').select('*').eq('user_id', userId)
    if (accErr) throw accErr

    // MERGE GUARD: push local-only rows to cloud BEFORE the destructive
    // clear()+replace below, so data added on this device (or whose earlier
    // push silently failed) is never wiped by a stale cloud snapshot. The
    // replace set then becomes the union of cloud + local.
    // ponytail: a row deleted on another device but still present locally gets
    // resurrected here — no tombstones for txns/accounts to detect that. Accept
    // resurrection over data loss; add per-row sync flags if it ever matters.
    // IDENTITY MODEL: a transaction's `uid` is the stable handle used to UPDATE
    // and DELETE the exact row (so an edit lands on the same row — fixes the
    // original edit-duplicate bug). But MERGE/DEDUP here is by CONTENT key:
    // identical rows collapse into one (product decision), and a row whose uid
    // diverged between local and cloud (e.g. independent backfills) does NOT
    // double — content matches, so it's treated as the same row.
    const cloudRows: any[] = (cloudTxns || []).map(t => ({ ...t, amount: Number(t.amount), uid: t.uid || newUid() }))
    const localTxns = await db.transactions.toArray()

    // Push local rows whose CONTENT isn't in cloud yet (push is upsert-by-uid,
    // so a racing double-push of the same row is idempotent — no duplicate).
    const cloudKeys = new Set(cloudRows.map(txnKey))
    for (const t of localTxns) {
      if (cloudKeys.has(txnKey(t))) continue
      const uid = t.uid || newUid()
      await pushTransaction(userId, {
        uid, type: t.type, amount: t.amount, category: t.category,
        account: t.account, note: t.note, date: t.date,
      })
      cloudKeys.add(txnKey(t))
      cloudRows.push({ ...t, uid, created_at: new Date(t.createdAt).toISOString() })
    }

    // Dedup by CONTENT key (collapses identical rows + uid-divergence dups).
    const seenTxnKey = new Set<string>()
    const txns = cloudRows.filter(r => {
      const k = txnKey(r)
      if (seenTxnKey.has(k)) return false
      seenTxnKey.add(k)
      return true
    })

    const cats: any[] = [...(cloudCats || [])]
    // Compare against ACTIVE cloud names only. A local category that matches a
    // _deleted tombstone is one the user re-added after deleting — pushCategory
    // clears the tombstone so it resurrects instead of being wiped by the
    // clear()+replace below.
    const cloudActiveCatNames = new Set(
      cats.filter(c => c.type !== '_deleted').map(c => c.name)
    )
    for (const c of await db.categories.toArray()) {
      if (cloudActiveCatNames.has(c.name)) continue
      await pushCategory(userId, { name: c.name, type: c.type, icon: c.icon, color: c.color })
      cats.push(c)
    }

    const accs: any[] = [...(cloudAccs || [])]
    const cloudAccNames = new Set(accs.map(a => a.name))
    for (const a of await db.accounts.toArray()) {
      if (cloudAccNames.has(a.name)) continue
      await pushAccount(userId, { name: a.name, type: a.type, icon: a.icon, color: a.color })
      accs.push(a)
    }

    // Replace local with the merged set (safe now: includes local-only rows)
    if (txns.length > 0) {
      await db.transactions.clear()
      await db.transactions.bulkAdd(txns.map(t => ({
        uid: t.uid,
        type: t.type as 'income' | 'expense',
        amount: Number(t.amount),
        category: t.category,
        account: t.account || '',
        note: t.note,
        date: t.date,
        createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
      })) as Transaction[])
    }

    const activeCats = cats.filter(c => c.type !== '_deleted')
    const seen = new Set<string>()
    const dedupedCats = activeCats.filter(c => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
    if (dedupedCats.length > 0) {
      await db.categories.clear()
      await db.categories.bulkAdd(dedupedCats.map(c => ({
        name: c.name, type: c.type as 'income' | 'expense', icon: c.icon, color: c.color,
      })) as Category[])
    } else {
      await ensureDefaultCategories(userId)
    }

    if (accs.length > 0) {
      // Dedup by name
      const seenAcc = new Set<string>()
      const dedupedAccs = accs.filter(a => {
        if (seenAcc.has(a.name)) return false
        seenAcc.add(a.name)
        return true
      })
      await db.accounts.clear()
      await db.accounts.bulkAdd(dedupedAccs.map(a => ({
        name: a.name, type: a.type, icon: a.icon, color: a.color,
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

    // Pull budgets
    const { data: cloudBudgets } = await supabase
      .from('budgets').select('*').eq('user_id', userId)
    if (cloudBudgets && cloudBudgets.length > 0) {
      await db.budgets.clear()
      await db.budgets.bulkAdd(cloudBudgets.map(b => ({
        category: b.category,
        limit: Number(b.limit_amount),
        month: b.month,
      })) as Budget[])
    }
  } catch (err) {
    console.error('Sync from cloud failed:', err)
  }
}

export async function pushTransaction(userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) {
  // upsert on (user_id, uid): pushing the same row twice (e.g. add + a racing
  // sync re-push) updates in place instead of creating a duplicate row.
  const { error } = await supabase.from('transactions').upsert({
    user_id: userId, uid: t.uid, type: t.type, amount: t.amount, category: t.category,
    account: t.account || '', note: t.note, date: t.date,
  }, { onConflict: 'user_id,uid' })
  if (error) console.error('Push transaction failed:', error)
}

// Edit: update the cloud row with this uid in place; insert if it doesn't
// exist yet (created offline or before the uid migration).
export async function upsertCloudTransaction(userId: string, t: Transaction) {
  const { data, error } = await supabase.from('transactions')
    .update({
      type: t.type, amount: t.amount, category: t.category,
      account: t.account || '', note: t.note, date: t.date,
    })
    .eq('user_id', userId).eq('uid', t.uid)
    .select('id')
  if (error) { console.error('Upsert transaction failed:', error); return }
  if (!data || data.length === 0) {
    await pushTransaction(userId, {
      uid: t.uid, type: t.type, amount: t.amount, category: t.category,
      account: t.account, note: t.note, date: t.date,
    })
  }
}

export async function deleteCloudTransaction(userId: string, t: Transaction) {
  if (t.uid) {
    const { error } = await supabase.from('transactions')
      .delete().eq('user_id', userId).eq('uid', t.uid)
    if (error) console.error('Delete cloud transaction failed:', error)
    return
  }
  // Legacy fallback for pre-uid rows: match by all fields.
  const { error } = await supabase.from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('date', t.date)
    .eq('amount', t.amount)
    .eq('category', t.category)
    .eq('account', t.account || '')
    .eq('note', t.note)
    .eq('type', t.type)
  if (error) console.error('Delete cloud transaction failed:', error)
}

export async function pushCategory(userId: string, c: Omit<Category, 'id'>) {
  // Re-adding a category clears any prior _deleted tombstone for that name, so
  // the tombstone can't suppress it on the next sync (root cause of re-added
  // tags vanishing after login).
  await supabase.from('categories')
    .delete().eq('user_id', userId).eq('name', c.name).eq('type', '_deleted')
  const { error } = await supabase.from('categories').insert({
    user_id: userId, name: c.name, type: c.type, icon: c.icon, color: c.color,
  })
  if (error) console.error('Push category failed:', error)
}

export async function deleteCloudCategory(userId: string, name: string) {
  // Insert tombstone FIRST for defaults (before deleting), so if delete fails, tombstone still prevents re-add
  const isDefault = DEFAULT_CATEGORIES.some(c => c.name === name)
  if (isDefault) {
    await supabase.from('categories').insert({
      user_id: userId, name, type: '_deleted', icon: '', color: '',
    })
  }
  const { error } = await supabase.from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('name', name)
    .neq('type', '_deleted')
  if (error) console.error('Delete cloud category failed:', error)
}

export async function pushAccount(userId: string, a: Omit<Account, 'id'>) {
  const { error } = await supabase.from('accounts').insert({
    user_id: userId, name: a.name, type: a.type, icon: a.icon, color: a.color,
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
  // Snapshot local data first
  const transactions = await db.transactions.toArray()
  const categories = await db.categories.toArray()
  const accounts = await db.accounts.toArray()

  try {
    await supabase.from('transactions').delete().eq('user_id', userId)
    await supabase.from('categories').delete().eq('user_id', userId)
    await supabase.from('accounts').delete().eq('user_id', userId)

    if (transactions.length > 0) {
      await supabase.from('transactions').insert(transactions.map(t => ({
        user_id: userId, uid: t.uid, type: t.type, amount: t.amount, category: t.category,
        account: t.account || '', note: t.note, date: t.date,
        created_at: new Date(t.createdAt).toISOString(),
      })))
    }
    if (categories.length > 0) {
      await supabase.from('categories').insert(categories.map(c => ({
        user_id: userId, name: c.name, type: c.type, icon: c.icon, color: c.color,
      })))
    }
    if (accounts.length > 0) {
      await supabase.from('accounts').insert(accounts.map(a => ({
        user_id: userId, name: a.name, type: a.type, icon: a.icon, color: a.color,
      })))
    }
  } catch (err) {
    console.error('Full resync failed, data still in local DB:', err)
    throw err
  }
}

export async function clearAllData(userId: string) {
  // Cloud first, then local — if cloud fails, local data preserved
  await supabase.from('transactions').delete().eq('user_id', userId)
  await supabase.from('categories').delete().eq('user_id', userId)
  await supabase.from('accounts').delete().eq('user_id', userId)
  await db.transactions.clear()
  await db.categories.clear()
  await db.accounts.clear()
}
