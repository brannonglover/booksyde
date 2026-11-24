-- Catalogue search also looks at series names. A reader searching
-- "bloodwing academy" wants On Wings of Blood (Bloodwing Academy #1), but
-- the series name is in neither the title nor the subtitle, so it found
-- nothing. A book matches when the query is like its series' name, or
-- contains it ("the bloodwing academy", "red rising book 2"). Otherwise the
-- same as 20261118000001_search_catalog_whole_row.sql.
create or replace function public.search_catalog(
  q           text default '',
  tag_slugs   text[] default '{}',
  max_results integer default 30
)
returns setof public.works
language sql
stable
set search_path = public, extensions
as $$
  with input as (
    select nullif(trim(coalesce(q, '')), '') as q,
           regexp_replace(upper(coalesce(q, '')), '[^0-9X]', '', 'g') as isbn
  ),
  scored as (
    select w,
           case when i.q is null then 0 else
             -- Exact ISBN beats everything.
             (case when length(i.isbn) in (10, 13) and exists (
                     select 1 from public.editions e
                      where e.work_id = w.id and (e.isbn_13 = i.isbn or e.isbn_10 = i.isbn))
                   then 10 else 0 end)
             + 2 * ts_rank(w.search, websearch_to_tsquery('english', i.q))
             + word_similarity(i.q, w.title)
             + (case when w.title ilike i.q || '%' then 0.5 else 0 end)
             + coalesce((select max(word_similarity(i.q, a.name))
                           from public.work_contributors wc
                           join public.authors a on a.id = wc.author_id
                          where wc.work_id = w.id), 0)
             -- Its series: "bloodwing academy" finds On Wings of Blood (Bloodwing Academy #1).
             + coalesce((select max(greatest(word_similarity(i.q, s.name),
                                             case when i.q ilike '%' || s.name || '%' then 1 else 0 end))
                           from public.series_works sw
                           join public.series s on s.id = sw.series_id
                          where sw.work_id = w.id), 0)
             + coalesce((select max(case when t.slug = lower(i.q) or t.name ilike i.q then 1 else 0 end)
                           from public.work_tags wt
                           join public.tags t on t.id = wt.tag_id
                          where wt.work_id = w.id and wt.votes > 0), 0)
           end as score
      from public.works w, input i
     where
       -- Every chosen tag must be on the book.
       not exists (
         select 1 from unnest(coalesce(tag_slugs, '{}')) s(slug)
          where not exists (
            select 1 from public.work_tags wt
              join public.tags t on t.id = wt.tag_id
             where wt.work_id = w.id and t.slug = s.slug and wt.votes > 0))
       and (
         i.q is null
         or w.search @@ websearch_to_tsquery('english', i.q)
         or word_similarity(i.q, w.title) >= 0.45
         or w.title ilike '%' || i.q || '%'
         or exists (
           select 1 from public.work_contributors wc
             join public.authors a on a.id = wc.author_id
            where wc.work_id = w.id and (word_similarity(i.q, a.name) >= 0.45 or a.name ilike '%' || i.q || '%'))
         or exists (
           select 1 from public.series_works sw
             join public.series s on s.id = sw.series_id
            where sw.work_id = w.id
              and (word_similarity(i.q, s.name) >= 0.45
                   or s.name ilike '%' || i.q || '%'
                   -- "the bloodwing academy", "bloodwing academy book 2"
                   or i.q ilike '%' || s.name || '%'))
         or (length(i.isbn) in (10, 13) and exists (
           select 1 from public.editions e
            where e.work_id = w.id and (e.isbn_13 = i.isbn or e.isbn_10 = i.isbn)))
         or exists (
           select 1 from public.work_tags wt
             join public.tags t on t.id = wt.tag_id
            where wt.work_id = w.id and wt.votes > 0 and (t.slug = lower(i.q) or t.name ilike i.q))
       )
  )
  select (s.w).*
    from scored s
   order by s.score desc, (s.w).shelved_count desc, (s.w).ratings_count desc, (s.w).title
   limit least(greatest(max_results, 1), 100);
$$;
