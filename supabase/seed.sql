-- Local development seed data. Runs on `npm run db:reset`.
-- Real catalog data comes from the Open Library import (see supabase/import/README.md).
-- Everything below is public-domain books plus made-up demo readers.

-- Tags (genres, moods, tropes, pace) are reference data: see migration 20261115000000_tags.sql.

insert into public.authors (id, name, birth_date, death_date, bio) values
  ('00000000-0000-4000-a000-000000000001', 'Jane Austen', '1775-12-16', '1817-07-18',
   'English novelist whose sharp, funny books about love, money and manners in the Georgian gentry are still endlessly reread.'),
  ('00000000-0000-4000-a000-000000000002', 'Mary Shelley', '1797-08-30', '1851-02-01',
   'English writer who began Frankenstein at eighteen, during a ghost-story contest on a stormy summer at Lake Geneva.'),
  ('00000000-0000-4000-a000-000000000003', 'Herman Melville', '1819-08-01', '1891-09-28',
   'American novelist and former whaleman whose sea stories went from bestsellers to forgotten to canon.'),
  ('00000000-0000-4000-a000-000000000004', 'Bram Stoker', '1847-11-08', '1912-04-20',
   'Irish author and theatre manager best known for the vampire novel that defined the genre.'),
  ('00000000-0000-4000-a000-000000000005', 'F. Scott Fitzgerald', '1896-09-24', '1940-12-21',
   'American novelist who chronicled the glitter and emptiness of the Jazz Age.'),
  ('00000000-0000-4000-a000-000000000006', 'Charlotte Brontë', '1816-04-21', '1855-03-31',
   'English novelist and poet, the eldest of the three Brontë sisters to survive into adulthood.'),
  ('00000000-0000-4000-a000-000000000007', 'Emily Brontë', '1818-07-30', '1848-12-19',
   'English novelist and poet whose only novel was published the year before her death.');

insert into public.works (id, title, subtitle, first_published_year, original_language, cover_url, cover_color, description) values
  ('00000000-0000-4000-b000-000000000001', 'Pride and Prejudice', null, 1813, 'en',
   'https://covers.openlibrary.org/b/id/14348537-L.jpg', '#C2416B',
   E'When the wealthy, standoffish Mr. Darcy arrives in the neighbourhood, quick-witted Elizabeth Bennet decides within an evening that she cannot stand him. He is not much kinder about her.\n\nWhat follows is a comedy of first impressions, wounded pride and nosy relatives, as two clever people slowly discover how wrong they have been about each other, and about themselves.'),
  ('00000000-0000-4000-b000-000000000002', 'Frankenstein', 'or, The Modern Prometheus', 1818, 'en',
   'https://covers.openlibrary.org/b/id/12356249-L.jpg', '#2F6B5E',
   E'Victor Frankenstein, a gifted young student, discovers how to bring dead matter to life, and is horrified by what he creates.\n\nAbandoned by its maker, the creature teaches itself language, longing and finally rage. Told through letters from the Arctic, it is a story about ambition, loneliness and what we owe to the things we make.'),
  ('00000000-0000-4000-b000-000000000003', 'Moby-Dick', 'or, The Whale', 1851, 'en',
   'https://covers.openlibrary.org/b/id/10544254-L.jpg', '#2457A6',
   E'Ishmael signs on to the whaling ship Pequod, only to learn that its captain, Ahab, has one goal: to hunt down the white whale that took his leg.\n\nPart adventure, part sermon, part encyclopedia of whaling, it is a vast, strange and often funny book about obsession and the sea.'),
  ('00000000-0000-4000-b000-000000000004', 'Dracula', null, 1897, 'en',
   null, '#7A1F2B',
   E'Young solicitor Jonathan Harker travels to Transylvania to help a nobleman buy property in England, and slowly realises he is a prisoner in the castle.\n\nTold through diaries, letters and newspaper clippings, the story follows a small band of friends as an ancient evil arrives in London.'),
  ('00000000-0000-4000-b000-000000000005', 'The Great Gatsby', null, 1925, 'en',
   null, '#C9A227',
   E'Nick Carraway rents a cottage on Long Island next door to Jay Gatsby, a mysterious millionaire famous for his lavish parties.\n\nAs Nick is drawn into Gatsby''s world, he learns the reason behind all the glamour: a long-lost love across the bay, and a dream that money alone cannot buy.'),
  ('00000000-0000-4000-b000-000000000006', 'Jane Eyre', null, 1847, 'en',
   'https://covers.openlibrary.org/b/id/8235363-L.jpg', '#A0703C',
   E'Orphaned Jane survives a cruel childhood and a harsh charity school to become governess at Thornfield Hall, home of the brooding Mr. Rochester.\n\nAs she falls for her employer, strange noises in the night hint that the house is keeping a secret. A fierce, independent heroine tells her own story.'),
  ('00000000-0000-4000-b000-000000000007', 'Wuthering Heights', null, 1847, 'en',
   'https://covers.openlibrary.org/b/id/12818862-L.jpg', '#2B3A55',
   E'On the wild Yorkshire moors, the foundling Heathcliff and Catherine Earnshaw grow up wildly devoted to each other, until she chooses to marry someone else.\n\nHeathcliff''s revenge stretches across two generations. It is less a love story than a storm: passionate, cruel and unforgettable.');

