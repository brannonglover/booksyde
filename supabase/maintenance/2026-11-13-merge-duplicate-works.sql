-- Fold the duplicate "Fourth Wing" works into the real one.
--
-- NOT a migration: run by hand in the hosted project's SQL editor, after
-- migration 20261117000000_merge_works.sql (which defines merge_works) has
-- been applied. Review the preview first; nothing changes until COMMIT.
--
-- How they got in (12 Nov, before the matching fix): Open Library holds
-- stub records for Fourth Wing, and importing them from the search page's
-- request slips slipped past the old "same title + lead author surname"
-- check:
--   aa3b47ab  "Fourth Wing (The Empyrean Book 1)"  OL42635816W  no authors at all
--   8058009a  "Fourth Wing"                        OL44582771W  credited to "Entangled, Lydia Fenwick"
-- Both stay with the real record:
--   74f22169  "Fourth Wing"  Rebecca Yarros  OL29226517W  (shelved)
--
-- Checked against the hosted catalogue on 13 Nov: neither duplicate has
-- shelves, ratings, reviews or tags, so the merge only moves the Entangled
-- record's one edition (ISBN 9780486856278) onto the real work. The stubs'
-- Open Library ids are dropped; the kept work keeps OL29226517W, and the
-- fixed importer now folds those stubs into it if anyone requests them again.

-- 1. Preview: what hangs off each work right now.
select w.id, w.title, w.open_library_id, w.shelved_count, w.ratings_count, w.reviews_count,
       (select count(*) from public.user_books ub where ub.work_id = w.id)       as shelves,
       (select count(*) from public.reviews r where r.work_id = w.id)            as reviews,
       (select count(*) from public.shelf_items si where si.work_id = w.id)      as shelf_items,
       (select count(*) from public.reading_sessions rs where rs.work_id = w.id) as sessions,
       (select count(*) from public.activities a where a.work_id = w.id)         as activities,
       (select count(*) from public.editions e where e.work_id = w.id)           as editions,
       (select count(*) from public.work_tags wt where wt.work_id = w.id)        as tags
  from public.works w
 where w.id in ('74f22169-6e9e-475f-9688-10c1f7d6acea',
                'aa3b47ab-6fd6-4917-bea2-523634f2e727',
                '8058009a-7610-4e0f-9f49-4ee2caa75bda');

-- 2. Merge (keep, duplicate). Inspect the result, then COMMIT (or ROLLBACK).
begin;
select public.merge_works('74f22169-6e9e-475f-9688-10c1f7d6acea', 'aa3b47ab-6fd6-4917-bea2-523634f2e727');
select public.merge_works('74f22169-6e9e-475f-9688-10c1f7d6acea', '8058009a-7610-4e0f-9f49-4ee2caa75bda');

select id, title, open_library_id, shelved_count, ratings_count, reviews_count
  from public.works
 where title ilike 'fourth wing%';
-- commit;
-- rollback;

-- 3. Afterwards, look for any other pairs. Same title (ignoring subtitle,
--    "(Series Book 1)", leading article, case and punctuation) where the
--    two share an author or one has none: the rule the importer now uses.
with keyed as (
  select w.id, w.title, w.shelved_count, w.created_at,
         regexp_replace(regexp_replace(lower(split_part(split_part(split_part(w.title, ':', 1), ';', 1), '(', 1)),
                                       '^(the|a|an)\s+', ''), '[^a-z0-9]', '', 'g') as title_key,
         array(select lower(regexp_replace(a.name, '^.*\s', ''))
                 from public.work_contributors wc join public.authors a on a.id = wc.author_id
                where wc.work_id = w.id) as surnames
    from public.works w
)
select a.title_key, a.id as keep_candidate, a.title, a.shelved_count, b.id as duplicate_candidate, b.title, b.shelved_count
  from keyed a
  join keyed b on b.title_key = a.title_key and b.id <> a.id
              and (a.shelved_count, b.created_at) > (b.shelved_count, a.created_at)
 where a.title_key <> ''
   and (cardinality(a.surnames) = 0 or cardinality(b.surnames) = 0 or a.surnames && b.surnames)
 order by a.title_key;
