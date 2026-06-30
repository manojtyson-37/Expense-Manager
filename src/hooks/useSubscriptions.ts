import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUid, type Subscription } from '../db'
import { getUserId, pushSubscription, deleteCloudSubscription } from '../lib/sync'

export function useSubscriptions() {
  const subscriptions = useLiveQuery(async () => {
    return db.subscriptions.orderBy('startDate').reverse().toArray()
  })

  const totalRecurring = useLiveQuery(async () => {
    const all = await db.subscriptions.toArray()
    const active = all.filter(s => s.status === 'active')
    // For simplicity, sum monthly equivalents (daily*30, weekly*4.3, yearly/12)
    return active.reduce((sum, s) => {
      const monthly =
        s.frequency === 'daily' ? s.amount * 30 :
        s.frequency === 'weekly' ? s.amount * 4.3 :
        s.frequency === 'monthly' ? s.amount :
        s.amount / 12
      return sum + monthly
    }, 0)
  })

  return { subscriptions, totalRecurring }
}

export async function addSubscription(name: string, amount: number, frequency: Subscription['frequency'], startDate: string, category?: string, note?: string) {
  const uid = newUid()
  const sub: Subscription = {
    uid,
    name,
    amount,
    frequency,
    startDate,
    status: 'active',
    category,
    note,
    createdAt: Date.now(),
  }
  await db.subscriptions.add(sub)
  const userId = await getUserId()
  if (userId) {
    await pushSubscription(userId, sub)
  }
}

export async function editSubscription(uid: string, updates: Partial<Subscription>) {
  const sub = await db.subscriptions.where('uid').equals(uid).first()
  if (!sub) return
  await db.subscriptions.update(sub.id!, { ...updates, createdAt: Date.now() })
  const updated = await db.subscriptions.get(sub.id!)
  const userId = await getUserId()
  if (userId && updated) {
    await pushSubscription(userId, updated)
  }
}

export async function deleteSubscription(uid: string) {
  const sub = await db.subscriptions.where('uid').equals(uid).first()
  if (!sub) return
  await db.subscriptions.delete(sub.id!)
  const userId = await getUserId()
  if (userId) {
    await deleteCloudSubscription(userId, uid)
  }
}

export async function toggleSubscriptionStatus(uid: string) {
  const sub = await db.subscriptions.where('uid').equals(uid).first()
  if (!sub) return
  const nextStatus: Subscription['status'] =
    sub.status === 'active' ? 'paused' :
    sub.status === 'paused' ? 'active' :
    'cancelled'
  await editSubscription(uid, { status: nextStatus })
}
