-- When the daily cover job (/api/cron/covers) last looked for a better cover
-- for a book: it works through the catalogue never-checked first, then
-- longest-ago, most-shelved first within each, so the books readers see
-- improve first and every book comes round again in time.
alter table public.works add column cover_checked_at timestamptz;

create index works_cover_check_idx on public.works (cover_checked_at asc nulls first, shelved_count desc)
  where cover_source is distinct from 'manual';
