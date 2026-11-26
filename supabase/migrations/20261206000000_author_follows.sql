-- Following an author: a reader asks to hear about an author's new books and
-- news, whether or not that author is on their shelves yet. This adds the
-- follow itself, a public follower count on each author, and author_news()
-- for the author page. (Next: the daily news job checks followed authors
-- first, news_feed() counts follows like shelves, and follows drive
-- notifications.)

create table public.author_follows (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_id  uuid not null references public.authors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

create index author_follows_author_idx on public.author_follows (author_id);

-- Who follows whom is the reader's own business: others see only the count.
alter table public.author_follows enable row level security;

create policy "View own author follows" on public.author_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Follow authors as yourself" on public.author_follows
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Unfollow authors" on public.author_follows
  for delete to authenticated using (user_id = (select auth.uid()));

-- authors.followers_count, kept by trigger like profiles.followers_count.
alter table public.authors add column followers_count integer not null default 0;

create function public.refresh_author_follow_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid := coalesce(new.author_id, old.author_id);
begin
  update public.authors
     set followers_count = (select count(*) from public.author_follows af where af.author_id = v_author)
   where id = v_author;
  return null;
end;
$$;

create trigger author_follows_refresh_count
  after insert or delete on public.author_follows
  for each row execute function public.refresh_author_follow_count();

-- An author's current stories (new and coming releases, headlines, prizes,
-- screen adaptations), newest first, for their page. Same columns as
-- news_feed(), so both apps draw them with the same cards.
--
-- news_feed() shows release and headline stories only to readers who shelve
-- that author, so a visitor can't tell who reads what. Here they're shown to
-- anyone on the author's own page: they're public facts about the author, and
-- a story only says that someone, somewhere, reads them.
create function public.author_news(target uuid, max_results integer default 6)
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
  for_you boolean,
  shelf_status public.reading_status,
  book_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind, n.headline, n.label, coalesce(w.title, n.title), n.author_name, n.work_id, n.author_id,
         coalesce(w.cover_url, n.cover_url), w.cover_color, n.source, n.url, n.happens_at, n.published_at,
         -- Everything here is about this author, so "An author you read" would say nothing.
         false,
         (select ub.status from public.user_books ub
           where ub.user_id = (select auth.uid()) and ub.work_id = n.work_id),
         coalesce(n.work_id, (n.data ->> 'book_id')::uuid)
    from public.news_items n
    left join public.works w on w.id = n.work_id
   where n.author_id = target
     and (n.expires_at is null or n.expires_at > now())
   order by n.published_at desc, n.weight desc, n.id
   limit least(greatest(max_results, 1), 24);
$$;

revoke execute on function public.author_news(uuid, integer) from public;
grant execute on function public.author_news(uuid, integer) to anon, authenticated;
