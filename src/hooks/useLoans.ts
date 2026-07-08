import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUid, type Loan, type PaymentRecord } from '../db'
import { pushLoan, deleteCloudLoan } from '../lib/sync'

export function useLoans() {
  const loans = useLiveQuery(async () => {
    return db.loans.orderBy('date').reverse().toArray()
  })

  const totalOwed = useLiveQuery(async () => {
    const all = await db.loans.toArray()
    return all.reduce((sum, loan) => {
      if ((loan.type ?? 'lent') !== 'lent') return sum
      const paid = loan.payments.reduce((p, r) => p + r.amount, 0)
      return sum + Math.max(0, loan.totalAmount - paid)
    }, 0)
  })

  const totalOwing = useLiveQuery(async () => {
    const all = await db.loans.toArray()
    return all.reduce((sum, loan) => {
      if ((loan.type ?? 'lent') !== 'borrowed') return sum
      const paid = loan.payments.reduce((p, r) => p + r.amount, 0)
      return sum + Math.max(0, loan.totalAmount - paid)
    }, 0)
  })

  return { loans, totalOwed, totalOwing }
}

export async function addLoan(
  person: string,
  amount: number,
  date: string,
  note?: string,
  type: 'lent' | 'borrowed' = 'lent',
  dueDate?: string,
) {
  const uid = newUid()
  const loan: Loan = {
    uid,
    type,
    person,
    totalAmount: amount,
    date,
    dueDate,
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

  await db.loans.update(id, { payments, status })
  const updated = await db.loans.get(id)
  if (updated) await pushLoan(updated)
}

export async function updateLoan(id: number, person: string, amount: number, date: string, note?: string, dueDate?: string) {
  const loan = await db.loans.get(id)
  if (!loan) return
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0)
  const status: Loan['status'] = totalPaid >= amount ? 'returned' : 'pending'
  const fields = { person, totalAmount: amount, date, dueDate, note, status, createdAt: Date.now() }
  await db.loans.update(id, fields)
  const pushPayload: Omit<Loan, 'id'> = { uid: loan.uid, type: loan.type, person, totalAmount: amount, date, dueDate, note, status, payments: loan.payments, createdAt: fields.createdAt }
  await pushLoan(pushPayload)
}

export async function deleteLoan(id: number) {
  const loan = await db.loans.get(id)
  if (loan) {
    await db.loans.delete(id)
    await deleteCloudLoan(loan.uid)
  }
}
