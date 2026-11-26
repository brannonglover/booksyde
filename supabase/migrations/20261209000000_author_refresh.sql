-- The daily author job (/api/cron/authors): fills in a portrait for authors
-- who have none (Open Library's, else a freely licensed one from Wikimedia
-- Commons via Wikidata) and adds the books of theirs we don't hold yet from
-- Open Library, so an author page shows more than the one or two books
-- readers happened to search for.
--
-- A Commons photo has to name its photographer and licence wherever it's
-- shown, so it carries a credit and a link to its Commons page. Open
-- Library's portraits need neither, and leave both null.
alter table public.authors
  add column photo_credit text,
  add column photo_credit_url text,
  add column catalogue_checked_at timestamptz;

-- Authors readers care about (on a shelf or followed), never-checked first,
-- then longest-ago, most-read first within each, so every one comes round
-- again in time and picks up books published since. For the daily job only.
create function public.authors_to_refresh(max_results integer default 40)
returns table (author_id uuid, name text, open_library_id text, photo_url text, readers integer)
language sql
stable
security definer
set search_path = ''
as $$
  with readers as (
    select wc.author_id, ub.user_id
      from public.user_books ub
      join public.work_contributors wc on wc.work_id = ub.work_id and wc.role = 'author'
    union
    select af.author_id, af.user_id
      from public.author_follows af
  )
  select a.id, a.name, a.open_library_id, a.photo_url, count(distinct r.user_id)::integer
    from readers r
    join public.authors a on a.id = r.author_id
   group by a.id
   order by a.catalogue_checked_at nulls first, count(distinct r.user_id) desc, a.name
   limit least(greatest(max_results, 1), 200);
$$;

revoke execute on function public.authors_to_refresh(integer) from public, anon, authenticated;
grant execute on function public.authors_to_refresh(integer) to service_role;
