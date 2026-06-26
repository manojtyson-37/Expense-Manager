-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Adds a stable cross-device id to transactions so edits update the same row
-- instead of creating duplicates.

alter table transactions add column if not exists uid text;

-- Fast lookup / merge by (user, uid)
create index if not exists transactions_user_uid_idx on transactions(user_id, uid);

-- Backfill any existing rows that have no uid yet.
-- gen_random_uuid() is available via the pgcrypto extension (enabled by default
-- on Supabase). The app also self-heals null uids on next sync, but this keeps
-- the data clean immediately.
update transactions set uid = gen_random_uuid()::text where uid is null;
