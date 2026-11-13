-- Folding a duplicate work into the one that stays.
--
-- merge_works(keep, dupe) moves everything that hangs off `dupe` onto
-- `keep` (editions, series, tags, shelves, reading, reviews, activity, club
-- reads; authors only if keep has none), fills keep's empty fields from
-- dupe, deletes dupe and recomputes keep's counters. Defining it changes no
-- data; it only runs when called, and only the service role (SQL editor,
-- maintenance scripts) may call it.
--
-- Where one reader has both books, one row has to win:
--   * shelf (user_books): the more recently updated row's status; dates and
--     edition are filled from the other where missing.
--   * review: the more recently updated review; the other is deleted along
--     with its likes and comments.
-- The activity triggers stay quiet while it runs (via the same switch as
-- import_reading_history), so a merge doesn't post "shelved" to anyone's feed.

create function public.merge_works(p_keep uuid, p_dupe uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_was_importing text := coalesce(current_setting('booksyde.importing', true), '');
  v_dupe public.works;
begin
  if p_keep = p_dupe then
    raise exception 'merge_works: keep and dupe are the same work (%)', p_keep;
  end if;
  perform 1 from public.works where id = p_keep;
  if not found then
    raise exception 'merge_works: no work % to keep', p_keep;
  end if;
  select * into v_dupe from public.works where id = p_dupe;
  if not found then
    raise exception 'merge_works: no duplicate work %', p_dupe;
  end if;

  perform set_config('booksyde.importing', 'on', true);

  -- Catalogue ---------------------------------------------------------------
  update public.editions set work_id = p_keep where work_id = p_dupe;

  -- Credits only if keep has none: duplicates are usually the worse record
  -- (a publisher or narrator credited as author), so keep's stand as they are.
  insert into public.work_contributors (work_id, author_id, role, position)
  select p_keep, wc.author_id, wc.role, wc.position
    from public.work_contributors wc
   where wc.work_id = p_dupe
     and not exists (select 1 from public.work_contributors k where k.work_id = p_keep);

  insert into public.series_works (series_id, work_id, position)
  select sw.series_id, p_keep, sw.position from public.series_works sw where sw.work_id = p_dupe
  on conflict (series_id, work_id) do nothing;

  -- Readers' tag votes first (their trigger recounts work_tags), then any
  -- remaining tags dupe had that keep lacks.
  insert into public.tag_votes (user_id, work_id, tag_id, created_at)
  select tv.user_id, p_keep, tv.tag_id, tv.created_at from public.tag_votes tv where tv.work_id = p_dupe
  on conflict (user_id, work_id, tag_id) do nothing;
  delete from public.tag_votes where work_id = p_dupe;

  insert into public.work_tags (work_id, tag_id, votes)
  select p_keep, wt.tag_id, wt.votes from public.work_tags wt where wt.work_id = p_dupe
  on conflict (work_id, tag_id) do nothing;

  -- Shelves -----------------------------------------------------------------
  -- Same reader on both: keep the fresher status, fill gaps from the other.
  update public.user_books k
     set status      = case when d.updated_at > k.updated_at then d.status else k.status end,
         started_at  = coalesce(k.started_at, d.started_at),
         finished_at = coalesce(k.finished_at, d.finished_at),
         edition_id  = coalesce(k.edition_id, d.edition_id)
    from public.user_books d
   where k.work_id = p_keep and d.work_id = p_dupe and d.user_id = k.user_id;
  delete from public.user_books d
   where d.work_id = p_dupe
     and exists (select 1 from public.user_books k where k.work_id = p_keep and k.user_id = d.user_id);
  update public.user_books set work_id = p_keep where work_id = p_dupe;

  update public.reading_sessions set work_id = p_keep where work_id = p_dupe;

  insert into public.shelf_items (shelf_id, work_id, position, added_at)
  select si.shelf_id, p_keep, si.position, si.added_at from public.shelf_items si where si.work_id = p_dupe
  on conflict (shelf_id, work_id) do nothing;

  -- Reviews -----------------------------------------------------------------
  -- Same reader reviewed both: the more recently updated review survives.
  delete from public.reviews k
   using public.reviews d
   where k.work_id = p_keep and d.work_id = p_dupe and d.user_id = k.user_id
     and d.updated_at > k.updated_at;
  delete from public.reviews d
   where d.work_id = p_dupe
     and exists (select 1 from public.reviews k where k.work_id = p_keep and k.user_id = d.user_id);
  update public.reviews set work_id = p_keep where work_id = p_dupe;

  -- Social ------------------------------------------------------------------
  update public.activities set work_id = p_keep where work_id = p_dupe;
  update public.club_reads set work_id = p_keep where work_id = p_dupe;

  -- The work itself ---------------------------------------------------------
  delete from public.works where id = p_dupe;

  update public.works k
     set subtitle             = coalesce(k.subtitle, v_dupe.subtitle),
         description          = coalesce(k.description, v_dupe.description),
         first_published_year = coalesce(k.first_published_year, v_dupe.first_published_year),
         original_language    = coalesce(k.original_language, v_dupe.original_language),
         cover_url            = coalesce(k.cover_url, v_dupe.cover_url),
         cover_color          = coalesce(k.cover_color, v_dupe.cover_color),
         open_library_id      = coalesce(k.open_library_id, v_dupe.open_library_id),
         shelved_count        = (select count(*) from public.user_books ub where ub.work_id = p_keep),
         avg_rating           = coalesce((select round(avg(r.rating), 2) from public.reviews r where r.work_id = p_keep), 0),
         ratings_count        = (select count(r.rating) from public.reviews r where r.work_id = p_keep),
         reviews_count        = (select count(*) from public.reviews r
                                  where r.work_id = p_keep and nullif(btrim(r.body), '') is not null)
   where k.id = p_keep;

  perform set_config('booksyde.importing', v_was_importing, true);
end;
$$;

revoke execute on function public.merge_works(uuid, uuid) from public, anon, authenticated;
