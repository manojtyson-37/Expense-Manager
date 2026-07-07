import { db, newUid, type Transaction, type Subscription } from '../db'
import { getUserId, pushTransaction } from './sync'

const storageKey = (uid: string) => `subpost:${uid}`

function getLastPosted(uid: string): string | null {
  return localStorage.getItem(storageKey(uid))
}

function setLastPosted(uid: string, date: string): void {
  localStorage.setItem(storageKey(uid), date)
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

/**
 * Called on every app open (after sync).
 * Returns the number of transactions auto-created.
 */
export async function processSubscriptions(): Promise<number> {
  const today = localToday()

  // Only active subs that have started (and not past their endDate)
  const activeSubs = await db.subscriptions
    .filter(s => s.status === 'active' && s.startDate <= today && (!s.endDate || s.endDate >= today))
    .toArray()

  if (activeSubs.length === 0) return 0

  const accounts = await db.accounts.toArray()
  if (accounts.length === 0) return 0
  const defaultAccount = accounts[0].name

  const userId = await getUserId()
  let created = 0

  for (const sub of activeSubs) {
    const lastPosted = getLastPosted(sub.uid)
    const dueDates = computeDueDates(sub.startDate, sub.endDate, sub.frequency, today, lastPosted)

    if (dueDates.length === 0) continue

    for (const date of dueDates) {
      const uid = newUid()
      const txn: Transaction = {
        uid,
        type: 'expense',
        amount: sub.amount,
        category: sub.category || 'Bills',
        account: defaultAccount,
        note: sub.name,
        date,
        createdAt: Date.now(),
      }
      await db.transactions.add(txn)
      if (userId) {
        await pushTransaction(userId, {
          uid,
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          account: txn.account,
          note: txn.note,
          date: txn.date,
        })
      }
      created++
    }

    setLastPosted(sub.uid, dueDates[dueDates.length - 1])
  }

  return created
}
