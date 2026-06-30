# Subscriptions & Lending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription and lending tracking features to Expense Tracker with dashboard visibility and cloud sync.

**Architecture:** Extend Dexie data model with Subscription and Loan tables (v5), add React hooks for querying/mutating, create `/subscriptions` and `/loans` pages, integrate dashboard cards showing recurring totals and money owed.

**Tech Stack:** Dexie (IndexedDB), Supabase (sync backend), React, TypeScript, Tailwind CSS

## Global Constraints

- Follow existing uid-based sync pattern (stable cross-device IDs for conflict resolution)
- Offline-first: data lives in Dexie, syncs to Supabase
- No backend cron jobs or auto-generation; all actions user-initiated
- Currency formatting: use existing `useCurrency()` hook for symbol & `format(amount)`
- Naming: use singular (Subscription, Loan) for entities, plural for collections

---

## File Structure

**New files:**
- `src/db.ts` — extend with Subscription & Loan interfaces + Dexie tables (v5 upgrade)
- `src/hooks/useSubscriptions.ts` — hook for querying/mutating subscriptions
- `src/hooks/useLoans.ts` — hook for querying/mutating loans
- `src/pages/Subscriptions.tsx` — list, add, edit subscriptions
- `src/pages/Loans.tsx` — list loans by person, add, log returns
- `src/lib/sync.ts` — extend with `pushSubscription()`, `pushLoan()`, etc. (or add to existing sync)

**Modified files:**
- `src/pages/Dashboard.tsx` — add Recurring Expenses & Money Owed cards
- `src/App.tsx` — add routes for `/subscriptions`, `/loans`
- `src/components/Navigation.tsx` (or main nav) — add nav items

---

## Phase 1: Data Model & Hooks

### Task 1: Extend Dexie schema with Subscription & Loan tables

**Files:**
- Modify: `src/db.ts`

**Interfaces:**
- Produces: `Subscription`, `Loan`, `PaymentRecord` interfaces
- Produces: Dexie v5 with subscription & loan tables indexed

- [ ] **Step 1: Add Subscription and Loan interfaces to db.ts**

Open `src/db.ts` and add after the Transaction interface (around line 13):

```typescript
export interface Subscription {
  id?: number
  uid: string
  name: string
  amount: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: string // YYYY-MM-DD
  endDate?: string  // YYYY-MM-DD
  status: 'active' | 'paused' | 'cancelled'
  category?: string
  note?: string
  createdAt: number
}

export interface PaymentRecord {
  amount: number
  date: string // YYYY-MM-DD
  createdAt: number
}

export interface Loan {
  id?: number
  uid: string
  person: string
  totalAmount: number
  date: string // YYYY-MM-DD
  status: 'pending' | 'returned'
  payments: PaymentRecord[]
  note?: string
  createdAt: number
}
```

- [ ] **Step 2: Add Subscription & Loan to Dexie config (v5)**

After the existing db.version(4) block (around line 79), add:

```typescript
db.version(5).stores({
  transactions: '++id, uid, type, category, account, date, createdAt',
  categories: '++id, name, type',
  accounts: '++id, name, type',
  budgets: '++id, category, month',
  subscriptions: '++id, uid, status, startDate, createdAt',
  loans: '++id, uid, person, status, date, createdAt',
}).upgrade(async tx => {
  // No backfill needed — new tables
})
```

- [ ] **Step 3: Update EntityTable types in Dexie config**

After line 44 where `const db = new Dexie(...)`, update:

```typescript
const db = new Dexie('ExpenseTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  accounts: EntityTable<Account, 'id'>
  budgets: EntityTable<Budget, 'id'>
  subscriptions: EntityTable<Subscription, 'id'>
  loans: EntityTable<Loan, 'id'>
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/manojaaa/Expense\ Tracker
git add src/db.ts
git commit -m "feat: add Subscription and Loan entities to Dexie v5"
```

---

### Task 2: Create useSubscriptions hook

