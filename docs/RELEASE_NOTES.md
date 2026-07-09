# Release Notes

This file tracks feature releases for Expense Tracker. It's written to double as
reference material — if you're an AI agent answering questions about this app,
this document describes what each feature does and how it behaves, independent
of the code that implements it.

---

## v1.3 — 2026-07-09

Fourteen features shipped in five batches, plus two reliability fixes found
along the way.

### Offline & sync reliability

- **Offline editing works for every entity, not just some.** Categories,
  accounts, and budgets now queue changes made while offline and sync them
  automatically once you're back online — matching how transactions,
  subscriptions, and loans already worked.
- **Deleting a default category while offline no longer resurrects it.**
  Fixed a bug where the "this category is deleted" marker could itself get
  deleted by the same offline sync batch, causing the category to silently
  reappear on the next sync.
- **A single broken sync entry can no longer freeze all future syncs.** If one
  queued change fails permanently (e.g. a bad payload), it's retried up to 5
  times then dropped — it no longer blocks every other pending change forever.
- **Budget edits that fail to save to the cloud are no longer silent.**
  Previously a failed cloud save for a budget produced no error at all; now
  it's logged so the problem is visible.

### Backup

- **Backup export/import now covers everything**, not just transactions,
  categories, and accounts. Budgets, subscriptions, loans, and savings goals
  are included too — this is the only full disaster-recovery path for the app,
  so it needed to be complete.
- **CSV import.** You could already export transactions to CSV; now you can
  import a CSV back in (same format: `Date,Type,Category,Account,Amount,Note`).
  Invalid rows are skipped and counted rather than failing the whole file.

### Recurring & scheduled money

- **Recurring income.** Subscriptions can now be marked as income (e.g. a
  monthly salary or retainer) instead of only expenses. The dashboard's
  "Recurring" spend card only counts expense subscriptions, so income
  subscriptions don't inflate it.
- **Loan due dates + overdue reminders.** Loans (money lent or borrowed) can
  now have an optional due date. Overdue pending loans show a red "Overdue"
  badge, and the app shows a reminder (once per day) if any loan is overdue.
- **Budget copy-forward.** One tap copies every budget from last month into
  the current month, skipping any category you've already budgeted this
  month. Safe to tap more than once.
- **Per-category budget rollover.** An opt-in toggle per budget carries last
  month's unused (or overspent) amount into this month's effective limit.
  Toggling it off is non-destructive — your actual budget number is never
  changed by the rollover math, only how it's displayed.

### Visibility & insight

- **Spending trend chart.** A new Trends page shows income vs. expense as a
  bar chart for the last 6 months.
- **Category-over-time breakdown.** The same Trends page shows your top 5
  expense categories broken down month-by-month as a stacked bar chart, so
  you can see which categories dominate your spending over time.
- **Large-transaction flag.** When adding an expense, if the amount is more
  than double that category's typical spend (based on the last 90 days), you
  get a non-blocking heads-up. It only appears once a category has enough
  history (3+ prior transactions) to have a meaningful average.
- **Note field now doubles as a merchant field**, relabeled "Note / Merchant"
  with merchant-style placeholder examples — sets up the auto-categorization
  feature below.

### Savings goals

- **New Goals feature.** Set a savings target (name, target amount, optional
  target date), log money saved toward it over time, and see progress at a
  glance. A featured goal appears as a progress bar on the dashboard.

### Automation

- **Rule-based auto-categorization.** Create rules like "if the note contains
  'Swiggy', set category to Food." When adding a new transaction, matching
  rules auto-fill the category (with a visible "auto-set by rule" note so it's
  never a silent surprise). Rules are managed from the Categories page.
  Rules only apply when adding a transaction, never when editing one — editing
  never overrides a category you already chose.
- **Receipt photos.** Attach a photo of a receipt to any transaction (camera
  capture or file picker) after it's been saved. Receipts stay on the device
  they were added on — they are **not** backed up or synced to another device,
  since there's no cloud storage configured for photos.
- **Local notifications.** Opt in from Settings to get notified (while the app
  is open) about: an overdue loan, a subscription renewing within 2 days, or a
  budget that's hit its limit. Checked once per day, not on every app open.
  These are local/in-app notifications, not push notifications delivered while
  the app is fully closed.

### What's intentionally NOT included in this release

These were considered and explicitly deferred, not forgotten:

- **SMS/UPI auto-parsing of transactions** — deferred; manual entry is kept
  deliberately, as a discipline choice.
- **Net worth card, Account Aggregator integration, year-in-review report,
  home-screen balance widget** — parked for a later release; the current
  "cash balance" number isn't yet a complete enough picture (excludes
  investments, etc.) to make a home-screen widget meaningful.
- **Household/collaborative sharing, AI/LLM-based categorization, credit score
  tracking, full investment portfolio management, bank feed aggregation,
  multi-currency-per-transaction, forced envelope budgeting** — all
  considered and rejected as out of scope for a single-user personal tracker;
  see the audit discussion for the reasoning behind each.

### Known follow-ups (non-blocking, tracked for a future pass)

- A dropped-after-5-tries sync entry is only logged to a local browser log
  (`localStorage['expense-tracker-outbox-failures']`), not surfaced anywhere
  in the UI.
- If the *first* step of a two-step offline sync operation (e.g. category
  tombstone-then-delete) permanently fails and gets dropped, the second step
  can still run — a narrow edge case of the same class as the tombstone bug
  fixed in this release, not yet closed for every multi-step case.
- Receipt photos aren't deleted when their transaction is deleted (they're
  orphaned, not lost) — a minor local-storage cleanliness issue, not a data
  problem.
- "Budget over limit" notification is checked once daily, not continuously —
  it won't catch you going over budget mid-day until the next check.

### Requires manual setup (one-time)

Two Supabase schema migrations must be run once in the Supabase SQL Editor
before recurring income type, loan due dates, savings goals cloud sync, and
budget rollover cloud sync are fully active across devices:
`supabase-batch2-migrations.sql` and `supabase-batch3-migrations.sql` (repo
root). Everything works locally on the device it's used on even before these
run; the migrations only affect syncing those specific new fields to the
cloud / other devices.

---

## App overview (for reference)

Expense Tracker is a single-user personal finance PWA (installable web app),
built with React + Vite + Tailwind, storing data locally (offline-first) and
syncing to a Supabase cloud backend. Currency defaults to INR (₹), configurable
in Settings.

**Core entities:** Transactions (income/expense), Categories, Accounts (cash,
UPI, credit card, bank, wallet), Budgets (per category, per month), Recurring
Subscriptions (income or expense), Loans (money lent or borrowed, with partial
payment tracking), Savings Goals.

**Key screens:** Dashboard (monthly summary, spending breakdown, recurring/
loans/goals cards), Transactions (search, CSV export/import), Categories
(with auto-categorization rules), Accounts, Budgets, Subscriptions, Loans,
Goals, Trends (charts), Settings (currency, backup, notifications, account
management).
