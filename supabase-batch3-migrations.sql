-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Expense Tracker Batch 3: per-category budget rollover

alter table public.budgets
  add column if not exists rollover boolean not null default false;
