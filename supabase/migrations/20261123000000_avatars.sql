-- Reader photos for bookplates and avatars.
--
-- A public bucket: anyone can view a reader's photo by its URL (bookplates are
-- public, even for private libraries). Each reader can only write inside their
-- own folder, `<user id>/…`. The app squares and shrinks photos before upload,
-- so 2 MB is plenty.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Readers see their own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Readers upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Readers replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Readers remove their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Club discussion shows each poster's photo too. Adding a column changes the
-- return type, so the function is dropped and recreated (same body otherwise).
drop function public.get_club_posts(uuid, integer, timestamptz);

create function public.get_club_posts(p_club_id uuid, max_results integer default 50, before timestamptz default null)
returns table (
  id            uuid,
  club_read_id  uuid,
  work_id       uuid,
  user_id       uuid,
  username      text,
  display_name  text,
  theme_color   text,
  avatar_url    text,
  body          text,
  spoiler_page  integer,
  is_hidden     boolean,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql
stable
set search_path = ''
as $$
  with page as (
    select p.*, r.work_id
      from public.club_posts p
      left join public.club_reads r on r.id = p.club_read_id
     where p.club_id = p_club_id
       and (before is null or p.created_at < before)
     order by p.created_at desc
     limit least(greatest(coalesce(max_results, 50), 1), 100)
  ),
  shown as (
    select page.*,
           page.user_id is distinct from auth.uid()
             and page.spoiler_page is not null
             and (page.work_id is null or page.spoiler_page > public.reader_page(page.work_id)) as hidden
      from page
  )
  select s.id, s.club_read_id, s.work_id, s.user_id,
         pr.username, pr.display_name, pr.theme_color, pr.avatar_url,
         case when s.hidden then null else s.body end,
         s.spoiler_page, s.hidden, s.created_at, s.updated_at
    from shown s
    join public.profiles pr on pr.id = s.user_id
   order by s.created_at desc;
$$;

revoke execute on function public.get_club_posts(uuid, integer, timestamptz) from public, anon;
grant execute on function public.get_club_posts(uuid, integer, timestamptz) to authenticated;
