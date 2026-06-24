-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Budgets table
create table if not exists budgets (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  limit_amount numeric(12,2) not null,
  month text not null
);

-- Enable RLS
alter table budgets enable row level security;

-- RLS Policies
create policy "Users can view own budgets" on budgets
  for select using (auth.uid() = user_id);
create policy "Users can insert own budgets" on budgets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own budgets" on budgets
  for update using (auth.uid() = user_id);
create policy "Users can delete own budgets" on budgets
  for delete using (auth.uid() = user_id);