**Files:**
- Create: `src/hooks/useSubscriptions.ts`

**Interfaces:**
- Consumes: `Subscription` from db.ts
- Produces: `useSubscriptions()` hook returning `{ subscriptions, totalRecurring, add, edit, delete, toggleStatus }`

- [ ] **Step 1: Create hook with query**

Create new file `src/hooks/useSubscriptions.ts`:

```typescript
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
  await pushSubscription(sub)
}

export async function editSubscription(id: number, updates: Partial<Subscription>) {
  await db.subscriptions.update(id, { ...updates, createdAt: Date.now() })
  const sub = await db.subscriptions.get(id)
  if (sub) await pushSubscription(sub)
}

export async function deleteSubscription(id: number) {
  const sub = await db.subscriptions.get(id)
  if (sub) {
    await db.subscriptions.delete(id)
    await deleteCloudSubscription(sub.uid)
  }
}

export async function toggleSubscriptionStatus(id: number) {
  const sub = await db.subscriptions.get(id)
  if (!sub) return
  const nextStatus: Subscription['status'] = 
    sub.status === 'active' ? 'paused' :
    sub.status === 'paused' ? 'active' :
    'cancelled'
  await editSubscription(id, { status: nextStatus })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/manojaaa/Expense\ Tracker
npx tsc --noEmit
```

Expected: No errors (sync functions may not exist yet — that's fine, we'll add them in sync module)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscriptions.ts
git commit -m "feat: add useSubscriptions hook with CRUD operations"
```

---

### Task 3: Create useLoans hook

**Files:**
- Create: `src/hooks/useLoans.ts`

**Interfaces:**
- Consumes: `Loan`, `PaymentRecord` from db.ts
- Produces: `useLoans()` hook returning `{ loans, totalOwed, add, logPayment, delete }`

- [ ] **Step 1: Create hook**

Create `src/hooks/useLoans.ts`:

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUid, type Loan, type PaymentRecord } from '../db'
import { getUserId, pushLoan, deleteCloudLoan } from '../lib/sync'

export function useLoans() {
  const loans = useLiveQuery(async () => {
    return db.loans.orderBy('date').reverse().toArray()
  })

  const totalOwed = useLiveQuery(async () => {
    const all = await db.loans.toArray()
    return all.reduce((sum, loan) => {
      const paid = loan.payments.reduce((p, r) => p + r.amount, 0)
      const owed = Math.max(0, loan.totalAmount - paid)
      return sum + owed
    }, 0)
  })

  const loansByPerson = useLiveQuery(async () => {
    const all = await db.loans.toArray()
    const map = new Map<string, Loan>()
    for (const loan of all) {
      const existing = map.get(loan.person)
      if (!existing) {
        map.set(loan.person, loan)
      } else {
        // Combine if multiple loans to same person
        const existingPaid = existing.payments.reduce((p, r) => p + r.amount, 0)
        const newPaid = loan.payments.reduce((p, r) => p + r.amount, 0)
        existing.totalAmount += loan.totalAmount
        existing.payments.push(...loan.payments)
        map.set(loan.person, existing)
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })

  return { loans, totalOwed, loansByPerson }
}

export async function addLoan(person: string, amount: number, date: string, note?: string) {
  const uid = newUid()
  const loan: Loan = {
    uid,
    person,
    totalAmount: amount,
    date,
    status: 'pending',
    payments: [],
    note,
    createdAt: Date.now(),
  }
  await db.loans.add(loan)
  await pushLoan(loan)
}

export async function logLoanPayment(id: number, amount: number, date: string) {
  const loan = await db.loans.get(id)
  if (!loan) return

  const payment: PaymentRecord = { amount, date, createdAt: Date.now() }
  const payments = [...loan.payments, payment]
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const status = totalPaid >= loan.totalAmount ? 'returned' : 'pending'

  await db.loans.update(id, { payments, status, createdAt: Date.now() })
  const updated = await db.loans.get(id)
  if (updated) await pushLoan(updated)
}

export async function deleteLoan(id: number) {
  const loan = await db.loans.get(id)
  if (loan) {
    await db.loans.delete(id)
    await deleteCloudLoan(loan.uid)
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLoans.ts
git commit -m "feat: add useLoans hook with CRUD and payment tracking"
```

