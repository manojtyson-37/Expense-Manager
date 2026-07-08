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

export async function setBudget(category: string, limit: number, month: string) {
  const existing = await db.budgets.where({ category, month }).first()
  if (existing) {
    await db.budgets.update(existing.id!, { limit })
  } else {
    await db.budgets.add({ category, limit, month })
  }

  const userId = await getUserId()
  if (!userId) return
  if (!navigator.onLine) {
    await queueOp({ op: 'delete', table: 'budgets', userId, matchEq: { category, month } })
    await queueOp({
      op: 'insert', table: 'budgets', userId,
      payload: { user_id: userId, category, limit_amount: limit, month },
    })
    return
  }
  await supabase.from('budgets').delete()
    .eq('user_id', userId).eq('category', category).eq('month', month)
  await supabase.from('budgets').insert({
    user_id: userId, category, limit_amount: limit, month,
  })
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
  await supabase.from('budgets').delete()
    .eq('user_id', userId).eq('category', b.category).eq('month', b.month)
}
