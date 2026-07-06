import { useState } from 'react'
import { ArrowLeft, Plus, HandCoins, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLoans, addLoan, logLoanPayment, deleteLoan, updateLoan } from '../hooks/useLoans'
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

interface LoanCardProps {
  loan: Loan
  expandedIds: Set<number>
  toggleExpanded: (id: number) => void
  openEdit: (loan: Loan) => void
  openPayment: (loan: Loan) => void
  handleDelete: (loan: Loan) => void
  format: (n: number) => string
}

function LoanCard({ loan, expandedIds, toggleExpanded, openEdit, openPayment, handleDelete, format }: LoanCardProps) {
  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0)
  const balance = Math.max(0, loan.totalAmount - totalPaid)
  const isReturned = loan.status === 'returned'
  const isExpanded = loan.id !== undefined && expandedIds.has(loan.id)
  const loanIsBorrowed = (loan.type ?? 'lent') === 'borrowed'

  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3" onClick={() => openEdit(loan)} style={{ cursor: 'pointer' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{loan.person}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isReturned
                  ? 'text-income bg-income/10'
                  : loanIsBorrowed
                    ? 'text-expense bg-expense/10'
                    : 'text-amber-500 bg-amber-500/10'
              }`}>
                {isReturned ? (loanIsBorrowed ? 'Paid' : 'Returned') : 'Pending'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-base font-bold">{format(loan.totalAmount)}</span>
              <span className="text-xs text-text-muted">{loanIsBorrowed ? 'borrowed' : 'lent'}</span>
              {totalPaid > 0 && (
                <>
                  <span className="text-xs text-text-muted">·</span>
                  <span className={`text-xs ${loanIsBorrowed ? 'text-expense' : 'text-income'}`}>
                    {format(totalPaid)} {loanIsBorrowed ? 'paid' : 'back'}
                  </span>
                </>
              )}
            </div>

            {!isReturned && (
              <p className={`text-sm font-semibold mt-0.5 ${loanIsBorrowed ? 'text-expense' : 'text-amber-500'}`}>
                {format(balance)} {loanIsBorrowed ? 'left to pay' : 'owed'}
              </p>
            )}

            <p className="text-xs text-text-muted mt-0.5">
              {loanIsBorrowed ? 'Borrowed' : 'Lent'} {fmtDate(loan.date)}
            </p>
            {loan.note && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{loan.note}</p>
            )}
          </div>

          <div className="flex items-center gap-0 shrink-0" onClick={e => e.stopPropagation()}>
            {!isReturned && (
              <button
                onClick={() => openPayment(loan)}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] flex items-center justify-center whitespace-nowrap ${
                  loanIsBorrowed
                    ? 'bg-expense/10 text-expense'
                    : 'bg-income/10 text-income'
                }`}
              >
                {loanIsBorrowed ? 'Log Payment' : 'Log Return'}
              </button>
            )}
            <button
              onClick={() => openEdit(loan)}
              className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted active:text-primary"
            >
              <Pencil size={15} />
            </button>
            <DeleteButton onConfirm={() => handleDelete(loan)} size={14} />
          </div>
        </div>

        {loan.payments.length > 0 && loan.id !== undefined && (
          <button
            onClick={e => { e.stopPropagation(); toggleExpanded(loan.id!) }}
            className="flex items-center gap-1 mt-2 text-xs text-text-muted active:opacity-60"
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {loan.payments.length} payment{loan.payments.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {isExpanded && loan.payments.length > 0 && (
        <div className="border-t border-surface-light px-4 pb-3 pt-2 space-y-2">
          {loan.payments
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{fmtDate(p.date)}</span>
                <span className={`text-xs font-medium ${loanIsBorrowed ? 'text-expense' : 'text-income'}`}>
                  {loanIsBorrowed ? '-' : '+'}{format(p.amount)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  items: Loan[]
  cardProps: Omit<LoanCardProps, 'loan'>
}

function Section({ title, items, cardProps }: SectionProps) {
  if (items.length === 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2 px-1">{title}</p>
      <div className="space-y-3">
        {items.map(loan => <LoanCard key={loan.uid} loan={loan} {...cardProps} />)}
      </div>
    </div>
  )
}

export default function Loans() {
  const navigate = useNavigate()
  const { loans, totalOwed, totalOwing } = useLoans()
  const { format, symbol } = useCurrency()
  const { toast, scheduleDelete, dismiss } = useUndoDelete()

  const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent')

  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm())
  const [addErrors, setAddErrors] = useState<Partial<AddFormState>>({})

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm())
  const [paymentErrors, setPaymentErrors] = useState<Partial<PaymentFormState>>({})

  const [editLoan, setEditLoan] = useState<Loan | null>(null)
  const [editForm, setEditForm] = useState<AddFormState>(emptyAddForm())
  const [editErrors, setEditErrors] = useState<Partial<AddFormState>>({})

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const isBorrowed = activeTab === 'borrowed'

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
      activeTab,
    )
    closeAdd()
  }

  function openEdit(loan: Loan) {
    setEditLoan(loan)
    setEditForm({ person: loan.person, amount: String(loan.totalAmount), date: loan.date, note: loan.note ?? '' })
    setEditErrors({})
  }

  function closeEdit() {
    setEditLoan(null)
    setEditForm(emptyAddForm())
    setEditErrors({})
  }

  function validateEdit(): boolean {
    const e: Partial<AddFormState> = {}
    if (!editForm.person.trim()) e.person = 'Person name is required'
    const amt = parseFloat(editForm.amount)
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0'
    if (!editForm.date) e.date = 'Date is required'
    setEditErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleEditSave() {
    if (!editLoan?.id || !validateEdit()) return
    await updateLoan(editLoan.id, editForm.person.trim(), parseFloat(editForm.amount), editForm.date, editForm.note.trim() || undefined)
    closeEdit()
  }

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

  function handleDelete(loan: Loan) {
    const verb = (loan.type ?? 'lent') === 'borrowed' ? 'Debt to' : 'Loan to'
    scheduleDelete(
      `${verb} "${loan.person}" deleted`,
      () => deleteLoan(loan.id!),
      () => {},
    )
  }

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleLoans = (loans ?? []).filter(l => (l.type ?? 'lent') === activeTab)
  const pendingLoans = visibleLoans.filter(l => l.status === 'pending')
  const returnedLoans = visibleLoans.filter(l => l.status === 'returned')

  const cardProps: Omit<LoanCardProps, 'loan'> = {
    expandedIds, toggleExpanded, openEdit, openPayment, handleDelete, format,
  }

  const emptyLabel = isBorrowed ? 'No debts tracked yet' : 'No loans tracked yet'
  const addBtnLabel = isBorrowed ? 'Track your first debt' : 'Track your first loan'

  return (
    <div className="flex-1 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full active:bg-surface-light">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Loans</h1>
          {!isBorrowed && totalOwed !== undefined && totalOwed > 0 && (
            <p className="text-xs text-text-muted">{format(totalOwed)} owed to you</p>
          )}
          {isBorrowed && totalOwing !== undefined && totalOwing > 0 && (
            <p className="text-xs text-expense">{format(totalOwing)} you owe</p>
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

      {/* Tabs */}
      <div className="flex bg-surface rounded-xl p-1 mb-4 gap-1">
        <button
          onClick={() => setActiveTab('lent')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'lent'
              ? 'bg-background text-text shadow-sm'
              : 'text-text-muted'
          }`}
        >
          They Owe Me
          {totalOwed !== undefined && totalOwed > 0 && (
            <span className="ml-1.5 text-[10px] font-semibold text-amber-500">
              {format(totalOwed)}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'borrowed'
              ? 'bg-background text-text shadow-sm'
              : 'text-text-muted'
          }`}
        >
          I Owe
          {totalOwing !== undefined && totalOwing > 0 && (
            <span className="ml-1.5 text-[10px] font-semibold text-expense">
              {format(totalOwing)}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      {loans === undefined ? (
        <div className="text-center text-text-muted py-12 text-sm">Loading...</div>
      ) : visibleLoans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <HandCoins size={36} className="text-text-muted opacity-40" />
          <p className="text-text-muted text-sm">{emptyLabel}</p>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium mt-1"
          >
            {addBtnLabel}
          </button>
        </div>
      ) : (
        <>
          <Section title="Pending" items={pendingLoans} cardProps={cardProps} />
          <Section title={isBorrowed ? 'Paid' : 'Returned'} items={returnedLoans} cardProps={cardProps} />
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeAdd() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <h2 className="text-base font-bold">
                {isBorrowed ? 'Add Debt' : 'Add Loan'}
              </h2>
              <button
                onClick={closeAdd}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
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

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">
                    {isBorrowed ? 'Date Borrowed *' : 'Date Lent *'}
                  </label>
                  <input
                    type="date"
                    value={addForm.date}
                    onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm"
                  />
                  {addErrors.date && <p className="text-xs text-expense mt-1">{addErrors.date}</p>}
                </div>

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
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handleAddSave}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                {isBorrowed ? 'Add Debt' : 'Add Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Payment Modal */}
      {paymentLoan && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closePayment() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold">
                  {(paymentLoan.type ?? 'lent') === 'borrowed' ? 'Log Payment Made' : 'Log Return Payment'}
                </h2>
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

            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">
                    {(paymentLoan.type ?? 'lent') === 'borrowed' ? 'Amount Paid *' : 'Amount Returned *'}
                  </label>
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

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">
                    {(paymentLoan.type ?? 'lent') === 'borrowed' ? 'Date Paid *' : 'Date Received *'}
                  </label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm"
                  />
                  {paymentErrors.date && <p className="text-xs text-expense mt-1">{paymentErrors.date}</p>}
                </div>
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handlePaymentSave}
                className={`w-full py-3 rounded-xl text-sm font-semibold text-white ${
                  (paymentLoan.type ?? 'lent') === 'borrowed' ? 'bg-expense' : 'bg-income'
                }`}
              >
                Log Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editLoan && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={e => { if (e.target === e.currentTarget) closeEdit() }}
        >
          <div className="w-full bg-surface rounded-t-3xl flex flex-col max-h-[90svh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <h2 className="text-base font-bold">
                {(editLoan.type ?? 'lent') === 'borrowed' ? 'Edit Debt' : 'Edit Loan'}
              </h2>
              <button
                onClick={closeEdit}
                className="p-2 text-text-muted active:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5">
              <div className="space-y-4 pb-2">
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Person *</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex, Mom"
                    value={editForm.person}
                    onChange={e => setEditForm(f => ({ ...f, person: e.target.value }))}
                    className="w-full text-sm"
                    autoFocus
                  />
                  {editErrors.person && <p className="text-xs text-expense mt-1">{editErrors.person}</p>}
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{symbol}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={editForm.amount}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ paddingLeft: '1.75rem' }}
                      className="w-full text-sm"
                    />
                  </div>
                  {editErrors.amount && <p className="text-xs text-expense mt-1">{editErrors.amount}</p>}
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">
                    {(editLoan.type ?? 'lent') === 'borrowed' ? 'Date Borrowed *' : 'Date Lent *'}
                  </label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm"
                  />
                  {editErrors.date && <p className="text-xs text-expense mt-1">{editErrors.date}</p>}
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Note (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. For groceries"
                    value={editForm.note}
                    onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                onClick={handleEditSave}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                Save Changes
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
