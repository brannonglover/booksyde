-- "Your next read" by email: near the end of each month, every reader gets a
-- short letter with a handful of ideas for the book after this one. The send
-- job (/api/cron/monthly-picks) runs with the service role; this adds:
--
-- - email_preferences: whether each reader wants the letter, the secret that
--   lets them unsubscribe from the email itself, and the last issue sent (so
--   the job can stop and pick up again without sending anyone two).
-- - monthly_picks(): the ideas for one reader, each with why it was picked.
-- - monthly_picks_recipients(): who still needs this month's issue.
-- - unsubscribe_monthly_picks(): the one-click unsubscribe, by token alone.

create table public.email_preferences (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  monthly_picks     boolean not null default true,
  -- Goes in every letter's unsubscribe link; whoever holds it can only turn the letter off.
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  -- The issue ("2026-12") this reader last received.
  monthly_picks_issue text,
  updated_at        timestamptz not null default now()
);

create trigger email_preferences_updated_at before update on public.email_preferences
  for each row execute function public.set_updated_at();

-- Kept out of profiles, which everyone can read.
alter table public.email_preferences enable row level security;

create policy "View own email preferences" on public.email_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Change own email preferences" on public.email_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Readers may flip the switch; the token and the send log are the job's.
revoke insert, update, delete on public.email_preferences from anon, authenticated;
grant update (monthly_picks) on public.email_preferences to authenticated;

-- Every reader has a row, from sign-up on.
create function public.create_email_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_create_email_preferences after insert on public.profiles
  for each row execute function public.create_email_preferences();

insert into public.email_preferences (user_id)
select p.id from public.profiles p
on conflict do nothing;

