-- Readers can arrange their "Reading now" and "Want to read" shelves by hand.
--
-- shelved_at  when the book went onto the shelf it's on now ("date added").
--             Set from created_at on insert (so imports keep Goodreads' date
--             added) and restamped whenever the book moves to another shelf.
-- position    the reader's own order within that shelf, or null. Null until
--             the reader arranges the shelf; cleared when the book changes
--             shelves.
--
-- A shelf reads as: position (nulls first), then shelved_at newest first. So an
-- untouched shelf is simply by date added, and a book added to an arranged
-- shelf lands at the front until the reader places it.

alter table public.user_books
  add column shelved_at timestamptz not null default now(),
  add column position integer;

-- Backfill. A book on "Reading now" was added there when it was started (the
-- reread fix restamps started_at on every move onto that shelf); everything
-- else uses when it was first shelved.
update public.user_books
   set shelved_at = case when status = 'reading' then coalesce(started_at, created_at) else created_at end;

create index user_books_shelf_order_idx
  on public.user_books (user_id, status, position nulls first, shelved_at desc);

create function public.place_user_book()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.shelved_at := new.created_at;
    new.position := null;
  elsif new.status is distinct from old.status and not public.is_importing() then
    new.shelved_at := now();
    new.position := null;
  end if;
  return new;
end;
$$;

create trigger user_books_place before insert or update of status on public.user_books
  for each row execute function public.place_user_book();

-- Save the reader's order for one of their shelves: p_work_ids front to back.
-- Books on the shelf that aren't listed (or every book, when p_work_ids is null
-- or empty) go back to date-added order.
create function public.arrange_shelf(p_status public.reading_status, p_work_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  with wanted as (
    select ub.work_id, (min(o.ord) - 1)::integer as pos
      from public.user_books ub
      left join unnest(coalesce(p_work_ids, '{}')) with ordinality o (work_id, ord) on o.work_id = ub.work_id
     where ub.user_id = v_user and ub.status = p_status
     group by ub.work_id
  )
  update public.user_books ub
     set position = w.pos
    from wanted w
   where ub.user_id = v_user
     and ub.work_id = w.work_id
     and ub.position is distinct from w.pos;
end;
$$;

revoke execute on function public.arrange_shelf(public.reading_status, uuid[]) from public, anon;
grant execute on function public.arrange_shelf(public.reading_status, uuid[]) to authenticated;

-- "Your next read" follows the shelves: the book at the front of "Reading now",
-- else the next in a series, else the front of "Want to read", else taste.
-- Unchanged apart from the ordering of steps 1 and 3.
create or replace function public.next_read()
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
     order by ub.position asc nulls first, ub.shelved_at desc
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

  -- 3. The front of their Want to Read shelf.
  return query
    select ub.work_id, 'want_to_read'::text, null::text
      from public.user_books ub
     where ub.user_id = v_user and ub.status = 'want_to_read'
     order by ub.position asc nulls first, ub.shelved_at desc
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
