-- =============================================================================
-- Booksyde — initial schema
--
--   CATALOG   works ← editions, authors, series, tags   (public read, librarian write)
--   READING   user_books, reading_sessions, shelves     (owner write, privacy-aware read)
--   SOCIAL    reviews, likes, comments, follows, activities, clubs
--
-- A "work" is the abstract book (Dune). An "edition" is a specific printing
-- with its own ISBN, format and cover. Ratings and reviews attach to works.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('member', 'librarian', 'admin');
create type public.edition_format as enum ('hardcover', 'paperback', 'mass_market', 'ebook', 'audiobook', 'other');
create type public.contributor_role as enum ('author', 'translator', 'illustrator', 'editor', 'narrator');
create type public.tag_kind as enum ('genre', 'mood', 'trope', 'pace', 'content_warning');
create type public.reading_status as enum ('want_to_read', 'reading', 'read', 'did_not_finish');
create type public.follow_status as enum ('pending', 'accepted');
create type public.activity_verb as enum ('shelved', 'started', 'finished', 'dnf', 'rated', 'reviewed', 'followed');
create type public.club_role as enum ('owner', 'moderator', 'member');

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- PROFILES
-- =============================================================================
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name    text check (char_length(display_name) <= 60),
  bio             text check (char_length(bio) <= 500),
  avatar_url      text,
  theme_color     text check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_private      boolean not null default false,
  role            public.user_role not null default 'member',
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(new.raw_user_meta_data ->> 'username');
begin
  if v_username is null
     or v_username !~ '^[a-z0-9_]{3,30}$'
     or exists (select 1 from public.profiles p where p.username = v_username) then
    v_username := 'reader_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_username,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- CATALOG
