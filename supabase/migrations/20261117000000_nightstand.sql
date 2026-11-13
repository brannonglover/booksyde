-- "On everyone's nightstand": the books the most readers are reading right now.
-- Security definer so private readers count too (like work_rating_distribution);
-- only per-book totals come back, never who is reading what.
-- When too few books are being read to fill the shelf, it tops up with the
-- most-shelved books (readers = 0), so the home page never sits half empty.
create function public.nightstand_works(max_results integer default 10)
returns table (work_id uuid, readers integer)
language sql
stable
security definer
set search_path = ''
as $$
  with reading as (
    select ub.work_id, count(*)::integer as readers, max(coalesce(ub.started_at, ub.updated_at)) as latest
      from public.user_books ub
     where ub.status = 'reading'
     group by ub.work_id
  )
  select w.id, coalesce(r.readers, 0)
    from public.works w
    left join reading r on r.work_id = w.id
   order by coalesce(r.readers, 0) desc, r.latest desc nulls last, w.shelved_count desc, w.ratings_count desc, w.title
   limit least(greatest(max_results, 1), 50);
$$;

revoke execute on function public.nightstand_works(integer) from public;
grant execute on function public.nightstand_works(integer) to anon, authenticated;

-- Grouping every "reading" row by work.
create index user_books_reading_idx on public.user_books (work_id) where status = 'reading';