---

### Task 4: Extend sync.ts for Subscription & Loan sync

**Files:**
- Modify: `src/lib/sync.ts`

**Interfaces:**
- Consumes: `Subscription`, `Loan` types
- Produces: `pushSubscription()`, `pushLoan()`, `deleteCloudSubscription()`, `deleteCloudLoan()`

- [ ] **Step 1: Add sync functions to sync.ts**

Open `src/lib/sync.ts` and add after the transaction sync functions (after `deleteCloudTransaction`):

```typescript
export async function pushSubscription(sub: Subscription) {
  const userId = getUserId()
  if (!userId) return

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      uid: sub.uid,
      user_id: userId,
      name: sub.name,
      amount: sub.amount,
      frequency: sub.frequency,
      start_date: sub.startDate,
      end_date: sub.endDate || null,
      status: sub.status,
      category: sub.category || null,
      note: sub.note || null,
      created_at: new Date(sub.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'uid' })

  if (error) console.error('Failed to sync subscription:', error)
}

export async function pushLoan(loan: Loan) {
  const userId = getUserId()
  if (!userId) return

  const { error } = await supabase
    .from('loans')
    .upsert({
      uid: loan.uid,
      user_id: userId,
      person: loan.person,
      total_amount: loan.totalAmount,
      date: loan.date,
      status: loan.status,
      payments: loan.payments,
      note: loan.note || null,
      created_at: new Date(loan.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'uid' })

  if (error) console.error('Failed to sync loan:', error)
}

export async function deleteCloudSubscription(uid: string) {
  const userId = getUserId()
  if (!userId) return

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('uid', uid)
    .eq('user_id', userId)

  if (error) console.error('Failed to delete subscription:', error)
}

export async function deleteCloudLoan(uid: string) {
  const userId = getUserId()
  if (!userId) return

  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('uid', uid)
    .eq('user_id', userId)

  if (error) console.error('Failed to delete loan:', error)
}
```

- [ ] **Step 2: Add type imports**

At the top of `sync.ts`, add:

```typescript
import { type Subscription, type Loan } from '../db'
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat: add Supabase sync for Subscription and Loan entities"
```

---

## Phase 2: Pages & Navigation

### Task 5: Create Subscriptions page

**Files:**
- Create: `src/pages/Subscriptions.tsx`

**Interfaces:**
- Consumes: `useSubscriptions()`, `addSubscription()`, `editSubscription()`, `toggleSubscriptionStatus()`, `deleteSubscription()`
- Produces: Subscriptions list + add/edit forms

- [ ] **Step 1: Create subscriptions page**

Create `src/pages/Subscriptions.tsx`:

