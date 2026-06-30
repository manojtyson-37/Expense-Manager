-- Expense Tracker: Subscriptions and Loans tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/wqligdlzjkccmflaeqxz/sql
-- Created for Task 10 QA: these tables are required for cloud sync of subscriptions and loans features.

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  uid         text not null,
  name        text not null,
  amount      numeric not null,
  frequency   text not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date  text not null,        -- YYYY-MM-DD
  end_date    text,                  -- YYYY-MM-DD, nullable
  status      text not null default 'active' check (status in ('active','paused','cancelled')),
  category    text,
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, uid)             -- required for upsert onConflict: 'user_id,uid'
);

-- Enable Row Level Security
alter table public.subscriptions enable row level security;

-- RLS policy: users can only see/edit their own subscriptions
create policy "Users can manage their own subscriptions"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── LOANS ───────────────────────────────────────────────────────────────────
create table if not exists public.loans (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  uid          text not null,
  person       text not null,
  total_amount numeric not null,
  date         text not null,        -- YYYY-MM-DD
  status       text not null default 'pending' check (status in ('pending','returned')),
  payments     jsonb not null default '[]'::jsonb,  -- array of PaymentRecord: {amount, date, createdAt}
  note         text,
  created_at   timestamptz default now(),
  unique (user_id, uid)              -- required for upsert onConflict: 'user_id,uid'
);

-- Enable Row Level Security
alter table public.loans enable row level security;

-- RLS policy: users can only see/edit their own loans
create policy "Users can manage their own loans"
  on public.loans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
