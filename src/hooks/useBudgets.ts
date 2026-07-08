import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/sync'
import { queueOp } from '../lib/outbox'

export function useBudgets(month: string) {
  return useLiveQuery(async () => {
    return db.budgets.where('month').equals(month).toArray()
  }, [month])
}

export async function setBudget(category: string, limit: number, month: string, rollover = false) {
  const existing = await db.budgets.where({ category, month }).first()
  if (existing) {
    await db.budgets.update(existing.id!, { limit, rollover })
  } else {
    await db.budgets.add({ category, limit, month, rollover })
  }

  const userId = await getUserId()
  if (!userId) return
  if (!navigator.onLine) {
    await queueOp({ op: 'delete', table: 'budgets', userId, matchEq: { category, month } })
    await queueOp({
      op: 'insert', table: 'budgets', userId,
      payload: { user_id: userId, category, limit_amount: limit, month, rollover },
    })
    return
  }
  const { error: delErr } = await supabase.from('budgets').delete()
    .eq('user_id', userId).eq('category', category).eq('month', month)
  if (delErr) console.error('Set budget: clearing old cloud row failed:', delErr)
  const { error: insErr } = await supabase.from('budgets').insert({
    user_id: userId, category, limit_amount: limit, month, rollover,
  })
  if (insErr) console.error('Set budget: cloud insert failed:', insErr)
}

// Copies every budget from `fromMonth` into `toMonth`, skipping categories
// already budgeted in toMonth — safe to call repeatedly (idempotent, never
// overwrites something the user already set this month).
export async function copyBudgetsFromMonth(fromMonth: string, toMonth: string): Promise<number> {
  const source = await db.budgets.where('month').equals(fromMonth).toArray()
  const existingCategories = new Set((await db.budgets.where('month').equals(toMonth).toArray()).map(b => b.category))
  let copied = 0
  for (const b of source) {
    if (existingCategories.has(b.category)) continue
    await setBudget(b.category, b.limit, toMonth, b.rollover ?? false)
    copied++
  }
  return copied
}

export async function deleteBudget(id: number) {
  const b = await db.budgets.get(id)
  await db.budgets.delete(id)
  const userId = await getUserId()
  if (!userId || !b) return
  if (!navigator.onLine) {
    await queueOp({ op: 'delete', table: 'budgets', userId, matchEq: { category: b.category, month: b.month } })
    return
  }
  const { error } = await supabase.from('budgets').delete()
    .eq('user_id', userId).eq('category', b.category).eq('month', b.month)
  if (error) console.error('Delete budget: cloud delete failed:', error)
}