-- =============================================================================
create table public.authors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bio             text,
  photo_url       text,
  birth_date      date,
  death_date      date,
  open_library_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.works (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  subtitle             text,
  description          text,
  first_published_year smallint,
  original_language    text,
  cover_url            text,
  -- Dominant colour pulled from the cover; the UI tints book pages with it.
  cover_color          text check (cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  open_library_id      text unique,
  -- Denormalised counters, maintained by triggers below.
  avg_rating           numeric(3, 2) not null default 0,
  ratings_count        integer not null default 0,
  reviews_count        integer not null default 0,
  shelved_count        integer not null default 0,
  -- Embedding of description + tags for "books like this" (1536 = OpenAI
  -- text-embedding-3-small; change the dimension if you pick another model).
  embedding            extensions.vector(1536),
  search               tsvector generated always as (
                         setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                         setweight(to_tsvector('english', coalesce(subtitle, '')), 'B')
                       ) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.editions (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references public.works (id) on delete cascade,
  title           text,                -- only if it differs from the work title
  isbn_10         text unique check (isbn_10 ~ '^[0-9]{9}[0-9X]$'),
  isbn_13         text unique check (isbn_13 ~ '^[0-9]{13}$'),
  format          public.edition_format not null default 'other',
  publisher       text,
  published_date  date,
  page_count      integer check (page_count > 0),
  audio_minutes   integer check (audio_minutes > 0),
  language        text,
  cover_url       text,
  open_library_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.work_contributors (
  work_id   uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  role      public.contributor_role not null default 'author',
  position  smallint not null default 0,
  primary key (work_id, author_id, role)
);

create table public.series (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.series_works (
  series_id uuid not null references public.series (id) on delete cascade,
  work_id   uuid not null references public.works (id) on delete cascade,
  position  numeric(5, 2),            -- allows novellas like 2.5
  primary key (series_id, work_id)
);

create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  kind public.tag_kind not null
);

create table public.work_tags (
  work_id uuid not null references public.works (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  votes   integer not null default 0,
  primary key (work_id, tag_id)
);

create trigger authors_updated_at before update on public.authors
  for each row execute function public.set_updated_at();
create trigger works_updated_at before update on public.works
  for each row execute function public.set_updated_at();
create trigger editions_updated_at before update on public.editions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- READING
-- =============================================================================

-- One row per (user, work): where the book sits on their status shelves.
create table public.user_books (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  work_id     uuid not null references public.works (id) on delete cascade,
  edition_id  uuid references public.editions (id) on delete set null,
  status      public.reading_status not null,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, work_id)
);

-- Each read-through (supports rereads, progress tracking and buddy reads).
create table public.reading_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  work_id      uuid not null references public.works (id) on delete cascade,
  edition_id   uuid references public.editions (id) on delete set null,
  current_page integer check (current_page >= 0),
  percent      numeric(5, 2) check (percent between 0 and 100),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Custom shelves ("Beach reads", "Owned") on top of the status shelves.
create table public.shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  slug        text not null check (slug ~ '^[a-z0-9-]+$'),
  description text,
  color       text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emoji       text,
  is_public   boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.shelf_items (
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  work_id  uuid not null references public.works (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (shelf_id, work_id)
);

create trigger user_books_updated_at before update on public.user_books
  for each row execute function public.set_updated_at();
create trigger reading_sessions_updated_at before update on public.reading_sessions
  for each row execute function public.set_updated_at();
create trigger shelves_updated_at before update on public.shelves
  for each row execute function public.set_updated_at();

-- Stamp started/finished dates when status changes.
create function public.stamp_user_book_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'reading' and new.started_at is null then
    new.started_at := now();
  elsif new.status = 'read' and new.finished_at is null then
    new.finished_at := now();
  end if;
  return new;
end;
$$;

create trigger user_books_stamp_dates before insert or update of status on public.user_books
  for each row execute function public.stamp_user_book_dates();

-- =============================================================================
-- SOCIAL
-- =============================================================================
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  work_id        uuid not null references public.works (id) on delete cascade,
  edition_id     uuid references public.editions (id) on delete set null,
  -- Half-star ratings: 0.5, 1.0 … 5.0
  rating         numeric(2, 1) check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  body           text check (char_length(body) <= 20000),
  has_spoilers   boolean not null default false,
  likes_count    integer not null default 0,
  comments_count integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, work_id),
  check (rating is not null or nullif(btrim(body), '') is not null)
);

create table public.review_likes (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.review_comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id  uuid references public.review_comments (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status       public.follow_status not null default 'accepted',
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.tag_votes (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  work_id    uuid not null references public.works (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id, tag_id)
);

create table public.activities (
  id             bigint generated always as identity primary key,
  actor_id       uuid not null references public.profiles (id) on delete cascade,
  verb           public.activity_verb not null,
  work_id        uuid references public.works (id) on delete cascade,
  review_id      uuid references public.reviews (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete cascade,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- Book clubs & buddy reads (a buddy read is just a small private club).
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  cover_color text check (cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_private  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.club_members (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.club_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_reads (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  work_id    uuid not null references public.works (id) on delete cascade,
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now()
);

create table public.club_posts (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  club_read_id uuid references public.club_reads (id) on delete set null,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 10000),
  -- Spoiler-safe discussion: hide posts past the reader's current page.
  spoiler_page integer check (spoiler_page >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger review_comments_updated_at before update on public.review_comments
  for each row execute function public.set_updated_at();
create trigger clubs_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();
create trigger club_posts_updated_at before update on public.club_posts
  for each row execute function public.set_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================
create index works_search_idx on public.works using gin (search);
create index works_title_trgm_idx on public.works using gin (title extensions.gin_trgm_ops);
create index works_embedding_idx on public.works using hnsw (embedding extensions.vector_cosine_ops);
create index authors_name_trgm_idx on public.authors using gin (name extensions.gin_trgm_ops);
create index editions_work_id_idx on public.editions (work_id);
create index work_contributors_author_idx on public.work_contributors (author_id);
create index series_works_work_idx on public.series_works (work_id);
create index work_tags_tag_idx on public.work_tags (tag_id, votes desc);
create index user_books_work_idx on public.user_books (work_id);
create index user_books_user_status_idx on public.user_books (user_id, status, updated_at desc);
create index reading_sessions_user_idx on public.reading_sessions (user_id, started_at desc);
create index shelf_items_work_idx on public.shelf_items (work_id);
create index reviews_work_idx on public.reviews (work_id, created_at desc);
create index reviews_user_idx on public.reviews (user_id, created_at desc);
create index review_comments_review_idx on public.review_comments (review_id, created_at);
create index review_likes_user_idx on public.review_likes (user_id);
create index follows_following_idx on public.follows (following_id, status);
create index tag_votes_work_tag_idx on public.tag_votes (work_id, tag_id);
create index activities_actor_idx on public.activities (actor_id, created_at desc);
create index club_members_user_idx on public.club_members (user_id);
create index club_posts_club_idx on public.club_posts (club_id, created_at desc);

-- =============================================================================
-- COUNTER & ACTIVITY TRIGGERS (security definer: they write rows users can't)
-- =============================================================================

-- works.avg_rating / ratings_count / reviews_count
create function public.refresh_work_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid := coalesce(new.work_id, old.work_id);
begin
  update public.works w
     set avg_rating    = coalesce(s.avg_rating, 0),
         ratings_count = s.ratings_count,
         reviews_count = s.reviews_count
    from (
      select round(avg(r.rating), 2)                               as avg_rating,
             count(r.rating)::int                                  as ratings_count,
             count(*) filter (where nullif(btrim(r.body), '') is not null)::int as reviews_count
        from public.reviews r
       where r.work_id = v_work_id
    ) s
   where w.id = v_work_id;
  return null;
end;
$$;

create trigger reviews_refresh_work_stats
  after insert or update of rating, body or delete on public.reviews
  for each row execute function public.refresh_work_rating_stats();

-- works.shelved_count
create function public.refresh_work_shelved_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid := coalesce(new.work_id, old.work_id);
begin
  update public.works
     set shelved_count = (select count(*) from public.user_books ub where ub.work_id = v_work_id)
   where id = v_work_id;
  return null;
end;
$$;

create trigger user_books_refresh_shelved_count
  after insert or delete on public.user_books
  for each row execute function public.refresh_work_shelved_count();

-- reviews.likes_count
create function public.refresh_review_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews
     set likes_count = (select count(*) from public.review_likes l where l.review_id = v_review_id)
   where id = v_review_id;
  return null;
end;
$$;

create trigger review_likes_refresh_count
  after insert or delete on public.review_likes
  for each row execute function public.refresh_review_likes_count();

-- reviews.comments_count
create function public.refresh_review_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews
     set comments_count = (select count(*) from public.review_comments c where c.review_id = v_review_id)
   where id = v_review_id;
  return null;
end;
$$;

create trigger review_comments_refresh_count
  after insert or delete on public.review_comments
  for each row execute function public.refresh_review_comments_count();

-- Following a private profile creates a pending request.
create function public.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := case
    when exists (select 1 from public.profiles p where p.id = new.following_id and p.is_private)
      then 'pending'::public.follow_status
    else 'accepted'::public.follow_status
  end;
  return new;
end;
$$;

create trigger follows_set_status before insert on public.follows
  for each row execute function public.set_follow_status();

-- profiles.followers_count / following_count (accepted follows only)
create function public.refresh_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follower  uuid := coalesce(new.follower_id, old.follower_id);
  v_following uuid := coalesce(new.following_id, old.following_id);
begin
  update public.profiles
     set following_count = (select count(*) from public.follows f
                             where f.follower_id = v_follower and f.status = 'accepted')
   where id = v_follower;
  update public.profiles
     set followers_count = (select count(*) from public.follows f
                             where f.following_id = v_following and f.status = 'accepted')
   where id = v_following;
  return null;
end;
$$;

create trigger follows_refresh_counts
  after insert or update of status or delete on public.follows
  for each row execute function public.refresh_follow_counts();

-- work_tags.votes from tag_votes
create function public.refresh_work_tag_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid := coalesce(new.work_id, old.work_id);
  v_tag_id  uuid := coalesce(new.tag_id, old.tag_id);
  v_votes   integer;
begin
  select count(*) into v_votes
    from public.tag_votes tv
   where tv.work_id = v_work_id and tv.tag_id = v_tag_id;

  insert into public.work_tags (work_id, tag_id, votes)
  values (v_work_id, v_tag_id, v_votes)
  on conflict (work_id, tag_id) do update set votes = excluded.votes;
  return null;
end;
$$;

create trigger tag_votes_refresh
  after insert or delete on public.tag_votes
  for each row execute function public.refresh_work_tag_votes();

-- Activity feed entries
create function public.log_user_book_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger user_books_log_activity
  after insert or update of status on public.user_books
  for each row execute function public.log_user_book_activity();

create function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger reviews_log_activity after insert on public.reviews
  for each row execute function public.log_review_activity();

create function public.log_follow_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
    insert into public.activities (actor_id, verb, target_user_id)
    values (new.follower_id, 'followed', new.following_id);
  end if;
  return null;
end;
$$;

create trigger follows_log_activity
  after insert or update of status on public.follows
  for each row execute function public.log_follow_activity();

-- Club creator becomes its owner member.
create function public.add_club_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return null;
end;
$$;

create trigger clubs_add_owner after insert on public.clubs
  for each row execute function public.add_club_owner();

-- =============================================================================
-- AUTHORISATION HELPERS (security definer so policies don't recurse)
-- =============================================================================
create function public.is_librarian()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('librarian', 'admin')
  );
$$;

-- Can the current viewer see this user's reading life?
-- Yes if it's them, their profile is public, or they're an accepted follower.
create function public.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid()
      or exists (select 1 from public.profiles p where p.id = target and not p.is_private)
      or exists (select 1 from public.follows f
                  where f.follower_id = auth.uid()
                    and f.following_id = target
                    and f.status = 'accepted');
$$;

create function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
     where m.club_id = p_club_id and m.user_id = auth.uid()
  );
$$;

create function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
     where m.club_id = p_club_id and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.authors           enable row level security;
alter table public.works             enable row level security;
alter table public.editions          enable row level security;
alter table public.work_contributors enable row level security;
alter table public.series            enable row level security;
alter table public.series_works      enable row level security;
alter table public.tags              enable row level security;
alter table public.work_tags         enable row level security;
alter table public.user_books        enable row level security;
alter table public.reading_sessions  enable row level security;
alter table public.shelves           enable row level security;
alter table public.shelf_items       enable row level security;
alter table public.reviews           enable row level security;
alter table public.review_likes      enable row level security;
alter table public.review_comments   enable row level security;
alter table public.follows           enable row level security;
alter table public.tag_votes         enable row level security;
alter table public.activities        enable row level security;
alter table public.clubs             enable row level security;
alter table public.club_members      enable row level security;
alter table public.club_reads        enable row level security;
alter table public.club_posts        enable row level security;

-- Profiles: basic profile info is public; you edit only yourself, and only
-- the user-editable columns (not role or counters).
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, theme_color, is_private)
  on public.profiles to authenticated;

-- Catalog: everyone reads; librarians write; bulk imports use the service role.
do $$
declare
  t text;
begin
  foreach t in array array['authors', 'works', 'editions', 'work_contributors',
                           'series', 'series_works', 'tags', 'work_tags']
  loop
    execute format('create policy "Catalog is viewable by everyone" on public.%I for select using (true)', t);
    execute format('create policy "Librarians insert catalog" on public.%I for insert to authenticated with check ((select public.is_librarian()))', t);
    execute format('create policy "Librarians update catalog" on public.%I for update to authenticated using ((select public.is_librarian())) with check ((select public.is_librarian()))', t);
    execute format('create policy "Librarians delete catalog" on public.%I for delete to authenticated using ((select public.is_librarian()))', t);
  end loop;
end;
$$;

-- user_books / reading_sessions: visible per privacy, owner writes.
create policy "View books of visible users" on public.user_books
  for select using (public.can_view_user(user_id));
create policy "Manage own books" on public.user_books
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "View sessions of visible users" on public.reading_sessions
  for select using (public.can_view_user(user_id));
create policy "Manage own sessions" on public.reading_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- shelves: public shelves of visible users, plus all your own.
create policy "View visible shelves" on public.shelves
  for select using (
    user_id = (select auth.uid()) or (is_public and public.can_view_user(user_id))
  );
create policy "Manage own shelves" on public.shelves
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "View items on visible shelves" on public.shelf_items
  for select using (exists (select 1 from public.shelves s where s.id = shelf_id));
create policy "Manage items on own shelves" on public.shelf_items
  for all to authenticated
  using (exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid())));

-- reviews: visible per author privacy; counters are not user-writable.
create policy "View reviews of visible users" on public.reviews
  for select using (public.can_view_user(user_id));
create policy "Write own reviews" on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Edit own reviews" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own reviews" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.reviews from anon, authenticated;
grant insert (user_id, work_id, edition_id, rating, body, has_spoilers) on public.reviews to authenticated;
grant update (edition_id, rating, body, has_spoilers) on public.reviews to authenticated;

-- likes & comments: visible when the review is visible.
create policy "View likes on visible reviews" on public.review_likes
  for select using (exists (select 1 from public.reviews r where r.id = review_id));
create policy "Like visible reviews" on public.review_likes
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.reviews r where r.id = review_id)
  );
create policy "Unlike" on public.review_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "View comments on visible reviews" on public.review_comments
  for select using (exists (select 1 from public.reviews r where r.id = review_id));
create policy "Comment on visible reviews" on public.review_comments
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.reviews r where r.id = review_id)
  );
create policy "Edit own comments" on public.review_comments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own comments" on public.review_comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- follows: you follow as yourself; the followed user accepts or removes.
create policy "View follows" on public.follows
  for select using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or (status = 'accepted' and public.can_view_user(follower_id) and public.can_view_user(following_id))
  );
create policy "Follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Accept follow requests" on public.follows
  for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()) and status = 'accepted');