insert into public.work_contributors (work_id, author_id) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000005'),
  ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-000000000006'),
  ('00000000-0000-4000-b000-000000000007', '00000000-0000-4000-a000-000000000007');

insert into public.editions (work_id, isbn_13, format, publisher, published_date, page_count, language) values
  ('00000000-0000-4000-b000-000000000001', '9780141439518', 'paperback', 'Penguin Classics', '2002-12-31', 480, 'en'),
  ('00000000-0000-4000-b000-000000000001', null,            'ebook',     'Project Gutenberg', '1998-06-01', null, 'en'),
  ('00000000-0000-4000-b000-000000000002', '9780141439471', 'paperback', 'Penguin Classics', '2003-01-30', 273, 'en'),
  ('00000000-0000-4000-b000-000000000003', '9780142437247', 'paperback', 'Penguin Classics', '2003-02-01', 720, 'en'),
  ('00000000-0000-4000-b000-000000000004', '9780141439846', 'paperback', 'Penguin Classics', '2003-04-24', 488, 'en'),
  ('00000000-0000-4000-b000-000000000005', '9780743273565', 'paperback', 'Scribner',          '2004-09-30', 180, 'en'),
  ('00000000-0000-4000-b000-000000000006', '9780141441146', 'paperback', 'Penguin Classics', '2006-04-25', 624, 'en'),
  ('00000000-0000-4000-b000-000000000007', '9780141439556', 'paperback', 'Penguin Classics', '2002-12-31', 416, 'en');

