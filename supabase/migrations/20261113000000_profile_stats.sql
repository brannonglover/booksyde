-- Reading stats for a profile page: shelf counts, pages read, ratings given,
-- and the reader's "palette" (the moods and genres of what they've read).
-- Security invoker: row-level security applies, so a private reader's stats
-- come back empty for anyone who isn't an approved follower.
create function public.profile_stats(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with books as (
    select ub.work_id, ub.status from public.user_books ub where ub.user_id = p_user_id
  ),
  read as (select work_id from books where status = 'read'),
  tag_weights as (
    select t.kind, t.slug, t.name, sum(wt.votes)::integer as weight
      from read r
      join public.work_tags wt on wt.work_id = r.work_id
      join public.tags t on t.id = wt.tag_id
     where t.kind in ('mood', 'genre')
     group by t.kind, t.slug, t.name
  ),
  ratings as (
    select rating from public.reviews where user_id = p_user_id and rating is not null
  )
  select jsonb_build_object(
    'read', (select count(*) from books where status = 'read'),
    'reading', (select count(*) from books where status = 'reading'),
    'wantToRead', (select count(*) from books where status = 'want_to_read'),
    'pages', (
      select coalesce(sum((select max(e.page_count) from public.editions e where e.work_id = r.work_id)), 0)
        from read r
    ),
    'ratings', (select count(*) from ratings),
    'averageRating', (select round(avg(rating), 2) from ratings),
    'moods', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'weight', weight) order by weight desc)
        from (select * from tag_weights where kind = 'mood' order by weight desc limit 6) m
    ), '[]'::jsonb),
    'genres', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'weight', weight) order by weight desc)
        from (select * from tag_weights where kind = 'genre' order by weight desc limit 4) g
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.profile_stats(uuid) to anon, authenticated;