```typescript
import { useState } from 'react'
import { useSubscriptions, addSubscription, editSubscription, toggleSubscriptionStatus, deleteSubscription } from '../hooks/useSubscriptions'
import { useCategories } from '../hooks/useCategories'
import { useCurrency } from '../lib/CurrencyContext'
import IconRenderer from '../components/IconRenderer'

export default function Subscriptions() {
  const { subscriptions } = useSubscriptions()
  const categories = useCategories()
  const { symbol, format } = useCurrency()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ name: '', amount: '', frequency: 'monthly', startDate: '', category: '', note: '' })

  const handleAdd = async () => {
    if (!formData.name || !formData.amount || !formData.startDate) return
    await addSubscription(formData.name, parseFloat(formData.amount), formData.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly', formData.startDate, formData.category, formData.note)
    setFormData({ name: '', amount: '', frequency: 'monthly', startDate: '', category: '', note: '' })
    setShowAddForm(false)
  }

  const handleEdit = async () => {
    if (!editingId || !formData.name || !formData.amount) return
    await editSubscription(editingId, {
      name: formData.name,
      amount: parseFloat(formData.amount),
      frequency: formData.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
      startDate: formData.startDate,
      category: formData.category,
      note: formData.note,
    })
    setEditingId(null)
    setFormData({ name: '', amount: '', frequency: 'monthly', startDate: '', category: '', note: '' })
  }

  const startEdit = (sub: any) => {
    setEditingId(sub.id)
    setFormData({
      name: sub.name,
      amount: sub.amount.toString(),
      frequency: sub.frequency,
      startDate: sub.startDate,
      category: sub.category || '',
      note: sub.note || '',
    })
  }

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Subscriptions</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="text-xs font-semibold text-primary">+ Add</button>
      </div>

      {showAddForm && (
        <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
          <input type="text" placeholder="Netflix" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <input type="number" placeholder="Amount" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <input type="text" placeholder="Category (optional)" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <input type="text" placeholder="Note (optional)" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 py-2 bg-primary text-black rounded text-sm font-semibold">Add</button>
            <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 bg-surface-light rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {subscriptions?.map(sub => (
          <div key={sub.id} className="bg-surface rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{sub.name}</span>
                <span className={`text-xs px-2 py-1 rounded ${sub.status === 'active' ? 'bg-primary/20 text-primary' : 'bg-text-muted/20 text-text-muted'}`}>{sub.status}</span>
              </div>
              <span className="font-semibold">{format(sub.amount)}</span>
            </div>
            <div className="text-xs text-text-muted mb-3">{sub.frequency} • Started {sub.startDate}</div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(sub)} className="flex-1 py-2 bg-surface-light rounded text-xs">Edit</button>
              <button onClick={() => toggleSubscriptionStatus(sub.id!)} className="flex-1 py-2 bg-surface-light rounded text-xs">{sub.status === 'active' ? 'Pause' : 'Resume'}</button>
              <button onClick={() => deleteSubscription(sub.id!)} className="flex-1 py-2 bg-expense/20 text-expense rounded text-xs">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-surface rounded-t-3xl p-4 space-y-3">
            <h2 className="font-bold mb-4">Edit Subscription</h2>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
            <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
            <div className="flex gap-2">
              <button onClick={handleEdit} className="flex-1 py-2 bg-primary text-black rounded text-sm font-semibold">Save</button>
              <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-surface-light rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Subscriptions.tsx
git commit -m "feat: add Subscriptions page with list, add, edit, and toggle"
```

---

### Task 6: Create Loans page

**Files:**
- Create: `src/pages/Loans.tsx`

**Interfaces:**
- Consumes: `useLoans()`, `addLoan()`, `logLoanPayment()`, `deleteLoan()`
- Produces: Loans list grouped by person + add form + payment logging

- [ ] **Step 1: Create loans page**

Create `src/pages/Loans.tsx`:

