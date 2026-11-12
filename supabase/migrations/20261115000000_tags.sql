-- The tag vocabulary readers vote with: genres, moods, tropes and pace.
-- Reference data every database needs (it used to live only in seed.sql),
-- so imported books get genre tags and the search drawers have something
-- to show. Safe to re-run: existing slugs are left alone.

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
  ('classics',           'Classics',           'genre'),
  ('gothic',             'Gothic',             'genre'),
  ('cozy',               'Cozy',               'mood'),
  ('dark',               'Dark',               'mood'),
  ('funny',              'Funny',              'mood'),
  ('emotional',          'Emotional',          'mood'),
  ('hopeful',            'Hopeful',            'mood'),
  ('tense',              'Tense',              'mood'),
  ('adventurous',        'Adventurous',        'mood'),
  ('reflective',         'Reflective',         'mood'),
  ('mysterious',         'Mysterious',         'mood'),
  ('found-family',       'Found Family',       'trope'),
  ('enemies-to-lovers',  'Enemies to Lovers',  'trope'),
  ('unreliable-narrator','Unreliable Narrator','trope'),
  ('slow-burn',          'Slow Burn',          'trope'),
  ('epistolary',         'Told in Letters',    'trope'),
  ('obsession',          'Obsession',          'trope'),
  ('fast-paced',         'Fast-paced',         'pace'),
  ('medium-paced',       'Medium-paced',       'pace'),
  ('slow-paced',         'Slow-paced',         'pace')
on conflict (slug) do nothing;
