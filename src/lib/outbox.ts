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

// A permanently-failing entry (bad payload, RLS reject, revoked session)
// must not block every other queued mutation, or this account's sync stops
// working forever with no recovery. Give an entry this many attempts across
// separate flush calls before dropping it and moving on.
const MAX_ATTEMPTS = 5

// Local, best-effort audit trail for mutations we gave up on — bounded so it
// can't grow unbounded, keyed per-device (not synced). This is the only
// record of a permanently-dropped mutation once it's gone from the outbox.
const FAILED_LOG_KEY = 'expense-tracker-outbox-failures'
const FAILED_LOG_MAX = 50

function logDroppedEntry(entry: OutboxEntry, attempts: number, err: unknown) {
  try {
    const existing = JSON.parse(localStorage.getItem(FAILED_LOG_KEY) || '[]')
    existing.push({
      table: entry.table, op: entry.op, uid: entry.uid, userId: entry.userId,
      attempts, droppedAt: Date.now(), error: err instanceof Error ? err.message : String(err),
    })
    localStorage.setItem(FAILED_LOG_KEY, JSON.stringify(existing.slice(-FAILED_LOG_MAX)))
  } catch {
    // localStorage full or unavailable — the console.error is still the fallback trail
  }
}

// Only this account's queued mutations are ever retried or dropped here.
// On a shared device, a different (currently signed-out) account's stuck
// entries are left completely untouched — they'd otherwise fail Supabase RLS
// under the wrong session on every attempt and get permanently deleted after
// MAX_ATTEMPTS, silently losing that other account's data.
export async function flushOutbox(userId: string): Promise<void> {
  if (!navigator.onLine) return
  const pending = (await db.outbox.orderBy('createdAt').toArray()).filter(e => e.userId === userId)
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
      const attempts = (entry.attempts ?? 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        console.error(
          `flushOutbox: giving up on ${entry.table} ${entry.op} uid=${entry.uid} after ${attempts} attempts, dropping from outbox`,
          err, entry,
        )
        logDroppedEntry(entry, attempts, err)
        if (entry.id != null) await db.outbox.delete(entry.id)
        continue
      }
      console.error('flushOutbox: failed, will retry', entry.table, entry.op, entry.uid, `attempt ${attempts}/${MAX_ATTEMPTS}`, err)
      if (entry.id != null) await db.outbox.update(entry.id, { attempts })
      break
    }
  }
}
