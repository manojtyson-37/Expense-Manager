import { db, type OutboxEntry } from '../db'
import { supabase } from './supabase'

// Only uid-keyed tables (those with a user_id,uid composite unique constraint in Supabase)
// may be enqueued. Adding a new synced table with uid requires adding it here too.
const UID_CONFLICT_TABLES = new Set(['transactions', 'subscriptions', 'loans'])

export async function queueOp(entry: Omit<OutboxEntry, 'id' | 'createdAt'>): Promise<void> {
  if (!UID_CONFLICT_TABLES.has(entry.table) && entry.op === 'upsert') {
    console.warn('queueOp: table not in UID_CONFLICT_TABLES, skipping outbox for', entry.table)
    return
  }
  await db.outbox.add({ ...entry, createdAt: Date.now() })
}

export async function flushOutbox(): Promise<void> {
  if (!navigator.onLine) return
  const pending = await db.outbox.orderBy('createdAt').toArray()
  if (pending.length === 0) return

  for (const entry of pending) {
    try {
      if (entry.op === 'upsert' && entry.payload) {
        const { error } = await supabase
          .from(entry.table)
          .upsert(entry.payload, { onConflict: 'user_id,uid' })
        if (error) throw error
      } else if (entry.op === 'delete') {
        const { error } = await supabase
          .from(entry.table)
          .delete().eq('user_id', entry.userId).eq('uid', entry.uid)
        if (error) throw error
      }
      if (entry.id != null) {
        await db.outbox.delete(entry.id)
      } else {
        console.error('flushOutbox: entry missing id, cannot delete from outbox', entry)
        break
      }
    } catch (err) {
      console.error('flushOutbox: failed', entry.table, entry.op, entry.uid, err)
      break
    }
  }
}
