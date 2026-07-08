import { db, newUid, type Transaction, type Subscription } from '../db'
import { getUserId, pushTransaction, deleteCloudTransaction } from './sync'

// Per-user keying prevents cross-user contamination on shared devices
const storageKey = (userId: string, subUid: string) => `subpost:${userId}:${subUid}`

function getLastPosted(userId: string, subUid: string): string | null {
  return localStorage.getItem(storageKey(userId, subUid))
}

function setLastPosted(userId: string, subUid: string, date: string): void {
  localStorage.setItem(storageKey(userId, subUid), date)
}

// Returns local date as YYYY-MM-DD — avoids UTC offset shifting the date
function localToday(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

// Parse YYYY-MM-DD as LOCAL midnight to keep arithmetic in local timezone
function parseLocal(dateStr: string): Date {
  const [y, m, day] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, day)
}

// Format a local Date back to YYYY-MM-DD
function formatLocal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function advanceDate(d: Date, freq: Subscription['frequency']): void {
  if (freq === 'daily') d.setDate(d.getDate() + 1)
  else if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
}

/**
 * Returns due dates for a subscription between a range and today.
 *
 * lastPosted=null (first run): returns the single most-recent due date ≤ today.
 *   No retroactive flood — just catches the current cycle.
 * lastPosted set: returns all due dates strictly after lastPosted, up to today,
 *   capped at 12 (handles catch-up if app wasn't opened for a while).
 *
 * endDate: no dates are returned past endDate.
 */
function computeDueDates(
  startDate: string,
  endDate: string | undefined,
  freq: Subscription['frequency'],
  today: string,
  lastPosted: string | null,
): string[] {
  const cap = endDate && endDate < today ? endDate : today
  const target = parseLocal(cap)
  const start = parseLocal(startDate)

  if (start > target) return []

  const cur = new Date(start)
  const MAX_CATCHUP = 12

  if (lastPosted === null) {
    // Walk to the last due date ≤ target
    let prev: string | null = null
    while (cur <= target) {
      prev = formatLocal(cur)
      advanceDate(cur, freq)
    }
    return prev ? [prev] : []
  }

  const from = parseLocal(lastPosted)
  // Advance to first due date strictly after lastPosted
  while (cur <= from) {
    advanceDate(cur, freq)
  }

  const upcoming: string[] = []
  while (cur <= target && upcoming.length < MAX_CATCHUP) {
    upcoming.push(formatLocal(cur))
    advanceDate(cur, freq)
  }
  return upcoming
}

// Guard against concurrent runs (e.g. two tabs or rapid visibility events)
let processing = false

/**
 * Called on every app open (after sync).
 * Returns the number of transactions auto-created.
 */
export async function processSubscriptions(): Promise<number> {
  if (processing) return 0
  processing = true

  try {
    const today = localToday()
    const userId = await getUserId()
    if (!userId) return 0

    // Only active subs that have started (and not past their endDate)
    const activeSubs = await db.subscriptions
      .filter(s => s.status === 'active' && s.startDate <= today && (!s.endDate || s.endDate >= today))
      .toArray()

    if (activeSubs.length === 0) return 0

    const accounts = await db.accounts.toArray()
    if (accounts.length === 0) return 0
    // Prefer "Cash" (the seeded default); fall back to first account
    const fallbackAccount = (accounts.find(a => a.name === 'Cash') ?? accounts[0]).name

    let created = 0

    for (const sub of activeSubs) {
      const lastPosted = getLastPosted(userId, sub.uid)
      const dueDates = computeDueDates(sub.startDate, sub.endDate, sub.frequency, today, lastPosted)

      if (dueDates.length === 0) continue

      let allSucceeded = true
      let lastSuccessDate = lastPosted

      for (const date of dueDates) {
        const uid = newUid()
        const txn: Transaction = {
          uid,
          type: sub.type,
          amount: sub.amount,
          category: sub.category || (sub.type === 'income' ? 'Other Income' : 'Bills'),
          account: sub.account || fallbackAccount,
          note: sub.name,
          date,
          createdAt: Date.now(),
        }
        try {
          await db.transactions.add(txn)
          await pushTransaction(userId, {
            uid,
            type: txn.type,
            amount: txn.amount,
            category: txn.category,
            account: txn.account,
            note: txn.note,
            date: txn.date,
          })
          lastSuccessDate = date
          created++
        } catch (err) {
          console.error('subscriptionProcessor: failed to post transaction for', sub.name, date, err)
          allSucceeded = false
          break // stop this sub's loop; don't skip ahead
        }
      }

      // Only advance the marker to the last successfully-written date
      if (lastSuccessDate && lastSuccessDate !== lastPosted) {
        setLastPosted(userId, sub.uid, lastSuccessDate)
      }

      if (!allSucceeded) continue
    }

    return created
  } finally {
    processing = false
  }
}

const DEDUP_KEY = (userId: string) => `subdedup:${userId}:v1`

/**
 * One-time cleanup for duplicate subscription transactions caused by the
 * localStorage key format migration (v1: unscoped → v2: userId-scoped).
 *
 * Groups expense transactions by (note, date, amount). For any group with
 * 2+ entries where the note matches an active subscription name, keeps the
 * one with the highest createdAt and deletes the rest from Dexie + Supabase.
 *
 * Safe to call repeatedly — runs once per user then marks done in localStorage.
 */
export async function dedupeSubscriptionTransactions(): Promise<number> {
  const userId = await getUserId()
  if (!userId) return 0

  const doneKey = DEDUP_KEY(userId)
  if (localStorage.getItem(doneKey)) return 0

  try {
    const subs = await db.subscriptions.filter(s => s.status === 'active').toArray()
    if (subs.length === 0) {
      localStorage.setItem(doneKey, '1')
      return 0
    }

    const subNames = new Set(subs.map(s => s.name))
    const allTxns = await db.transactions.toArray()

    // Group by (note, date, amount) — only expense txns whose note is a sub name
    const groups = new Map<string, Transaction[]>()
    for (const t of allTxns) {
      if (t.type !== 'expense' || !subNames.has(t.note)) continue
      const key = `${t.note}|${t.date}|${t.amount}|${t.account || ''}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    let removed = 0
    for (const group of groups.values()) {
      if (group.length < 2) continue
      // Keep the one with the highest createdAt (most recent write)
      group.sort((a, b) => b.createdAt - a.createdAt)
      const toDelete = group.slice(1)
      for (const t of toDelete) {
        try {
          await db.transactions.delete(t.id!)
          await deleteCloudTransaction(userId, t)
          removed++
        } catch (err) {
          console.error('dedupeSubscriptionTransactions: failed to delete', t.uid, err)
        }
      }
    }

    localStorage.setItem(doneKey, '1')
    return removed
  } catch (err) {
    console.error('dedupeSubscriptionTransactions failed:', err)
    return 0
  }
}
