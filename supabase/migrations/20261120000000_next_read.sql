-- "Your next read": one book for the signed-in reader, and why it was picked.
-- Tried in order, first hit wins:
--   reading       the book they have open (most recently started)
--   series        the next unread book in a series they've been reading
--   want_to_read  the book they most recently put on their Want to Read shelf
--   taste         an unshelved book sharing the most tags with books they loved
-- Returns no row when signed out or when nothing fits; the caller falls back to
-- a public pick. Security invoker: RLS keeps it to the caller's own shelves.
-- `context` is the series name (series) or the loved book's title (taste).
create function public.next_read()
returns table (work_id uuid, reason text, context text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  -- 1. Pick up where they left off.
  return query
    select ub.work_id, 'reading'::text, null::text
      from public.user_books ub
     where ub.user_id = v_user and ub.status = 'reading'
     order by coalesce(ub.started_at, ub.updated_at) desc
     limit 1;
  if found then return; end if;

  -- 2. The next book in a series: the lowest-numbered entry after the furthest
  --    one they've read, that they haven't read, started or abandoned.
  return query
    with progress as (
      select sw.series_id, max(sw.position) as read_to, max(ub.finished_at) as latest
        from public.user_books ub
        join public.series_works sw on sw.work_id = ub.work_id
       where ub.user_id = v_user and ub.status = 'read' and sw.position is not null
       group by sw.series_id
    )
    select nxt.work_id, 'series'::text, s.name
      from progress p
      join public.series s on s.id = p.series_id
      cross join lateral (
        select sw.work_id
          from public.series_works sw
         where sw.series_id = p.series_id
           and sw.position > p.read_to
           and not exists (
             select 1 from public.user_books ub
              where ub.user_id = v_user and ub.work_id = sw.work_id and ub.status <> 'want_to_read'
           )
         order by sw.position
         limit 1
      ) nxt
     order by p.latest desc nulls last
     limit 1;
  if found then return; end if;

  -- 3. What they most recently said they wanted to read.
  return query
    select ub.work_id, 'want_to_read'::text, null::text
      from public.user_books ub
     where ub.user_id = v_user and ub.status = 'want_to_read'
     order by ub.created_at desc
     limit 1;
  if found then return; end if;

  -- 4. Taste: weigh each tag by how much they liked the books carrying it
  --    (5 stars = 3, 4+ = 2, read but unrated or still reading = 1, under 4 = 0),
  --    then pick the unshelved book whose tags add up highest.
  return query
    with liked as (
      select ub.work_id,
             case
               when r.rating >= 4.5 then 3
               when r.rating >= 4 then 2
               when r.rating is null then 1
               else 0
             end as weight
        from public.user_books ub
        left join public.reviews r on r.user_id = ub.user_id and r.work_id = ub.work_id
       where ub.user_id = v_user and ub.status in ('read', 'reading')
    ),
    taste as (
      select wt.tag_id, sum(l.weight) as weight
        from liked l
        join public.work_tags wt on wt.work_id = l.work_id
        join public.tags t on t.id = wt.tag_id and t.kind <> 'content_warning'
       where l.weight > 0
       group by wt.tag_id
    ),
    pick as (
      select wt.work_id, sum(ta.weight) as score
        from taste ta
        join public.work_tags wt on wt.tag_id = ta.tag_id
       where not exists (
         select 1 from public.user_books ub where ub.user_id = v_user and ub.work_id = wt.work_id
       )
       group by wt.work_id
    )
    select p.work_id, 'taste'::text, seed.title
      from pick p
      join public.works w on w.id = p.work_id
      -- The loved book it has the most in common with, to say "because you loved…".
      cross join lateral (
        select sw.title
          from liked l
          join public.works sw on sw.id = l.work_id
          join public.work_tags a on a.work_id = l.work_id
          join public.work_tags b on b.work_id = p.work_id and b.tag_id = a.tag_id
         where l.weight > 0
         group by sw.id, sw.title, l.weight
         order by count(*) desc, l.weight desc, sw.title
         limit 1
      ) seed
     order by p.score desc, (w.cover_url is not null) desc, w.shelved_count desc, w.ratings_count desc, w.title
     limit 1;
end;
$$;

revoke execute on function public.next_read() from public, anon;
grant execute on function public.next_read() to authenticated;