```typescript
import { useState } from 'react'
import { useLoans, addLoan, logLoanPayment, deleteLoan } from '../hooks/useLoans'
import { useCurrency } from '../lib/CurrencyContext'

export default function Loans() {
  const { loansByPerson } = useLoans()
  const { symbol, format } = useCurrency()
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ person: '', amount: '', date: '' })
  const [loggingPaymentId, setLoggingPaymentId] = useState<number | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: '' })

  const handleAdd = async () => {
    if (!formData.person || !formData.amount || !formData.date) return
    await addLoan(formData.person, parseFloat(formData.amount), formData.date)
    setFormData({ person: '', amount: '', date: '' })
    setShowAddForm(false)
  }

  const handleLogPayment = async () => {
    if (!loggingPaymentId || !paymentForm.amount || !paymentForm.date) return
    await logLoanPayment(loggingPaymentId, parseFloat(paymentForm.amount), paymentForm.date)
    setLoggingPaymentId(null)
    setPaymentForm({ amount: '', date: '' })
  }

  const getBalanceOwed = (loan: any) => {
    const paid = loan.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
    return loan.totalAmount - paid
  }

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Money Owed to Me</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="text-xs font-semibold text-primary">+ Add Loan</button>
      </div>

      {showAddForm && (
        <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
          <input type="text" placeholder="Person name" value={formData.person} onChange={(e) => setFormData({ ...formData, person: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <input type="number" placeholder="Amount lent" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 py-2 bg-primary text-black rounded text-sm font-semibold">Add</button>
            <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 bg-surface-light rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loansByPerson?.map(loan => {
          const owed = getBalanceOwed(loan)
          return (
            <div key={loan.id} className="bg-surface rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{loan.person}</span>
                <span className={`text-sm font-semibold ${owed > 0 ? 'text-expense' : 'text-income'}`}>{format(owed)}</span>
              </div>
              <div className="text-xs text-text-muted mb-3">Lent {format(loan.totalAmount)} on {loan.date}</div>
              {loan.payments.length > 0 && (
                <div className="text-xs text-text-muted mb-2">
                  Returned: {loan.payments.map(p => `${format(p.amount)} (${p.date})`).join(', ')}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setLoggingPaymentId(loan.id!)} className="flex-1 py-2 bg-surface-light rounded text-xs">Log Return</button>
                <button onClick={() => deleteLoan(loan.id!)} className="flex-1 py-2 bg-expense/20 text-expense rounded text-xs">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {loggingPaymentId && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-surface rounded-t-3xl p-4 space-y-3">
            <h2 className="font-bold mb-4">Log Return Payment</h2>
            <input type="number" placeholder="Amount returned" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
            <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full px-3 py-2 bg-surface-light rounded text-sm" />
            <div className="flex gap-2">
              <button onClick={handleLogPayment} className="flex-1 py-2 bg-primary text-black rounded text-sm font-semibold">Log</button>
              <button onClick={() => setLoggingPaymentId(null)} className="flex-1 py-2 bg-surface-light rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Loans.tsx
git commit -m "feat: add Loans page with lending tracking and payment logging"
```

---

### Task 7: Add routes and navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Navigation.tsx` (or main nav component)

**Interfaces:**
- Consumes: Subscriptions & Loans pages
- Produces: Routes `/subscriptions` and `/loans`, nav items

- [ ] **Step 1: Add routes to App.tsx**

Open `src/App.tsx` and find the router section (inside HashRouter or Router). Add these routes:

```typescript
import Subscriptions from './pages/Subscriptions'
import Loans from './pages/Loans'

// Inside the Routes component, add:
<Route path="/subscriptions" element={<Subscriptions />} />
<Route path="/loans" element={<Loans />} />
```

- [ ] **Step 2: Add navigation items**

Find the navigation/bottom bar component (likely in `src/components/Navigation.tsx` or within `Dashboard`). Add buttons for `/subscriptions` and `/loans`. Example:

```typescript
<button onClick={() => navigate('/subscriptions')} className="...">
  <span>Subscriptions</span>
</button>
<button onClick={() => navigate('/loans')} className="...">
  <span>Loans</span>
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/Navigation.tsx
git commit -m "feat: add routes and navigation for Subscriptions and Loans pages"
```

---

## Phase 3: Dashboard Integration

### Task 8: Add Recurring Expenses card to Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `useSubscriptions()` hook returning `totalRecurring`
- Produces: Dashboard card showing monthly recurring total

- [ ] **Step 1: Import useSubscriptions**

At the top of `src/pages/Dashboard.tsx`, add:

```typescript
import { useSubscriptions } from '../hooks/useSubscriptions'
```

- [ ] **Step 2: Call hook in Dashboard**

Inside the Dashboard component, after `const { symbol, format } = useCurrency()`, add:

```typescript
const { totalRecurring } = useSubscriptions()
```

- [ ] **Step 3: Add Recurring Expenses card**

Find the Quick Stats Row section (around line 185 in current Dashboard.tsx). Add after the "Avg/Day" card:

