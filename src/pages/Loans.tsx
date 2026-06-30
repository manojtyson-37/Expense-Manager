import { useState } from 'react'
import { ArrowLeft, Plus, HandCoins, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLoans, addLoan, logLoanPayment, deleteLoan } from '../hooks/useLoans'
import { useCurrency } from '../lib/CurrencyContext'
import DeleteButton from '../components/DeleteButton'
import UndoToast from '../components/UndoToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import type { Loan } from '../db'

interface AddFormState {
  person: string
  amount: string
  date: string
  note: string
}

interface PaymentFormState {
  amount: string
  date: string
}

const emptyAddForm = (): AddFormState => ({
  person: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
})

const emptyPaymentForm = (): PaymentFormState => ({
  amount: '',
  date: new Date().toISOString().slice(0, 10),
})

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Loans() {
  const navigate = useNavigate()
  const { loans, totalOwed } = useLoans()
  const { format, symbol } = useCurrency()
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm())
  const [addErrors, setAddErrors] = useState<Partial<AddFormState>>({})

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm())
  const [paymentErrors, setPaymentErrors] = useState<Partial<PaymentFormState>>({})

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // — Add Loan modal —
  function openAdd() {
    setAddForm(emptyAddForm())
    setAddErrors({})
    setShowAddModal(true)
  }

  function closeAdd() {
    setShowAddModal(false)
    setAddForm(emptyAddForm())
    setAddErrors({})
  }

  function validateAdd(): boolean {
    const e: Partial<AddFormState> = {}
    if (!addForm.person.trim()) e.person = 'Person name is required'
    const amt = parseFloat(addForm.amount)
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0'
    if (!addForm.date) e.date = 'Date is required'
    setAddErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAddSave() {
    if (!validateAdd()) return
    await addLoan(
      addForm.person.trim(),
      parseFloat(addForm.amount),
      addForm.date,
      addForm.note.trim() || undefined,
    )
    closeAdd()
  }

  // — Log Payment modal —
  function openPayment(loan: Loan) {
    setPaymentLoan(loan)
    setPaymentForm(emptyPaymentForm())
    setPaymentErrors({})
  }

  function closePayment() {
    setPaymentLoan(null)
    setPaymentForm(emptyPaymentForm())
    setPaymentErrors({})
  }

  function validatePayment(): boolean {
    const e: Partial<PaymentFormState> = {}
    const amt = parseFloat(paymentForm.amount)
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0'
    if (!paymentForm.date) e.date = 'Date is required'
    setPaymentErrors(e)
    return Object.keys(e).length === 0
  }

  async function handlePaymentSave() {
    if (!paymentLoan?.id || !validatePayment()) return
    await logLoanPayment(paymentLoan.id, parseFloat(paymentForm.amount), paymentForm.date)
    closePayment()
  }

  // — Delete —
  function handleDelete(loan: Loan) {
    scheduleDelete(
      `Loan to "${loan.person}" deleted`,
      () => deleteLoan(loan.id!),
      () => {},
    )
  }

  // — Expand/collapse payment history —
  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group by person: show all individual loans but group under same person header
  // We display each loan card individually (not merged) so payments can be logged per loan
  const pendingLoans = loans?.filter(l => l.status === 'pending') ?? []
  const returnedLoans = loans?.filter(l => l.status === 'returned') ?? []

  function LoanCard({ loan }: { loan: Loan }) {
    const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0)
    const balance = Math.max(0, loan.totalAmount - totalPaid)
    const isReturned = loan.status === 'returned'
    const isExpanded = loan.id !== undefined && expandedIds.has(loan.id)

    return (
      <div className="bg-surface rounded-2xl overflow-hidden">
        {/* Main row */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">{loan.person}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isReturned ? 'text-income bg-income/10' : 'text-amber-500 bg-amber-500/10'
                }`}>
                  {isReturned ? 'Returned' : 'Pending'}
                </span>
              </div>

              {/* Amount breakdown */}
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="text-base font-bold">{format(loan.totalAmount)}</span>
                <span className="text-xs text-text-muted">lent</span>
                {totalPaid > 0 && (
                  <>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-income">{format(totalPaid)} back</span>
                  </>
                )}
              </div>

              {!isReturned && (
                <p className="text-sm font-semibold text-amber-500 mt-0.5">
                  {format(balance)} owed
                </p>
              )}

              <p className="text-xs text-text-muted mt-0.5">Lent {fmtDate(loan.date)}</p>
              {loan.note && (
                <p className="text-xs text-text-muted mt-0.5 truncate">{loan.note}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0 shrink-0">
              {!isReturned && (
                <button
                  onClick={() => openPayment(loan)}
                  className="px-2.5 py-2 rounded-xl bg-income/10 text-income text-xs font-semibold min-h-[44px] flex items-center justify-center whitespace-nowrap"
                >
                  Log Return
                </button>
              )}
              <DeleteButton onConfirm={() => handleDelete(loan)} size={14} />
            </div>
          </div>

          {/* Payment history toggle */}
          {loan.payments.length > 0 && loan.id !== undefined && (
            <button
              onClick={() => toggleExpanded(loan.id!)}
              className="flex items-center gap-1 mt-2 text-xs text-text-muted active:opacity-60"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {loan.payments.length} payment{loan.payments.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Payment history */}
        {isExpanded && loan.payments.length > 0 && (
          <div className="border-t border-surface-light px-4 pb-3 pt-2 space-y-2">
            {loan.payments
              .slice()
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{fmtDate(p.date)}</span>
                  <span className="text-xs font-medium text-income">+{format(p.amount)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: Loan[] }) {
    if (items.length === 0) return null
    return (
      <div className="mb-4">
        <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2 px-1">{title}</p>
        <div className="space-y-3">
          {items.map(loan => <LoanCard key={loan.uid} loan={loan} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Loans</h1>
          {totalOwed !== undefined && totalOwed > 0 && (
            <p className="text-xs text-text-muted">{format(totalOwed)} total owed to you</p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* List */}
      {loans === undefined ? (
        <div className="text-center text-text-muted py-12 text-sm">Loading...</div>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <HandCoins size={36} className="text-text-muted opacity-40" />
          <p className="text-text-muted text-sm">No loans tracked yet</p>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium mt-1"
          >
            Track your first loan
          </button>
        </div>
      ) : (
        <>
          <Section title="Pending" items={pendingLoans} />
          <Section title="Returned" items={returnedLoans} />
        </>
      )}

      {/* Add Loan Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeAdd() }}
        >
          <div className="w-full bg-surface rounded-t-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[90svh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">Add Loan</h2>
              <button
                onClick={closeAdd}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Person */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Person *</label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Mom"
                  value={addForm.person}
                  onChange={e => setAddForm(f => ({ ...f, person: e.target.value }))}
                  className="w-full text-sm"
                  autoFocus
                />
                {addErrors.person && <p className="text-xs text-expense mt-1">{addErrors.person}</p>}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={addForm.amount}
                    onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                    style={{ paddingLeft: '1.75rem' }}
                    className="w-full text-sm"
                  />
                </div>
                {addErrors.amount && <p className="text-xs text-expense mt-1">{addErrors.amount}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Date Lent *</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full text-sm"
                />
                {addErrors.date && <p className="text-xs text-expense mt-1">{addErrors.date}</p>}
              </div>

              {/* Note */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. For groceries"
                  value={addForm.note}
                  onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full text-sm"
                />
              </div>

              <button
                onClick={handleAddSave}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold mt-2"
              >
                Add Loan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Return Payment Modal */}
      {paymentLoan && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closePayment() }}
        >
          <div className="w-full bg-surface rounded-t-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[90svh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold">Log Return Payment</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {paymentLoan.person} · {format(Math.max(0, paymentLoan.totalAmount - paymentLoan.payments.reduce((s, p) => s + p.amount, 0)))} remaining
                </p>
              </div>
              <button
                onClick={closePayment}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Amount Returned *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    style={{ paddingLeft: '1.75rem' }}
                    className="w-full text-sm"
                    autoFocus
                  />
                </div>
                {paymentErrors.amount && <p className="text-xs text-expense mt-1">{paymentErrors.amount}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Date Received *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full text-sm"
                />
                {paymentErrors.date && <p className="text-xs text-expense mt-1">{paymentErrors.date}</p>}
              </div>

              <button
                onClick={handlePaymentSave}
                className="w-full py-3 bg-income text-white rounded-xl text-sm font-semibold mt-2"
              >
                Log Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <UndoToast message={toast.message} onUndo={toast.onUndo} onDismiss={dismiss} />
      )}
    </div>
  )
}