insert into public.work_tags (work_id, tag_id, votes)
select v.work_id, t.id, v.votes
  from (values
    ('00000000-0000-4000-b000-000000000001'::uuid, 'classics', 41), ('00000000-0000-4000-b000-000000000001'::uuid, 'romance', 38),
    ('00000000-0000-4000-b000-000000000001'::uuid, 'funny', 29),    ('00000000-0000-4000-b000-000000000001'::uuid, 'cozy', 18),
    ('00000000-0000-4000-b000-000000000001'::uuid, 'enemies-to-lovers', 33), ('00000000-0000-4000-b000-000000000001'::uuid, 'slow-burn', 21),
    ('00000000-0000-4000-b000-000000000001'::uuid, 'medium-paced', 25),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'classics', 30), ('00000000-0000-4000-b000-000000000002'::uuid, 'horror', 26),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'gothic', 22),   ('00000000-0000-4000-b000-000000000002'::uuid, 'dark', 24),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'reflective', 15), ('00000000-0000-4000-b000-000000000002'::uuid, 'emotional', 12),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'epistolary', 9), ('00000000-0000-4000-b000-000000000002'::uuid, 'medium-paced', 14),
    ('00000000-0000-4000-b000-000000000003'::uuid, 'classics', 27), ('00000000-0000-4000-b000-000000000003'::uuid, 'adventurous', 23),
    ('00000000-0000-4000-b000-000000000003'::uuid, 'reflective', 17), ('00000000-0000-4000-b000-000000000003'::uuid, 'obsession', 19),
    ('00000000-0000-4000-b000-000000000003'::uuid, 'slow-paced', 22),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'classics', 24), ('00000000-0000-4000-b000-000000000004'::uuid, 'horror', 31),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'gothic', 25),   ('00000000-0000-4000-b000-000000000004'::uuid, 'tense', 20),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'mysterious', 16), ('00000000-0000-4000-b000-000000000004'::uuid, 'epistolary', 18),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'medium-paced', 13),
    ('00000000-0000-4000-b000-000000000005'::uuid, 'classics', 28), ('00000000-0000-4000-b000-000000000005'::uuid, 'literary-fiction', 26),
    ('00000000-0000-4000-b000-000000000005'::uuid, 'reflective', 19), ('00000000-0000-4000-b000-000000000005'::uuid, 'emotional', 14),
    ('00000000-0000-4000-b000-000000000005'::uuid, 'obsession', 11), ('00000000-0000-4000-b000-000000000005'::uuid, 'fast-paced', 17),
    ('00000000-0000-4000-b000-000000000006'::uuid, 'classics', 33), ('00000000-0000-4000-b000-000000000006'::uuid, 'romance', 27),
    ('00000000-0000-4000-b000-000000000006'::uuid, 'gothic', 24),   ('00000000-0000-4000-b000-000000000006'::uuid, 'emotional', 22),
    ('00000000-0000-4000-b000-000000000006'::uuid, 'mysterious', 15), ('00000000-0000-4000-b000-000000000006'::uuid, 'hopeful', 10),
    ('00000000-0000-4000-b000-000000000006'::uuid, 'slow-burn', 16), ('00000000-0000-4000-b000-000000000006'::uuid, 'medium-paced', 18),
    ('00000000-0000-4000-b000-000000000007'::uuid, 'classics', 29), ('00000000-0000-4000-b000-000000000007'::uuid, 'gothic', 26),
    ('00000000-0000-4000-b000-000000000007'::uuid, 'romance', 18),  ('00000000-0000-4000-b000-000000000007'::uuid, 'dark', 23),
    ('00000000-0000-4000-b000-000000000007'::uuid, 'emotional', 20), ('00000000-0000-4000-b000-000000000007'::uuid, 'obsession', 17),
    ('00000000-0000-4000-b000-000000000007'::uuid, 'unreliable-narrator', 12), ('00000000-0000-4000-b000-000000000007'::uuid, 'slow-paced', 14)
  ) as v (work_id, slug, votes)
  join public.tags t on t.slug = v.slug;

-- ---------------------------------------------------------------------------
-- Demo readers (made up). Creating auth users fires handle_new_user, which
-- makes their profiles. Nobody can sign in as them: they have no password.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000'::uuid, u.id, 'authenticated', 'authenticated', u.email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, u.meta, now(), now(), '', '', '', ''
  from (
    values
      ('00000000-0000-4000-c000-000000000001'::uuid, 'margot@example.test',  '{"username":"margot_reads","display_name":"Margot Okafor"}'::jsonb),
      ('00000000-0000-4000-c000-000000000002'::uuid, 'theo@example.test',    '{"username":"theo_turns_pages","display_name":"Theo Lindqvist"}'::jsonb),
      ('00000000-0000-4000-c000-000000000003'::uuid, 'priya@example.test',   '{"username":"priya_and_tea","display_name":"Priya Raman"}'::jsonb),
      ('00000000-0000-4000-c000-000000000004'::uuid, 'sam@example.test',     '{"username":"sam_by_lamplight","display_name":"Sam Delgado"}'::jsonb),
      ('00000000-0000-4000-c000-000000000005'::uuid, 'wren@example.test',    '{"username":"wren_annotates","display_name":"Wren Abernathy"}'::jsonb)
  ) as u (id, email, meta)
