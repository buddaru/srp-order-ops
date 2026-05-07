-- Gmail history-based sync: tracks last-seen historyId for incremental fetch,
-- and persists per-message parse failures so they can be inspected and retried.
-- Run once in Supabase SQL editor.

-- 1. Add last_history_id to gmail_tokens for incremental Gmail history sync.
alter table gmail_tokens
  add column if not exists last_history_id text;

-- 2. failed_imports — one row per Gmail message that couldn't be parsed/inserted.
--    The sync upserts on gmail_message_id so retries overwrite the previous row.
create table if not exists failed_imports (
  gmail_message_id text primary key,
  subject          text,
  sender           text,
  reason           text not null,
  raw_html         text,
  attempted_at     timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists failed_imports_unresolved_idx
  on failed_imports (attempted_at desc)
  where resolved_at is null;

alter table failed_imports enable row level security;

-- Service role bypasses RLS. Authenticated users can read so the UI can show a badge.
create policy "authenticated read failed_imports" on failed_imports
  for select using (auth.role() = 'authenticated');
