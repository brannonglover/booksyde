-- Community totals only lean on reader activity once enough different readers
-- are behind them. With one or two readers, "everyone's nightstand" or "the
-- most-shelved books" is really just those readers' shelves, and signed-out
-- visitors would see exactly what they're reading. Below the threshold these
-- fall back to the catalogue alone: books with covers, the ones with the most
-- editions first (a rough "widely published" signal no reader can move).

-- How many different readers a community total needs before it's shown.
create function public.min_crowd()
returns integer
language sql
immutable
as $$ select 5 $$;

-- Whether at least min_crowd() different readers have a book with this status
-- (any status when null). Security definer so private readers count; only a
-- yes/no comes back.
create function public.has_crowd(book_status public.reading_status default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct ub.user_id) >= public.min_crowd()
    from public.user_books ub
   where book_status is null or ub.status = book_status;
$$;

revoke execute on function public.has_crowd(public.reading_status) from public;
grant execute on function public.has_crowd(public.reading_status) to anon, authenticated;

-- "On everyone's nightstand": as before once enough people are reading;
-- until then, catalogue books with no reader counts.
create or replace function public.nightstand_works(max_results integer default 10)
returns table (work_id uuid, readers integer)
language sql
stable
security definer
set search_path = ''
as $$
  with crowd as (
    select public.has_crowd('reading') as reading, public.has_crowd() as shelving
  ),
  reading as (
    select ub.work_id, count(*)::integer as readers, max(coalesce(ub.started_at, ub.updated_at)) as latest
      from public.user_books ub
     where ub.status = 'reading'
       and (select c.reading from crowd c)
     group by ub.work_id
  )
  select w.id, coalesce(r.readers, 0)
    from public.works w
    cross join crowd c
    left join reading r on r.work_id = w.id
   where c.reading or w.cover_url is not null
   order by coalesce(r.readers, 0) desc,
            r.latest desc nulls last,
            case when c.shelving then w.shelved_count end desc nulls last,
            case when c.shelving then w.ratings_count end desc nulls last,
            (select count(*) from public.editions e where e.work_id = w.id) desc,
            w.title
   limit least(greatest(max_results, 1), 50);
$$;

-- The pool the home page's pick of the day rotates through: the most-shelved
-- books with covers once enough people are shelving, catalogue books before.
create function public.featured_pool(max_results integer default 30)
returns table (work_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with crowd as (select public.has_crowd() as shelving)
  select w.id
    from public.works w
    cross join crowd c
   where w.cover_url is not null
   order by case when c.shelving then w.shelved_count end desc nulls last,
            (select count(*) from public.editions e where e.work_id = w.id) desc,
            w.title
   limit least(greatest(max_results, 1), 100);
$$;

revoke execute on function public.featured_pool(integer) from public;
grant execute on function public.featured_pool(integer) to anon, authenticated;