create policy "Unfollow or remove follower" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
revoke update on public.follows from anon, authenticated;
grant update (status) on public.follows to authenticated;

-- tag votes
create policy "Tag votes are viewable by everyone" on public.tag_votes
  for select using (true);
create policy "Vote as yourself" on public.tag_votes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Remove own votes" on public.tag_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- activities: written only by triggers.
create policy "View activity of visible users" on public.activities
  for select using (public.can_view_user(actor_id));

-- clubs
create policy "View public clubs or clubs you belong to" on public.clubs
  for select using (not is_private or public.is_club_member(id));
create policy "Create clubs as yourself" on public.clubs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update clubs" on public.clubs
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete clubs" on public.clubs
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "View members of visible clubs" on public.club_members
  for select using (exists (select 1 from public.clubs c where c.id = club_id));
create policy "Join public clubs or be added by admins" on public.club_members
  for insert to authenticated with check (
    (user_id = (select auth.uid()) and role = 'member'
       and exists (select 1 from public.clubs c where c.id = club_id and not c.is_private))
    or (public.is_club_admin(club_id) and role <> 'owner')
  );
create policy "Leave or be removed by admins" on public.club_members
  for delete to authenticated using (
    (user_id = (select auth.uid()) and role <> 'owner') or (public.is_club_admin(club_id) and role <> 'owner')
  );

