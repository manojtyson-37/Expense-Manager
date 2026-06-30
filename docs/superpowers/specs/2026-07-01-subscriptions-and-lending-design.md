# Subscriptions & Lending Features Design

**Date:** 2026-07-01  
**Status:** Approved  
**Scope:** Add subscription tracking and lending/borrowing tracking to Expense Tracker PWA

---

## Overview

Two new features for Expense Tracker:
1. **Subscriptions** — track recurring expenses (Netflix, Gym, Insurance, etc.) with manual payment logging
2. **Lending** — track money lent to friends/family with detailed return tracking (partial returns supported)

Both features store data locally (Dexie) and sync to Supabase, following the existing offline-first PWA pattern.

---

## Data Model

### Subscription Entity

```typescript
interface Subscription {
  id?: number
  uid: string                              // stable cross-device id for sync
  name: string                             // "Netflix", "Gym", etc.
  amount: number                           // monthly/yearly amount
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: string                        // YYYY-MM-DD
  endDate?: string                         // YYYY-MM-DD (optional, for tracking ended subscriptions)
  status: 'active' | 'paused' | 'cancelled'
  category: string                         // optional, e.g., "Entertainment", "Health"
  note?: string
  createdAt: number                        // timestamp
}
```

**Dexie table indices:** `++id, uid, status, startDate, createdAt`

### Loan Entity

```typescript
interface Loan {
  id?: number
  uid: string                              // stable cross-device id for sync
  person: string                           // name of friend/family member
  totalAmount: number                      // total lent
  date: string                             // YYYY-MM-DD (date lent)
  status: 'pending' | 'returned'           // pending = still owed, returned = fully paid back
  payments: PaymentRecord[]
  note?: string
  createdAt: number
}

interface PaymentRecord {
  amount: number
  date: string                             // YYYY-MM-DD (when returned)
  createdAt: number
}
```

**Dexie table indices:** `++id, uid, person, status, date, createdAt`

---

## UI & Navigation

### New Pages

#### `/subscriptions`
- **List view:** Active subscriptions card showing name, amount, frequency, status toggle
- **Add form:** name, amount, frequency, start date, optional category, note
- **Edit:** Update subscription details, pause/resume/cancel
- **Dashboard widget:** Shows next 3 upcoming subscription due dates (approximation based on frequency)

#### `/loans`
- **List view by person:** "Alice: ₹5000 owed (₹2000 returned)" with total status
- **Loan detail:** Person, total amount, date lent, payment history (list of returns), status
- **Add loan form:** Person name, amount, date lent, optional note
- **Log return:** Quick modal to add payment record (amount, date)

### Dashboard Changes

Add two new cards to Dashboard (alongside existing Income/Expense/Today cards):

1. **Recurring Expenses**
   - Shows: sum of all active subscriptions
   - Example: "₹1500/month" or "₹18000/year"
   - Visual: icon + amount + note "Subscriptions"

2. **Money Owed to Me**
   - Shows: total across all loans - total returned
   - Example: "₹8000 pending" (if lent ₹10k, got back ₹2k)
   - Visual: icon + amount + note "From Friends"
   - Tap to go to `/loans`

---

## User Flows

### Subscription Flow

1. User navigates to `/subscriptions`
2. Taps "Add Subscription"
3. Enters: Netflix, ₹499/month, starts 2026-06-01
4. Saved to Dexie + synced to Supabase
5. Dashboard updates: "₹499/month" in Recurring card
6. Each month, user can optionally tap subscription → "Mark Paid" to create a transaction in history
   - Optional: auto-link to transactions for audit trail

### Lending Flow

1. User lends ₹5000 to Alice on 2026-06-15
2. Navigates to `/loans` → "Add Loan"
3. Enters: Alice, ₹5000, 2026-06-15
4. Saved as pending
5. Dashboard shows: "₹5000 pending" in Money Owed card
6. Later, Alice returns ₹2000
7. User taps loan → "Log Return" → enters ₹2000, date
8. Loan updates: status still pending, balance ₹3000
9. When Alice returns remaining ₹3000, loan marks as "returned"

---

## Implementation Phases

### Phase 1: Data & Hooks
- Add Subscription & Loan tables to Dexie (v5)
- Create `useSubscriptions()` and `useLoans()` hooks (filter by status, calculate totals)
- Wire sync to Supabase (uid-based like transactions)

### Phase 2: Pages
- Build `/subscriptions` page (list, add, edit, status toggle)
- Build `/loans` page (list by person, add, log returns)
- Add navigation to main nav bar

### Phase 3: Dashboard Integration
- Add Recurring Expenses card
- Add Money Owed to Me card
- Wire to hooks for live totals

### Phase 4: Polish
- Validation, error handling
- Mobile responsiveness
- Transaction linking (optional: auto-create transaction when marking paid)

---

## Sync & Cloud

- Follow existing uid pattern (stable cross-device IDs)
- Subscriptions & Loans sync to Supabase like transactions
- Conflict resolution: last-write-wins (createdAt + uid)
- No special auth needed beyond existing user session

---

## Success Criteria

✓ User can add/edit/delete subscriptions  
✓ User can track recurring subscriptions on dashboard  
✓ User can lend money and log multiple partial returns  
✓ Data syncs across devices  
✓ Offline-first (works without network, syncs when online)  
✓ Dashboard shows real-time totals  

---

## Notes

- Subscriptions do NOT auto-generate transactions; user manually logs them. This keeps the app lightweight (no cron jobs).
- Loans are for tracking IOUs, not for creating automatic payment reminders (future enhancement).
- Both features use the same uid + Dexie + Supabase pattern as existing transactions for consistency.