union all
-- Quieter readers: 1–30 rate books (no written review); 31–45 only shelve them.
select '00000000-0000-0000-0000-000000000000'::uuid,
       ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'reader' || n || '@example.test', '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('username', 'reader_' || lpad(n::text, 2, '0')), now(), now(), '', '', '', ''
  from generate_series(1, 45) as n;

update public.profiles set theme_color = v.color
  from (values
    ('00000000-0000-4000-c000-000000000001'::uuid, '#8B3A2B'),
    ('00000000-0000-4000-c000-000000000002'::uuid, '#2F4A66'),
    ('00000000-0000-4000-c000-000000000003'::uuid, '#2D4A3E'),
    ('00000000-0000-4000-c000-000000000004'::uuid, '#B8893A'),
    ('00000000-0000-4000-c000-000000000005'::uuid, '#5B3A5E')
  ) as v (id, color)
 where profiles.id = v.id;

-- Written reviews from the named readers.
insert into public.reviews (user_id, work_id, rating, body, has_spoilers) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 5,
   'I reread this every winter and it gets funnier every time. Mrs. Bennet alone is worth the price of admission, and the letter scene still makes me put the book down and pace around the room.', false),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 4,
   'Came for the romance, stayed for the sheer meanness of the dialogue. Austen is a sniper. Took a few chapters to tune into the rhythm, then I couldn''t stop.', false),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 4.5,
   'Perfect with a pot of tea on a rainy Sunday. Half a star off only because I wanted more of Elizabeth and Jane just talking.', false),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000001', 3.5,
   'I can see why people adore it, and the second proposal genuinely got me. But I''ll admit the middle section, when Lydia runs off with Wickham, dragged for me.', true),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000001', 5,
   'My copy is more pencil than print at this point. Every reread I notice a new joke hiding in plain sight.', false),
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000002', 4.5,
   'Not the monster movie at all. It''s a sad, furious book about being abandoned, and the creature is the most eloquent person in it.', false),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000002', 4,
   'Read it in one stormy weekend, which I recommend. Victor is insufferable, which I think is the point.', false),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000003', 4,
   'Skim the whale anatomy chapters if you must, but don''t skip Ishmael and Queequeg sharing a bed at the inn. Funnier and stranger than its reputation.', false),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000003', 3,
   'Magnificent in places, exhausting in others. Ahab''s speeches are thunder.', false),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000004', 4.5,
   'The castle chapters are some of the creepiest pages I''ve ever read. The diary format makes it feel like found footage.', false),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000005', 4,
   'So short and so sad. The last page is one of those endings you carry around for days.', false),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000006', 5,
   'Jane is the original "I am no bird" queen. Gothic, romantic and quietly furious about how women were treated.', false),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000007', 4,
   'Nobody in this book is likeable and I could not look away. Read it on a windy night for full effect.', false);

-- Ratings (no written review) from the quieter readers. Each book gets its own
-- typical score; a deterministic hash spreads ratings around it in half stars.
insert into public.reviews (user_id, work_id, rating)
select ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid,
       w.id,
       least(5, greatest(1, round((w.base + ((abs(hashtext(w.id::text || n)) % 7) - 3) * 0.5) * 2) / 2))
  from generate_series(1, 30) as n
  cross join (values
    ('00000000-0000-4000-b000-000000000001'::uuid, 4.3, 30),
    ('00000000-0000-4000-b000-000000000002'::uuid, 3.9, 24),
    ('00000000-0000-4000-b000-000000000003'::uuid, 3.4, 18),
    ('00000000-0000-4000-b000-000000000004'::uuid, 4.0, 22),
    ('00000000-0000-4000-b000-000000000005'::uuid, 3.9, 26),
    ('00000000-0000-4000-b000-000000000006'::uuid, 4.2, 25),
    ('00000000-0000-4000-b000-000000000007'::uuid, 3.8, 20)
  ) as w (id, base, raters)
 where n <= w.raters;

-- Shelves: everyone who rated a book has read it; a few more are reading it
-- now or want to.
insert into public.user_books (user_id, work_id, status)
select user_id, work_id, 'read' from public.reviews;

