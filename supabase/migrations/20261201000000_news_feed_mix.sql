-- news_feed, mixed better:
--
-- 1. A reader's own stories (their authors' releases, their books on the
--    lists) take every other place instead of all the top ones, so the week's
--    bestseller news still shows for readers with lots of authors on the go.
-- 2. Stories from different streams take turns: Fiction and Nonfiction chart
--    stories alternate, so a week with eight nonfiction debuts doesn't push
--    every novel off the home page.
--
-- Within a stream: newest day first, then weight, then higher on the list.
-- Same signature and columns, so callers don't change.
create or replace function public.news_feed(max_results integer default 12)
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
            or exists (select 1 from mine m where m.author_id = n.author_id)) as for_you,
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
         coalesce(w.cover_url, l.cover_url), w.cover_color, l.source, l.url, l.happens_at, l.published_at, l.for_you
    from laned l
    left join public.works w on w.id = l.work_id
   -- The reader's own stories take the odd places, everything else the even ones;
   -- when one half runs out, the other carries on.
   order by (l.place * 2 - case when l.for_you then 1 else 0 end), l.id
   limit least(greatest(max_results, 1), 50);
$$;
