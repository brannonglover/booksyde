-- The length of the reader's own copy.
--
-- Editions of the same book rarely agree on their page count, and our catalog
-- doesn't always have the one in your hands. A reader can set how many pages
-- their copy has, and their progress is measured against that instead.
-- Null means "use the edition's count".
alter table public.user_books
  add column page_count integer check (page_count between 1 and 100000);
