-- Where a work's cover came from. 'manual' covers were hand-picked by a
-- librarian and are never replaced automatically (the cover backfill and
-- imports skip them); the others can be re-picked when a better one turns up.
create type public.cover_source as enum ('open_library', 'google_books', 'manual');

alter table public.works add column cover_source public.cover_source;

update public.works set cover_source = 'open_library' where cover_url like 'https://covers.openlibrary.org/%';
-- Anything else on file today was set by hand (e.g. the Amazon covers in next.config's image hosts).
update public.works set cover_source = 'manual' where cover_url is not null and cover_source is null;
