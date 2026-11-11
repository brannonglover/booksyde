-- Local development seed data. Runs on `npm run db:reset`.
-- Real catalog data comes from the Open Library import (see supabase/import/README.md).

insert into public.tags (slug, name, kind) values
  ('fantasy',            'Fantasy',            'genre'),
  ('romance',            'Romance',            'genre'),
  ('thriller',           'Thriller',           'genre'),
  ('mystery',            'Mystery',            'genre'),
  ('science-fiction',    'Science Fiction',    'genre'),
  ('horror',             'Horror',             'genre'),
  ('literary-fiction',   'Literary Fiction',   'genre'),
  ('historical-fiction', 'Historical Fiction', 'genre'),
  ('non-fiction',        'Non-fiction',        'genre'),
  ('biography',          'Biography',          'genre'),
  ('young-adult',        'Young Adult',        'genre'),
  ('poetry',             'Poetry',             'genre'),
  ('cozy',               'Cozy',               'mood'),
  ('dark',               'Dark',               'mood'),
  ('funny',              'Funny',              'mood'),
  ('emotional',          'Emotional',          'mood'),
  ('hopeful',            'Hopeful',            'mood'),
  ('tense',              'Tense',              'mood'),
  ('adventurous',        'Adventurous',        'mood'),
  ('found-family',       'Found Family',       'trope'),
  ('enemies-to-lovers',  'Enemies to Lovers',  'trope'),
  ('unreliable-narrator','Unreliable Narrator','trope'),
  ('slow-burn',          'Slow Burn',          'trope'),
  ('fast-paced',         'Fast-paced',         'pace'),
  ('medium-paced',       'Medium-paced',       'pace'),
  ('slow-paced',         'Slow-paced',         'pace');

with a as (
  insert into public.authors (id, name, birth_date, death_date) values
    ('00000000-0000-4000-a000-000000000001', 'Jane Austen',          '1775-12-16', '1817-07-18'),
    ('00000000-0000-4000-a000-000000000002', 'Mary Shelley',         '1797-08-30', '1851-02-01'),
    ('00000000-0000-4000-a000-000000000003', 'Herman Melville',      '1819-08-01', '1891-09-28'),
    ('00000000-0000-4000-a000-000000000004', 'Bram Stoker',          '1847-11-08', '1912-04-20'),
    ('00000000-0000-4000-a000-000000000005', 'F. Scott Fitzgerald',  '1896-09-24', '1940-12-21')
  returning id
), w as (
  insert into public.works (id, title, first_published_year, original_language, cover_color, description) values
    ('00000000-0000-4000-b000-000000000001', 'Pride and Prejudice', 1813, 'en', '#C2416B',
     'Elizabeth Bennet and Mr. Darcy misjudge each other spectacularly in Regency England.'),
    ('00000000-0000-4000-b000-000000000002', 'Frankenstein', 1818, 'en', '#2F6B5E',
     'A young scientist creates life and must reckon with what he has made.'),
    ('00000000-0000-4000-b000-000000000003', 'Moby-Dick', 1851, 'en', '#2457A6',
     'Captain Ahab''s obsessive hunt for the white whale.'),
    ('00000000-0000-4000-b000-000000000004', 'Dracula', 1897, 'en', '#7A1F2B',
     'An epistolary tale of the Count''s journey from Transylvania to England.'),
    ('00000000-0000-4000-b000-000000000005', 'The Great Gatsby', 1925, 'en', '#C9A227',
     'Nick Carraway watches the mysterious Jay Gatsby chase a dream across the bay.')
  returning id
)
select count(*) from a, w;

insert into public.work_contributors (work_id, author_id) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000005');

insert into public.work_tags (work_id, tag_id, votes)
select w.id, t.id, 1
  from (values
    ('00000000-0000-4000-b000-000000000001'::uuid, 'romance'),
    ('00000000-0000-4000-b000-000000000001'::uuid, 'funny'),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'horror'),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'dark'),
    ('00000000-0000-4000-b000-000000000003'::uuid, 'adventurous'),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'horror'),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'tense'),
    ('00000000-0000-4000-b000-000000000005'::uuid, 'literary-fiction')
  ) as v(work_id, slug)
  join public.works w on w.id = v.work_id
  join public.tags t on t.slug = v.slug;
