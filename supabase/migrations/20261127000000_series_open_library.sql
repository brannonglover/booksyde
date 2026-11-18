-- Series come from Open Library (search results carry series_key, e.g.
-- "OL327572L" for Red Rising). Keep that id so every book in a series is
-- filed under one row, however many times the series is met.
alter table public.series add column open_library_id text unique;

-- Listing a series' books starts from the series.
create index if not exists series_works_series_idx on public.series_works (series_id, position);
