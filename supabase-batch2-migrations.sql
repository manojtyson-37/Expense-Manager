-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Expense Tracker Batch 2: recurring income, loan due dates, savings goals

-- ─── subscriptions.type (income vs expense) ──────────────────────────────────
alter table public.subscriptions
  add column if not exists type text not null default 'expense'
  check (type in ('income', 'expense'));

-- ─── loans.due_date ───────────────────────────────────────────────────────────
alter table public.loans
  add column if not exists due_date text; -- YYYY-MM-DD, nullable

-- ─── GOALS ────────────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  uid           text not null,
  name          text not null,
  target_amount numeric not null,
  target_date   text,                  -- YYYY-MM-DD, nullable
  saved_amount  numeric not null default 0,
  created_at    timestamptz default now(),
  unique (user_id, uid)                -- required for upsert onConflict: 'user_id,uid'
);

alter table public.goals enable row level security;

create policy "Users can manage their own goals"
  on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
