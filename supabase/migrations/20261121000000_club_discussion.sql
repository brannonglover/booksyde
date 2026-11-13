-- Spoiler-safe club discussion.
--
-- A club post can carry a `spoiler_page`: the page of the club's book it
-- talks about. Readers who haven't reached that page see that the post exists
-- (who wrote it, and the page it's about) but not what it says, until they
-- catch up. Your own posts are never hidden from you.
--
-- Where a reader is with a book:
--   finished it (shelved as Read, or their latest session is finished)  → everything
--   reading it                                                           → their session's current page
--   otherwise                                                            → page 0
--
-- Both functions are security invoker, so RLS still decides what the caller
-- may see: only members get club posts at all, and a reader's progress is
-- read from their own rows.

create function public.reader_page(p_work_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then 0
    when exists (
      select 1 from public.user_books ub
       where ub.user_id = auth.uid() and ub.work_id = p_work_id and ub.status = 'read'
    ) then 2147483647
    else coalesce((
      select case when s.finished_at is not null then 2147483647 else coalesce(s.current_page, 0) end
        from public.reading_sessions s
       where s.user_id = auth.uid() and s.work_id = p_work_id
       order by s.started_at desc
       limit 1
    ), 0)
  end;
$$;

-- A page of a club's posts, newest first, with spoilers past the caller's
-- page blanked out. A spoiler-tagged post whose book has since been taken off
-- the club's list stays hidden: we can no longer tell whether you've read it.
create function public.get_club_posts(p_club_id uuid, max_results integer default 50, before timestamptz default null)
returns table (
  id            uuid,
  club_read_id  uuid,
  work_id       uuid,
  user_id       uuid,
  username      text,
  display_name  text,
  theme_color   text,
  body          text,
  spoiler_page  integer,
  is_hidden     boolean,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql
stable
set search_path = ''
as $$
  with page as (
    select p.*, r.work_id
      from public.club_posts p
      left join public.club_reads r on r.id = p.club_read_id
     where p.club_id = p_club_id
       and (before is null or p.created_at < before)
     order by p.created_at desc
     limit least(greatest(coalesce(max_results, 50), 1), 100)
  ),
  shown as (
    select page.*,
           page.user_id is distinct from auth.uid()
             and page.spoiler_page is not null
             and (page.work_id is null or page.spoiler_page > public.reader_page(page.work_id)) as hidden
      from page
  )
  select s.id, s.club_read_id, s.work_id, s.user_id,
         pr.username, pr.display_name, pr.theme_color,
         case when s.hidden then null else s.body end,
         s.spoiler_page, s.hidden, s.created_at, s.updated_at
    from shown s
    join public.profiles pr on pr.id = s.user_id
   order by s.created_at desc;
$$;

revoke execute on function public.reader_page(uuid) from public, anon;
grant execute on function public.reader_page(uuid) to authenticated;
revoke execute on function public.get_club_posts(uuid, integer, timestamptz) from public, anon;
grant execute on function public.get_club_posts(uuid, integer, timestamptz) to authenticated;

-- Reading progress is now written from club pages; find a reader's latest
-- session for a book without scanning all their sessions.
create index reading_sessions_user_work_idx on public.reading_sessions (user_id, work_id, started_at desc);
