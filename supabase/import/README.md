# Catalog import (Open Library)

The catalogue is seeded in bulk from [Open Library's monthly data dumps](https://openlibrary.org/developers/dumps)
by [`open-library.mts`](open-library.mts), then grows on demand when someone adds a book from search
(`apps/web/src/lib/open-library-import.ts`).

The importer reads the dumps from disk. Apart from the one-time download, the only network traffic is
batched writes to Supabase (500 rows at a time), so it never touches Open Library's API.

## 1. Download the dumps

Into `supabase/import/dumps/` (git-ignored). Sizes as of the 2026-10 dump:

| Dump          | Size    | Used for                                                    |
| ------------- | ------- | ----------------------------------------------------------- |
| `reading-log` | 125 MB  | Ranking: how often readers shelve each book                 |
| `ratings`     | 9 MB    | Ranking: how often readers rate it                          |
| `works`       | 4.1 GB  | Title, subtitle, description, cover, authors, subjects      |
| `authors`     | 0.8 GB  | Name, bio, photo, birth/death dates                         |
| `editions`    | 12.6 GB | ISBN, pages, publisher, format, first published year. Optional but recommended: without it books have no ISBN, so ISBN search can't find them |

```bash
mkdir -p supabase/import/dumps && cd supabase/import/dumps
for d in reading-log ratings works authors editions; do
  curl -L -C - -o "ol_dump_${d}_latest.txt.gz" "https://openlibrary.org/data/ol_dump_${d}_latest.txt.gz"
done
```

(`-C -` resumes an interrupted download.) Leave the files gzipped: the importer streams them.

## 2. Run it

```bash
npm run db:import -- --limit 10000 --dry-run   # read everything, print what would be imported
npm run db:import -- --limit 10000             # write to the local Supabase (npm run db:start first)
```

By default it writes to the **local** stack (it asks `supabase status` for the URL and secret key).
To seed the hosted project, point it at an env file holding `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SECRET_KEY`. It refuses any non-local URL unless you also pass `--remote`:

```bash
npm run db:import -- --limit 10000 --env apps/web/.env.hosted.local --remote
```

`npm run db:import -- --help` lists every option, e.g. `--allow-no-cover`, or `--works PATH` etc. to use
dump files outside `dumps/`.

### What it does

1. **Ranks** every work by the number of reading-log entries plus ratings, and keeps the top `3 × limit` as
   candidates (`2 × limit` with `--all-languages`).
2. **Works pass:** keeps candidates that have a title, an author and a cover.
3. **Editions pass:** for every candidate, picks the best English edition (ISBN-13, page count, cover,
   publisher, known format) and takes the earliest publication year across all editions. An edition counts
   as English by its language field or, when it has none, by an ISBN in the English-language groups
   (978-0, 978-1, 979-8). Candidates with no English edition are dropped, so the next most popular English
   book takes their place. Pass `--all-languages` to keep them.

   It also gives translated books their **English title**. Open Library titles a work in its original
   language ("Преступление и наказание"), so the English editions vote on a title instead (Crime and
   Punishment). Spellings that differ only in case, or in a leading "The"/"A", count as one vote. The
   work's own title is kept whenever English editions use it about as often as foreign ones, so English
   books are never renamed, not even Harry Potter to its US title.

   Covers get the same treatment. When a work's cover belongs to a non-English edition and to no
   English one (L'Étranger for The Stranger), it's swapped for the cover of the best English edition.
4. **Authors pass:** reads just the authors the remaining works need.
5. **Selects** the top `limit`, with one work per title + lead author (Open Library has many duplicate works).
6. **Writes**, skipping anything already in the catalogue:
   - Works matched by `open_library_id`, or by title + lead author for books added by hand. Those get their
     `open_library_id` filled in.
   - Authors matched by `open_library_id`, then by exact name.
   - ISBNs that another edition already has are left off.
   - Genre tags come from Open Library subjects (`openLibraryTags`).

Existing rows are never overwritten, with one exception: a book imported with its original-language title
or cover gets the English one, but only while that field still holds exactly what Open Library had, so
anything edited by hand stays. So it's safe to re-run, for example with a larger `--limit` or next
month's dump. Works go in 500 at a time together with their authors, editions and tags. If a run is
interrupted, the next run finishes the half-written batch.

### Time and memory

The editions pass dominates the run because it streams the whole 12.6 GB file. A 10k dry run took about
5 minutes on an Apple Silicon Mac with a peak of 730 MB of memory: one counter per ranked work plus the
candidate records. For `--limit` above about 100k, give Node more heap:
`NODE_OPTIONS=--max-old-space-size=4096`.

Database size matters more than the network. Descriptions are the bulk of each row, so 10k books is a few
tens of MB. Check the free tier's 500 MB limit before going above about 100k.

## Not done yet

- `works.cover_color` stays null. Extracting it means downloading every cover, so do it lazily (on first
  view) or in a slow background job for the most popular books. Don't bulk-fetch from `covers.openlibrary.org`;
  Open Library asks people not to.
- `works.embedding` for `similar_works()`: generate it from description + tags after importing.
- Series aren't in the dumps. After an import, run `npm run series:backfill` (dry run) and then
  `npm run series:backfill -- --apply` to file books under their series from Open Library's search API.
  Books added from search get their series as they're added.
- Translators and other non-author contributors aren't imported.
- Author names come from Open Library's author record as-is, so some are in the original script or a
  non-English spelling (太宰 治 rather than Osamu Dazai, Fiódor Dostoievski).
- `first_published_year` is the earliest year on any edition, so one misdated edition makes it too early.
