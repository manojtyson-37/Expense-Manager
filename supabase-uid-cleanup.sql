-- Run this in Supabase Dashboard → SQL Editor → New Query
-- One-time cleanup after the uid rollout. Fixes duplicate rows created by the
-- uid-divergence sync bug and lets pushes upsert idempotently.

-- 1. Ensure every row has a uid.
update transactions set uid = gen_random_uuid()::text where uid is null;

-- 2. Merge identical rows (same type/amount/category/account/note/date),
--    keeping the lowest id. This collapses the duplicates the bad sync created.
delete from transactions a using transactions b
 where a.user_id = b.user_id and a.id > b.id
   and a.type = b.type
   and a.amount = b.amount
   and a.category = b.category
   and coalesce(a.account,'') = coalesce(b.account,'')
   and a.note = b.note
   and a.date = b.date;

-- 3. Unique index on (user_id, uid) — required for upsert onConflict, and
--    guarantees a uid can never produce two rows again.
drop index if exists transactions_user_uid_idx;
create unique index if not exists transactions_user_uid_uniq on transactions(user_id, uid);
