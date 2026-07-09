-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Expense Tracker Batch 4: server-side snapshot before "Clear All Data"

-- A full JSON snapshot of a user's data, written right before clearAllData()
-- deletes everything from local + cloud. Distinct from the manual "Export
-- Backup" download — this is an automatic, server-held safety net so a
-- deletion always has a recoverable copy even if the auto-downloaded local
-- file is lost. Append-only from the client: insert + select policies only,
-- no update/delete — a user's own past snapshots can't be tampered with or
-- silently removed through the app.
create table if not exists public.data_deletion_backups (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text not null default 'clear_all_data',
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.data_deletion_backups enable row level security;

create policy "Users can view own deletion backups"
  on public.data_deletion_backups
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own deletion backups"
  on public.data_deletion_backups
  for insert
  with check (auth.uid() = user_id);
