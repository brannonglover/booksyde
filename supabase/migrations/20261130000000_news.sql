-- News: what's happening in books, for "This week in books" on the home page.
--
-- One table holds every kind of story, so the feed and its cards stay the same
-- as kinds are added: bestseller-list moves and new releases from the authors
-- readers shelve now; Booksyde buzz, author headlines, prizes and screen
-- adaptations later. A daily job on the web server (/api/cron/news) writes the
-- rows with the service role; readers only ever see them through news_feed().

create type public.news_kind as enum ('chart', 'release', 'buzz', 'article', 'award', 'adaptation');

create table public.news_items (
  id           uuid primary key default gen_random_uuid(),
  kind         public.news_kind not null,
  -- Stable identity from the source, so the daily job can upsert without duplicates
  -- (e.g. "chart:combined-print-and-e-book-fiction:2026-11-29:9780593...").
  key          text not null unique,
  -- The story in a line ("New on the list at No. 3") and a short badge ("New this week").
  headline     text not null,
  label        text,
  -- The book it's about, as the source named it, and our copy of it when we hold one.
  title        text,
  author_name  text,
  work_id      uuid references public.works (id) on delete set null,
  author_id    uuid references public.authors (id) on delete set null,
  cover_url    text,
  -- Where the story came from, and a link out for stories that live elsewhere (articles).
  source       text,
  url          text,
  -- When it happens (the list's date, the release date); when it entered the feed; when it drops out.
  happens_at   timestamptz,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  -- Higher first, within the same day.
  weight       smallint not null default 0,
  data         jsonb not null default '{}'::jsonb
);

create index news_items_feed_idx on public.news_items (published_at desc);
create index news_items_author_idx on public.news_items (author_id) where author_id is not null;
create index news_items_work_idx on public.news_items (work_id) where work_id is not null;

-- No policies: nothing reads the table directly. news_feed() decides what each
-- reader sees, because release stories exist only because someone shelved that
-- author, and a signed-out visitor shouldn't be able to tell who reads what.
alter table public.news_items enable row level security;

-- Each week's New York Times lists as we saw them, so later stories can look
-- back further than the list's own "last week" (e.g. "back after a year").
create table public.bestseller_entries (
  list_name      text not null,
  list_date      date not null,
  rank           smallint not null,
  rank_last_week smallint not null default 0,
  weeks_on_list  smallint not null default 0,
  title          text not null,
  author         text not null,
  isbn13         text,
  cover_url      text,
  work_id        uuid references public.works (id) on delete set null,
  primary key (list_name, list_date, rank)
);

create index bestseller_entries_work_idx on public.bestseller_entries (work_id) where work_id is not null;

alter table public.bestseller_entries enable row level security;
create policy "Bestseller lists are public" on public.bestseller_entries for select using (true);

-- When the daily job last looked up an author's new releases; it checks the
-- longest-waiting authors first.
alter table public.authors add column releases_checked_at timestamptz;

-- Authors at least one reader has on a shelf, most-read first among those
-- that have waited longest for a release check. For the daily job only.
create function public.watched_authors(max_results integer default 40)
returns table (author_id uuid, name text, open_library_id text, readers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.open_library_id, count(distinct ub.user_id)::integer
    from public.user_books ub
    join public.work_contributors wc on wc.work_id = ub.work_id and wc.role = 'author'
    join public.authors a on a.id = wc.author_id
   group by a.id
   order by a.releases_checked_at nulls first, count(distinct ub.user_id) desc, a.name
   limit least(greatest(max_results, 1), 200);
$$;

revoke execute on function public.watched_authors(integer) from public, anon, authenticated;
grant execute on function public.watched_authors(integer) to service_role;

-- The feed: current stories, newest first, with the ones about the reader's own
-- authors and books marked for_you and lifted to the top. Release stories only
-- go to readers who have that author on a shelf; everyone sees the rest.
create function public.news_feed(max_results integer default 12)
returns table (
  id uuid,
  kind public.news_kind,
  headline text,
  label text,
  title text,
  author_name text,
  work_id uuid,
  author_id uuid,
  cover_url text,
  cover_color text,
  source text,
  url text,
  happens_at timestamptz,
  published_at timestamptz,
  for_you boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select ub.work_id, wc.author_id
      from public.user_books ub
      left join public.work_contributors wc on wc.work_id = ub.work_id and wc.role = 'author'
     where ub.user_id = (select auth.uid())
  ),
  scored as (
    select n.*,
           (exists (select 1 from mine m where m.work_id = n.work_id)
            or exists (select 1 from mine m where m.author_id = n.author_id)) as for_you
      from public.news_items n
     where n.expires_at is null or n.expires_at > now()
  )
  select s.id, s.kind, s.headline, s.label, coalesce(w.title, s.title), s.author_name, s.work_id, s.author_id,
         coalesce(w.cover_url, s.cover_url), w.cover_color, s.source, s.url, s.happens_at, s.published_at, s.for_you
    from scored s
    left join public.works w on w.id = s.work_id
   where s.kind <> 'release' or s.for_you
   order by s.for_you desc, s.published_at::date desc, s.weight desc, s.published_at desc
   limit least(greatest(max_results, 1), 50);
$$;

revoke execute on function public.news_feed(integer) from public;
grant execute on function public.news_feed(integer) to anon, authenticated;