-- Turns the letter off for whoever holds the token. True when it matched.
-- Anyone may call it: the token is the proof, so the unsubscribe link works
-- signed out and from a mail app's one-click button.
create function public.unsubscribe_monthly_picks(token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with done as (
    update public.email_preferences
       set monthly_picks = false
     where unsubscribe_token = token
    returning 1
  )
  select exists (select 1 from done);
$$;

revoke execute on function public.unsubscribe_monthly_picks(uuid) from public;
grant execute on function public.unsubscribe_monthly_picks(uuid) to anon, authenticated;

-- Up to max_results ideas for one reader's next book, none of them already
-- read, started or abandoned, each with a reason, in this order:
--   series        the next unread book in each series they've been reading (up to 2)
--   new_release   a new or coming book by an author they follow or have read (up to 2)
--   want_to_read  the front of their Want to Read shelf (up to 2)
--   taste         unshelved books sharing the most tags with books they loved
--   popular       what Booksyde readers shelve most, when the rest come up short
-- `context` is the series name, the author's name or the loved book's title.
-- Same rules as next_read(), for any reader rather than the caller: only the
-- service role may run it.
create function public.monthly_picks(target uuid, max_results integer default 6)
returns table (work_id uuid, reason text, context text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max integer := least(greatest(max_results, 1), 12);
  v_picked uuid[] := '{}';
  v_releases integer := 0;
  v_waiting integer := 0;
  r record;
begin
  -- 1. The next book in each series they're working through.
  for r in
    with progress as (
      select sw.series_id, max(sw.position) as read_to, max(ub.finished_at) as latest
        from public.user_books ub
        join public.series_works sw on sw.work_id = ub.work_id
       where ub.user_id = target and ub.status = 'read' and sw.position is not null
       group by sw.series_id
    )
    select nxt.work_id as id, s.name as ctx
      from progress p
      join public.series s on s.id = p.series_id
      cross join lateral (
        select sw.work_id
          from public.series_works sw
         where sw.series_id = p.series_id
           and sw.position > p.read_to
           and not exists (
             select 1 from public.user_books ub
              where ub.user_id = target and ub.work_id = sw.work_id and ub.status <> 'want_to_read'
           )
         order by sw.position
         limit 1
      ) nxt
     order by p.latest desc nulls last
     limit 2
  loop
    exit when cardinality(v_picked) >= v_max;
    continue when r.id = any(v_picked);
    work_id := r.id; reason := 'series'; context := r.ctx;
    v_picked := v_picked || r.id;
    return next;
  end loop;

  -- 2. New and coming books by authors they follow or have read, from the
  --    news job's release stories: out in the last two months or the next six weeks.
  for r in
    with theirs as (
      select af.author_id, 2 as weight from public.author_follows af where af.user_id = target
      union all
      select wc.author_id, 1
        from public.user_books ub
        join public.work_contributors wc on wc.work_id = ub.work_id and wc.role = 'author'
       where ub.user_id = target and ub.status in ('read', 'reading')
    ),
    authors as (
      select t.author_id, max(t.weight) as weight from theirs t group by t.author_id
    )
    select n.work_id as id, a.name as ctx
      from public.news_items n
      join authors au on au.author_id = n.author_id
      join public.authors a on a.id = n.author_id
     where n.kind = 'release'
       and n.work_id is not null
       and coalesce(n.happens_at, n.published_at) between now() - interval '60 days' and now() + interval '45 days'
       and not exists (
         select 1 from public.user_books ub
          where ub.user_id = target and ub.work_id = n.work_id and ub.status <> 'want_to_read'
       )
     order by au.weight desc, abs(extract(epoch from coalesce(n.happens_at, n.published_at) - now())), n.id
     limit 4
  loop
    exit when v_releases >= 2 or cardinality(v_picked) >= v_max;
    continue when r.id = any(v_picked);
    work_id := r.id; reason := 'new_release'; context := r.ctx;
    v_picked := v_picked || r.id;
    v_releases := v_releases + 1;
    return next;
  end loop;

  -- 3. What's been waiting at the front of their Want to Read shelf.
  for r in
    select ub.work_id as id
      from public.user_books ub
     where ub.user_id = target and ub.status = 'want_to_read'
     order by ub.position asc nulls first, ub.shelved_at desc
     limit 4
  loop
    exit when v_waiting >= 2 or cardinality(v_picked) >= v_max;
    continue when r.id = any(v_picked);
    work_id := r.id; reason := 'want_to_read'; context := null;
    v_picked := v_picked || r.id;
    v_waiting := v_waiting + 1;
    return next;
  end loop;

  -- 4. Taste: weigh each tag by how much they liked the books carrying it
  --    (5 stars = 3, 4+ = 2, read but unrated or still reading = 1, under 4 = 0),
  --    then the unshelved books whose tags add up highest.
  for r in
    with liked as (
      select ub.work_id,
             case
               when rv.rating >= 4.5 then 3
               when rv.rating >= 4 then 2
               when rv.rating is null then 1
               else 0
             end as weight
        from public.user_books ub
        left join public.reviews rv on rv.user_id = ub.user_id and rv.work_id = ub.work_id
       where ub.user_id = target and ub.status in ('read', 'reading')
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
         select 1 from public.user_books ub where ub.user_id = target and ub.work_id = wt.work_id
       )
       group by wt.work_id
    )
    select p.work_id as id, seed.title as ctx
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
     limit 12
  loop
    exit when cardinality(v_picked) >= v_max;
    continue when r.id = any(v_picked);
    work_id := r.id; reason := 'taste'; context := r.ctx;
    v_picked := v_picked || r.id;
    return next;
  end loop;

  -- 5. Readers with little on their shelves yet: what everyone's shelving.
  if cardinality(v_picked) < v_max then
    for r in
      select w.id
        from public.works w
       where w.cover_url is not null
         and w.shelved_count > 0
         and w.id <> all(v_picked)
         and not exists (
           select 1 from public.user_books ub where ub.user_id = target and ub.work_id = w.id
         )
       order by w.shelved_count desc, w.ratings_count desc, w.title
       limit v_max - cardinality(v_picked)
    loop
      work_id := r.id; reason := 'popular'; context := null;
      return next;
    end loop;
  end if;
end;
$$;

revoke execute on function public.monthly_picks(uuid, integer) from public, anon, authenticated;
grant execute on function public.monthly_picks(uuid, integer) to service_role;

-- Readers who want the letter and haven't had this issue yet, a batch at a
-- time: confirmed, real (not anonymous) accounts only.
create function public.monthly_picks_recipients(issue text, max_results integer default 50)
returns table (user_id uuid, email text, display_name text, username text, unsubscribe_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select ep.user_id, u.email::text, p.display_name, p.username, ep.unsubscribe_token
    from public.email_preferences ep
    join public.profiles p on p.id = ep.user_id
    join auth.users u on u.id = ep.user_id
   where ep.monthly_picks
     and ep.monthly_picks_issue is distinct from issue
     and u.email is not null
     and u.email_confirmed_at is not null
     and not coalesce(u.is_anonymous, false)
     and (u.banned_until is null or u.banned_until < now())
   order by ep.user_id
   limit least(greatest(max_results, 1), 100);
$$;

revoke execute on function public.monthly_picks_recipients(text, integer) from public, anon, authenticated;
grant execute on function public.monthly_picks_recipients(text, integer) to service_role;
