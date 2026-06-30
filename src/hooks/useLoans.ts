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
