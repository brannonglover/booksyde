-- A reread is a fresh start.
--
-- started_at used to be stamped only when it was empty, so a book finished last
-- year and moved back to "Reading" kept last year's start date and sank to the
-- end of the "Reading now" shelf. Now any move onto the reading shelf from
-- another shelf restarts the clock, unless the same update sets started_at
-- itself (an explicit date always wins). Imports still leave dates alone.

create or replace function public.stamp_user_book_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_importing() then
    return new;
  end if;
  if new.status = 'reading' then
    if new.started_at is null then
      new.started_at := now();
    elsif tg_op = 'UPDATE'
      and old.status is distinct from 'reading'
      and new.started_at is not distinct from old.started_at then
      new.started_at := now();
    end if;
  elsif new.status = 'read' and new.finished_at is null then
    new.finished_at := now();
  end if;
  return new;
end;
$$;
