-- How a work's ratings break down by star (5 → 1), for the bar chart on book pages.
-- Half stars round down (4.5 counts as a 4; 0.5 counts as a 1).
-- Security definer so the totals include private readers' ratings, matching
-- works.avg_rating; only counts come back, never who rated what.
create function public.work_rating_distribution(p_work_id uuid)
returns table (stars smallint, ratings integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.stars::smallint, count(r.rating)::integer
    from generate_series(1, 5) as s (stars)
    left join public.reviews r
      on r.work_id = p_work_id
     and r.rating is not null
     and greatest(1, floor(r.rating)) = s.stars
   group by s.stars
   order by s.stars desc;
$$;

revoke execute on function public.work_rating_distribution(uuid) from public;
grant execute on function public.work_rating_distribution(uuid) to anon, authenticated;
