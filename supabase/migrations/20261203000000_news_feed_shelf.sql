-- news_feed tells the reader which shelf a story's book is on, if any.
--
-- shelf_status is the reader's own status for the book (null when it isn't on
-- their shelves, and always null for visitors). A story is matched to a book
-- by its work, or, for a release we haven't catalogued as that work, by the
-- same author and title, so a forthcoming book the reader already added still
-- shows as on their shelf.
--
-- Same ordering as news_feed_mix; the new column means dropping and recreating.
drop function if exists public.news_feed(integer);

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
  shelf_status public.reading_status
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
     where s.kind <> 'release' or s.for_you
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
         l.shelf_status
    from laned l
    left join public.works w on w.id = l.work_id
   -- The reader's own stories take the odd places, everything else the even ones;
   -- when one half runs out, the other carries on.
   order by (l.place * 2 - case when l.for_you then 1 else 0 end), l.id
   limit least(greatest(max_results, 1), 50);
$$;

revoke execute on function public.news_feed(integer) from public;
grant execute on function public.news_feed(integer) to anon, authenticated;
