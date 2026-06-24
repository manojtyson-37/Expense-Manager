import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { supabase } from '../lib/supabase'
import { getUserId } from '../lib/sync'

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
  if (userId) {
    await supabase.from('budgets').delete()
      .eq('user_id', userId).eq('category', category).eq('month', month)
    await supabase.from('budgets').insert({
      user_id: userId, category, limit_amount: limit, month,
    })
  }
}

export async function deleteBudget(id: number) {
  const b = await db.budgets.get(id)
  await db.budgets.delete(id)
  const userId = await getUserId()
  if (userId && b) {
    await supabase.from('budgets').delete()
      .eq('user_id', userId).eq('category', b.category).eq('month', b.month)
  }
}