insert into public.user_books (user_id, work_id, status)
select ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid, w.id,
       (case when n % 3 = 0 then 'reading' else 'want_to_read' end)::public.reading_status
  from generate_series(1, 45) as n
  cross join (select id from public.works) as w
 where not exists (
   select 1 from public.user_books ub
    where ub.user_id = ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid and ub.work_id = w.id
 )
   and abs(hashtext(w.id::text || 'shelf' || n)) % 2 = 0;

-- ---------------------------------------------------------------------------
-- Profiles: bios, a private reader, extra shelves and follows, so profile
-- pages have something to show.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-c000-000000000006', 'authenticated', 'authenticated',
  'ada@example.test', '', now(), '{"provider":"email","providers":["email"]}',
  '{"username":"ada_after_dark","display_name":"Ada Finch"}', now(), now(), '', '', '', ''
);

update public.profiles set bio = v.bio, theme_color = coalesce(v.color, profiles.theme_color), is_private = v.private
  from (values
    ('00000000-0000-4000-c000-000000000001'::uuid, 'Rereads Austen every winter. Will talk your ear off about Mrs. Bennet.', null, false),
    ('00000000-0000-4000-c000-000000000002'::uuid, 'Slowly working through the big ones. Currently losing a fight with Moby-Dick.', null, false),
    ('00000000-0000-4000-c000-000000000003'::uuid, 'Tea first, then books. Mostly classics, occasionally a good ghost story.', null, false),
    ('00000000-0000-4000-c000-000000000004'::uuid, 'Reading by lamplight since forever. Horror on weekdays, romance on weekends.', null, false),
    ('00000000-0000-4000-c000-000000000005'::uuid, 'Margin-scribbler. If my copy is clean, I didn’t like it.', null, false),
    ('00000000-0000-4000-c000-000000000006'::uuid, 'Gothic novels and very strong coffee. Ask before you borrow.', '#4A2E4D', true)
  ) as v (id, bio, color, private)
 where profiles.id = v.id;

insert into public.user_books (user_id, work_id, status)
values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000006', 'reading'),
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000007', 'want_to_read'),
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000004', 'want_to_read'),
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000005', 'read'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000002', 'reading'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000005', 'want_to_read'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000004', 'want_to_read'),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000003', 'reading'),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000002', 'want_to_read'),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000004', 'read'),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000002', 'read'),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000007', 'reading')
on conflict (user_id, work_id) do nothing;

insert into public.reviews (user_id, work_id, rating) values
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000004', 5),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000002', 4.5);

-- Follows (the trigger makes follows of a private reader "pending"; Margot's is then approved).
insert into public.follows (follower_id, following_id)
select f, t from (values
  ('00000000-0000-4000-c000-000000000001'::uuid, '00000000-0000-4000-c000-000000000002'::uuid),
  ('00000000-0000-4000-c000-000000000001'::uuid, '00000000-0000-4000-c000-000000000003'::uuid),
  ('00000000-0000-4000-c000-000000000001'::uuid, '00000000-0000-4000-c000-000000000004'::uuid),
  ('00000000-0000-4000-c000-000000000001'::uuid, '00000000-0000-4000-c000-000000000006'::uuid),
  ('00000000-0000-4000-c000-000000000002'::uuid, '00000000-0000-4000-c000-000000000001'::uuid),
  ('00000000-0000-4000-c000-000000000002'::uuid, '00000000-0000-4000-c000-000000000006'::uuid),
  ('00000000-0000-4000-c000-000000000003'::uuid, '00000000-0000-4000-c000-000000000001'::uuid),
  ('00000000-0000-4000-c000-000000000004'::uuid, '00000000-0000-4000-c000-000000000001'::uuid),
  ('00000000-0000-4000-c000-000000000005'::uuid, '00000000-0000-4000-c000-000000000001'::uuid),
  ('00000000-0000-4000-c000-000000000005'::uuid, '00000000-0000-4000-c000-000000000003'::uuid)
) as v (f, t)
union all
select ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-4000-c000-000000000001'::uuid
  from generate_series(1, 14) as n;

update public.follows set status = 'accepted'
 where follower_id = '00000000-0000-4000-c000-000000000001' and following_id = '00000000-0000-4000-c000-000000000006';
