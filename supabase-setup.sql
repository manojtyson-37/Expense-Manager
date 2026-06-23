-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Transactions table
create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  category text not null,
  account text not null default '',
  note text not null default '',
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories table
create table if not exists categories (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default '📦',
  color text not null default '#6366f1'
);

-- Accounts table
create table if not exists accounts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('credit_card', 'upi', 'cash', 'bank', 'wallet')),
  icon text not null default '💵',
  color text not null default '#22c55e'
);

-- Enable Row Level Security
alter table transactions enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own transactions" on transactions
  for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on transactions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on transactions
  for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on transactions
  for delete using (auth.uid() = user_id);

create policy "Users can view own categories" on categories
  for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on categories
  for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on categories
  for delete using (auth.uid() = user_id);

create policy "Users can view own accounts" on accounts
  for select using (auth.uid() = user_id);
create policy "Users can insert own accounts" on accounts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on accounts
  for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on accounts
  for delete using (auth.uid() = user_id);