create policy "View reads of visible clubs" on public.club_reads
  for select using (exists (select 1 from public.clubs c where c.id = club_id));
create policy "Admins manage club reads" on public.club_reads
  for all to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy "Members view posts" on public.club_posts
  for select using (public.is_club_member(club_id));
create policy "Members post as themselves" on public.club_posts
  for insert to authenticated with check (
    user_id = (select auth.uid()) and public.is_club_member(club_id)
  );
create policy "Edit own posts" on public.club_posts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own posts or moderate" on public.club_posts
  for delete to authenticated using (
    user_id = (select auth.uid()) or public.is_club_admin(club_id)
  );

-- =============================================================================
-- RPC FUNCTIONS (called from the apps via supabase.rpc)
-- =============================================================================

-- Typo-tolerant title search: full-text match OR trigram similarity.
create function public.search_works(q text, max_results integer default 20)
returns setof public.works
language sql
stable
set search_path = public, extensions
as $$
  select w.*
    from public.works w
   where w.search @@ websearch_to_tsquery('english', q)
      or w.title % q
   order by ts_rank(w.search, websearch_to_tsquery('english', q)) desc,
            similarity(w.title, q) desc,
            w.ratings_count desc
   limit least(max_results, 100);
$$;

-- "Books like this" via embedding similarity.
create function public.similar_works(p_work_id uuid, max_results integer default 12)
returns setof public.works
language sql
stable
set search_path = public, extensions
as $$
  select w.*
    from public.works w,
         (select embedding from public.works where id = p_work_id) src
   where w.id <> p_work_id
     and w.embedding is not null
     and src.embedding is not null
   order by w.embedding <=> src.embedding
   limit least(max_results, 50);
$$;

-- Home feed: your activity plus everyone you follow (RLS still applies).
create function public.get_feed(max_results integer default 30, before timestamptz default null)
returns setof public.activities
language sql
stable
set search_path = ''
as $$
  select a.*
    from public.activities a
   where (a.actor_id = auth.uid()
          or a.actor_id in (select f.following_id from public.follows f
                             where f.follower_id = auth.uid() and f.status = 'accepted'))
     and (before is null or a.created_at < before)
   order by a.created_at desc
   limit least(max_results, 100);
$$;