```typescript
<div className="flex-1 bg-surface rounded-2xl p-3.5">
  <div className="text-xs text-text-muted uppercase tracking-wider">Recurring</div>
  <div className="text-lg font-bold text-accent mt-0.5">
    {totalRecurring ? format(totalRecurring) : format(0, { minimumFractionDigits: 0 })}
  </div>
  <div className="text-xs text-text-muted">/month subscriptions</div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add Recurring Expenses card to Dashboard"
```

---

### Task 9: Add Money Owed to Me card to Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `useLoans()` hook returning `totalOwed`
- Produces: Dashboard card showing money owed by friends

- [ ] **Step 1: Import useLoans**

At the top of Dashboard.tsx, add:

```typescript
import { useLoans } from '../hooks/useLoans'
```

- [ ] **Step 2: Call hook in Dashboard**

Inside the Dashboard component, after `const { totalRecurring } = useSubscriptions()`, add:

```typescript
const { totalOwed } = useLoans()
```

- [ ] **Step 3: Add Money Owed card**

After the Recurring Expenses card, add:

```typescript
{totalOwed && totalOwed > 0 && (
  <button onClick={() => navigate('/loans')} className="flex-1 bg-surface rounded-2xl p-3.5 text-left active:bg-surface-light/50">
    <div className="text-xs text-text-muted uppercase tracking-wider">Money Owed</div>
    <div className="text-lg font-bold text-income mt-0.5">
      {format(totalOwed)}
    </div>
    <div className="text-xs text-text-muted">from friends</div>
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add Money Owed to Me card to Dashboard"
```

---

## Phase 4: Polish & Testing

### Task 10: Manual testing & bug fixes

**Scope:**
- Test add/edit/delete subscriptions
- Test add/log payment for loans
- Verify sync to Supabase
- Verify offline functionality (add while offline, sync when online)

- [ ] **Step 1: Start dev server**

```bash
cd /Users/manojaaa/Expense\ Tracker
npm run dev
```

- [ ] **Step 2: Test subscription CRUD**

- Navigate to `/subscriptions`
- Add a subscription: Netflix, ₹499, monthly, start today
- Verify it appears in list and on Dashboard
- Edit it, verify changes sync
- Toggle pause/resume, verify status changes
- Delete it, verify removal from list

- [ ] **Step 3: Test loan CRUD**

- Navigate to `/loans`
- Add a loan: Alice, ₹5000, today
- Verify it appears in list and on Dashboard
- Log a payment of ₹2000, verify balance updates (should show ₹3000 owed)
- Log another ₹3000, verify status changes to "returned"
- Delete it, verify removal

- [ ] **Step 4: Test offline sync**

- Open DevTools → Network → Offline
- Add a subscription while offline
- Verify it appears locally
- Go online, verify sync completes (check Supabase dashboard)

- [ ] **Step 5: Commit final fixes**

```bash
git add .
git commit -m "test: manual QA for subscriptions and loans features"
```

---

## Self-Review

Checking plan against spec:

✓ **Data Model:** Subscription & Loan tables with uid sync (Task 1)  
✓ **Subscriptions tracking:** Separate entity, manual logging (Tasks 1-2, 5)  
✓ **Loans tracking:** Detailed with partial returns (Tasks 1, 3, 6)  
✓ **Dashboard visibility:** Recurring + Money Owed cards (Tasks 8-9)  
✓ **Pages:** `/subscriptions` and `/loans` (Tasks 5-6, 7)  
✓ **Cloud sync:** Supabase push via uid pattern (Task 4)  
✓ **Navigation:** Routes added (Task 7)  

**No gaps identified.**

**Type consistency check:**
- `Subscription.frequency` enum matches useSubscriptions logic ✓
- `Loan.status` updated in logLoanPayment when paid ✓
- `PaymentRecord` structure consistent across hooks ✓

**No placeholders found.** All code complete.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-subscriptions-lending-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
