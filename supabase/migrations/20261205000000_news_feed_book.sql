-- news_feed also returns book_id: the book a card's cover and title open.
-- It's the story's own book, or for an author headline (which is about the
-- author, not a book) the author's book shown on its cover, kept in
-- data->>'book_id'. Cards now open the book from the cover and the story
-- (article, list, prize or film page) from its line, so a headline's book is
-- reachable too.
--
-- Otherwise exactly as in 20261204000000_news_articles.sql. A new column means
-- a new return type, so the function is dropped and made again, with its grants.
drop function public.news_feed(integer);

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
  for_you boolean,
  shelf_status public.reading_status,
  book_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select ub.work_id, ub.status, wc.author_id, lower(btrim(w.title)) as title_key
      from public.user_books ub
      join public.works w on w.id = ub.work_id
      left join public.work_contributors wc on wc.work_id = ub.work_id and wc.role = 'author'
     where ub.user_id = (select auth.uid())
  ),
  scored as (
    select n.*,
           (exists (select 1 from mine m where m.work_id = n.work_id)
            or exists (select 1 from mine m where m.author_id = n.author_id)) as for_you,
           coalesce(
             (select m.status from mine m where m.work_id = n.work_id limit 1),
             (select m.status from mine m
               where n.work_id is null
                 and m.author_id = n.author_id
                 and m.title_key = lower(btrim(n.title))
               limit 1)
           ) as shelf_status,
           -- Which stream a story takes turns within: its bestseller list, else its kind.
           coalesce(n.data ->> 'list', n.kind::text) as stream
      from public.news_items n
     where n.expires_at is null or n.expires_at > now()
  ),
  visible as (
    select s.*,
           row_number() over (
             partition by s.for_you, s.stream
             order by s.published_at::date desc, s.weight desc, (s.data ->> 'rank')::integer nulls last, s.published_at desc, s.id
           ) as turn
      from scored s
     -- Releases and headlines exist only because someone shelves that author: theirs alone.
     where s.kind not in ('release', 'article') or s.for_you
  ),
  -- Each half in order: first story of every stream, then the second of every stream, and so on.
  laned as (
    select v.*,
           row_number() over (
             partition by v.for_you
             order by v.turn, v.weight desc, (v.data ->> 'rank')::integer nulls last, v.published_at desc, v.id
           ) as place
      from visible v
  )
  select l.id, l.kind, l.headline, l.label, coalesce(w.title, l.title), l.author_name, l.work_id, l.author_id,
         coalesce(w.cover_url, l.cover_url), w.cover_color, l.source, l.url, l.happens_at, l.published_at, l.for_you,
         l.shelf_status,
         -- The book the card's cover opens: the story's own, or (for a headline) the author's book on its cover.
         coalesce(l.work_id, (l.data ->> 'book_id')::uuid)
    from laned l
    left join public.works w on w.id = l.work_id
   -- The reader's own stories take the odd places, everything else the even ones;
   -- when one half runs out, the other carries on.
   order by (l.place * 2 - case when l.for_you then 1 else 0 end), l.id
   limit least(greatest(max_results, 1), 50);
$$;


revoke execute on function public.news_feed(integer) from public;
grant execute on function public.news_feed(integer) to anon, authenticated;
