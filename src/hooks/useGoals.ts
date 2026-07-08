import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUid, type Goal } from '../db'
import { getUserId, pushGoal, deleteCloudGoal } from '../lib/sync'

export function useGoals() {
  const goals = useLiveQuery(async () => {
    return db.goals.orderBy('createdAt').reverse().toArray()
  })

  return { goals }
}

export async function addGoal(name: string, targetAmount: number, targetDate?: string) {
  const uid = newUid()
  const goal: Goal = {
    uid,
    name,
    targetAmount,
    targetDate,
    savedAmount: 0,
    createdAt: Date.now(),
  }
  await db.goals.add(goal)
  const userId = await getUserId()
  if (userId) await pushGoal(userId, goal)
}

export async function updateGoal(uid: string, updates: Partial<Goal>) {
  const goal = await db.goals.where('uid').equals(uid).first()
  if (!goal) return
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, uid: _uid, ...safeUpdates } = updates
  await db.goals.update(goal.id!, safeUpdates)
  const updated = await db.goals.get(goal.id!)
  const userId = await getUserId()
  if (userId && updated) await pushGoal(userId, updated)
}

export async function addToGoalSaved(uid: string, amount: number) {
  const goal = await db.goals.where('uid').equals(uid).first()
  if (!goal) return
  const savedAmount = Math.max(0, goal.savedAmount + amount)
  await updateGoal(uid, { savedAmount })
}

export async function deleteGoal(uid: string) {
  const goal = await db.goals.where('uid').equals(uid).first()
  if (!goal) return
  await db.goals.delete(goal.id!)
  await deleteCloudGoal(uid)
}
