# Catalog import (Open Library)

The catalog is seeded from [Open Library's bulk data dumps](https://openlibrary.org/developers/dumps),
then grown on demand from search APIs. Nothing here is automated yet; this is the plan.

1. Download the latest `ol_dump_works`, `ol_dump_editions` and `ol_dump_authors` files
   (tab-separated, one JSON record per line).
2. Start with a slice (e.g. works with an ISBN and a cover, or the top ~100k by edition count)
   so local development stays fast.
3. Map records into `authors`, `works`, `editions` and `work_contributors`, keeping
   `open_library_id` on each row so re-imports upsert instead of duplicating.
4. Covers: `https://covers.openlibrary.org/b/id/{cover_id}-L.jpg`. Extract a dominant colour
   per cover into `works.cover_color` (the UI tints book pages with it).
5. Run the import with the **service role key** (it bypasses RLS). Never ship that key to a client.
6. Later: generate `works.embedding` from description + tags to power `similar_works()`.
