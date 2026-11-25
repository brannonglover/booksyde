-- Booksyde buzz: the books readers here are picking up, finishing, reviewing
-- and talking about in clubs right now, for "This week in books".
--
-- Totals per book over the last few days, for the daily news job only (it
-- holds the service role). Security definer so private readers and private
-- clubs count, but only totals come back, and only for books at least
-- min_readers different people were active on, so no story can point at one
-- reader. The job also waits for has_crowd() before writing any buzz at all.
-- Imported reading histories never log activity, so a big import isn't buzz.
create function public.buzz_works(days integer default 7, min_readers integer default 3, max_results integer default 10)
returns table (
  work_id uuid,
  readers integer,
  shelved integer,
  started integer,
  finished integer,
  reviewed integer,
  club_posts integer,
  clubs integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select now() - make_interval(days => least(greatest(days, 1), 30)) as at
  ),
  acts as (
    select a.work_id, a.actor_id as user_id, a.verb::text as what, null::uuid as club_id
      from public.activities a, since
     where a.created_at >= since.at
       and a.work_id is not null
       and a.verb in ('shelved', 'started', 'finished', 'rated', 'reviewed')
    union all
    -- Club talk counts for the book the club is reading.
    select cr.work_id, p.user_id, 'post', p.club_id
      from public.club_posts p
      join public.club_reads cr on cr.id = p.club_read_id
      , since
     where p.created_at >= since.at
  )
  select a.work_id,
         count(distinct a.user_id)::integer as readers,
         count(distinct a.user_id) filter (where a.what = 'shelved')::integer,
         count(distinct a.user_id) filter (where a.what = 'started')::integer,
         count(distinct a.user_id) filter (where a.what = 'finished')::integer,
         count(distinct a.user_id) filter (where a.what = 'reviewed')::integer,
         count(*) filter (where a.what = 'post')::integer,
         count(distinct a.club_id)::integer
    from acts a
   group by a.work_id
  having count(distinct a.user_id) >= greatest(min_readers, 1)
   order by count(distinct a.user_id) desc,
            count(*) filter (where a.what = 'post') desc,
            count(distinct a.user_id) filter (where a.what = 'reviewed') desc,
            a.work_id
   limit least(greatest(max_results, 1), 50);
$$;

revoke execute on function public.buzz_works(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.buzz_works(integer, integer, integer) to service_role;

-- has_crowd() was granted to readers only; the news job asks it too.
grant execute on function public.has_crowd(public.reading_status) to service_role;

create index if not exists activities_recent_idx on public.activities (created_at desc) where work_id is not null;
create index if not exists club_posts_recent_idx on public.club_posts (created_at desc);
