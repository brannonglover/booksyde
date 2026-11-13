-- How a book's backdrop is drawn wherever it's featured (the home page hero,
-- later the book page). Null means "auto": the UI uses the richest style the
-- book has data for — generated image, then setting scene, then genre motif,
-- then the blurred cover, which every book with a cover can have.
create type public.backdrop_style as enum ('cover', 'motif', 'setting', 'generated');

alter table public.works add column backdrop_style public.backdrop_style;
