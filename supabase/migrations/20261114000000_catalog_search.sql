-- Catalogue search: one query box that understands titles, authors, ISBNs and
-- subjects (tags), with typo tolerance, optionally narrowed to a set of tags.
-- With an empty query it browses: every book carrying the chosen tags, most
-- shelved first.

create function public.search_catalog(
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
    select w.*,
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
         or (length(i.isbn) in (10, 13) and exists (
           select 1 from public.editions e
            where e.work_id = w.id and (e.isbn_13 = i.isbn or e.isbn_10 = i.isbn)))
         or exists (
           select 1 from public.work_tags wt
             join public.tags t on t.id = wt.tag_id
            where wt.work_id = w.id and wt.votes > 0 and (t.slug = lower(i.q) or t.name ilike i.q))
       )
  )
  select id, title, subtitle, description, first_published_year, original_language, cover_url, cover_color,
         open_library_id, avg_rating, ratings_count, reviews_count, shelved_count, embedding, search,
         created_at, updated_at
    from scored
   order by score desc, shelved_count desc, ratings_count desc, title
   limit least(greatest(max_results, 1), 100);
$$;

-- How many books sit in each subject "drawer" (tags with at least one vote).
create function public.tag_drawer_counts()
returns table (slug text, name text, kind public.tag_kind, works integer)
language sql
stable
set search_path = ''
as $$
  select t.slug, t.name, t.kind, count(wt.work_id)::integer
    from public.tags t
    left join public.work_tags wt on wt.tag_id = t.id and wt.votes > 0
   group by t.id
   order by t.kind, t.name;
$$;

-- Authors by name, typo- and accent-tolerant ("bronte" finds Brontë), with
-- how many of their books are in the catalogue.
create function public.search_authors(q text, max_results integer default 6)
returns table (id uuid, name text, birth_date date, death_date date, works integer)
language sql
stable
set search_path = public, extensions
as $$
  select a.id, a.name, a.birth_date, a.death_date,
         (select count(*)::integer from public.work_contributors wc where wc.author_id = a.id)
    from public.authors a
   where length(trim(q)) >= 2
     and (word_similarity(trim(q), a.name) >= 0.45 or a.name ilike '%' || trim(q) || '%')
   order by word_similarity(trim(q), a.name) desc, a.name
   limit least(greatest(max_results, 1), 50);
$$;
