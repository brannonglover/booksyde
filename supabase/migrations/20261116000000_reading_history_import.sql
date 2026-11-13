-- Bringing a reading history over from another site (Goodreads export).
--
-- import_reading_history() shelves a batch of already-matched books for the
-- signed-in reader in one go. It runs as the caller, so row-level security
-- still decides what they may write. While it runs, the activity triggers
-- stay quiet (a 600-book library shouldn't flood followers' feeds) and read
-- books without a finish date aren't stamped as finished today (that would
-- put a decade of reading into this year's tally).

-- -----------------------------------------------------------------------------
-- A transaction-local switch the triggers check.
-- -----------------------------------------------------------------------------
create function public.is_importing()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('booksyde.importing', true), '') = 'on';
$$;

create or replace function public.stamp_user_book_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_importing() then
    return new;
  end if;
  if new.status = 'reading' and new.started_at is null then
    new.started_at := now();
  elsif new.status = 'read' and new.finished_at is null then
    new.finished_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.log_user_book_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_importing() then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status = old.status then
    return null;
  end if;
  insert into public.activities (actor_id, verb, work_id)
  values (
    new.user_id,
    case new.status
      when 'want_to_read'   then 'shelved'::public.activity_verb
      when 'reading'        then 'started'::public.activity_verb
      when 'read'           then 'finished'::public.activity_verb
      when 'did_not_finish' then 'dnf'::public.activity_verb
    end,
    new.work_id
  );
  return null;
end;
$$;

create or replace function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_importing() then
    return null;
  end if;
  insert into public.activities (actor_id, verb, work_id, review_id, metadata)
  values (
    new.user_id,
    case when nullif(btrim(new.body), '') is not null
      then 'reviewed'::public.activity_verb
      else 'rated'::public.activity_verb
    end,
    new.work_id,
    new.id,
    jsonb_build_object('rating', new.rating)
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- The import itself.
--
-- p_items: [{ "work_id": uuid, "status": reading_status,
--             "started_at"?: timestamptz, "finished_at"?: timestamptz,
--             "added_at"?: timestamptz, "rating"?: numeric, "review"?: text,
--             "has_spoilers"?: boolean, "shelves"?: [text] }, …]
--
-- Books already on the reader's shelves keep their status (Booksyde is the
-- newer record); missing dates are filled in. Existing reviews are left alone.
-- Returns one row per item: 'added', 'updated' or 'unchanged'.
-- -----------------------------------------------------------------------------
create function public.import_reading_history(p_items jsonb)
returns table (work_id uuid, outcome text)
language plpgsql
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_item     jsonb;
  v_work     uuid;
  v_existing public.user_books;
  v_rating   numeric(2, 1);
  v_review   text;
  v_shelf    text;
  v_slug     text;
  v_shelf_id uuid;
  v_outcome  text;
begin
  if v_user is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Send between 1 and 50 books at a time.' using errcode = '22023';
  end if;

  perform set_config('booksyde.importing', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_work := (v_item ->> 'work_id')::uuid;

    select * into v_existing
      from public.user_books ub
     where ub.user_id = v_user and ub.work_id = v_work;

    if not found then
      insert into public.user_books (user_id, work_id, status, started_at, finished_at, created_at)
      values (
        v_user,
        v_work,
        (v_item ->> 'status')::public.reading_status,
        (v_item ->> 'started_at')::timestamptz,
        (v_item ->> 'finished_at')::timestamptz,
        coalesce((v_item ->> 'added_at')::timestamptz, now())
      );
      v_outcome := 'added';
    elsif (v_existing.started_at is null and v_item ? 'started_at')
       or (v_existing.finished_at is null and v_item ? 'finished_at' and v_existing.status = 'read') then
      update public.user_books ub
         set started_at  = coalesce(ub.started_at, (v_item ->> 'started_at')::timestamptz),
             finished_at = case when ub.status = 'read'
                                then coalesce(ub.finished_at, (v_item ->> 'finished_at')::timestamptz)
                                else ub.finished_at end
       where ub.user_id = v_user and ub.work_id = v_work;
      v_outcome := 'updated';
    else
      v_outcome := 'unchanged';
    end if;

    -- Rating and review (only if the reader hasn't reviewed it here yet).
    v_rating := nullif(v_item ->> 'rating', '')::numeric;
    v_review := nullif(btrim(coalesce(v_item ->> 'review', '')), '');
    if v_rating is not null or v_review is not null then
      insert into public.reviews (user_id, work_id, rating, body, has_spoilers)
      values (v_user, v_work, v_rating, v_review, coalesce((v_item ->> 'has_spoilers')::boolean, false))
      on conflict on constraint reviews_user_id_work_id_key do nothing;
      if found and v_outcome = 'unchanged' then
        v_outcome := 'updated';
      end if;
    end if;

    -- Custom shelves, created on first use.
    for v_shelf in select jsonb_array_elements_text(coalesce(v_item -> 'shelves', '[]'::jsonb)) loop
      v_shelf := left(btrim(v_shelf), 60);
      v_slug := left(btrim(regexp_replace(lower(v_shelf), '[^a-z0-9]+', '-', 'g'), '-'), 60);
      continue when v_slug = '';

      select s.id into v_shelf_id from public.shelves s where s.user_id = v_user and s.slug = v_slug;
      if v_shelf_id is null then
        insert into public.shelves (user_id, name, slug, position)
        values (
          v_user,
          -- "favorites" → "Favorites"; short ones are usually initialisms ("ya" → "YA").
          case when char_length(v_slug) <= 3 then upper(v_shelf) else initcap(replace(v_shelf, '-', ' ')) end,
          v_slug,
          (select coalesce(max(s.position), -1) + 1 from public.shelves s where s.user_id = v_user)
        )
        on conflict (user_id, slug) do nothing
        returning id into v_shelf_id;
        if v_shelf_id is null then
          select s.id into v_shelf_id from public.shelves s where s.user_id = v_user and s.slug = v_slug;
        end if;
      end if;

      insert into public.shelf_items (shelf_id, work_id)
      values (v_shelf_id, v_work)
      on conflict do nothing;
      v_shelf_id := null;
    end loop;

    work_id := v_work;
    outcome := v_outcome;
    return next;
  end loop;
end;
$$;

revoke execute on function public.import_reading_history(jsonb) from public, anon;
grant execute on function public.import_reading_history(jsonb) to authenticated;
