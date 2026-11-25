/*
 * Files books already in the catalogue under their series ("Morning Star":
 * book 3 of Red Rising), from Open Library — the same data new imports use:
 * the series its search gives, or failing that the one the work's edition
 * records name (see editionSeries). Only books with an Open Library id and
 * no series yet are touched.
 *
 *   npm run series:backfill                 # dry run: prints what would be filed
 *   npm run series:backfill -- --apply      # writes it
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
 */
import { createBooksydeClient, fileInSeries, getEditionSeries, getOpenLibrarySeries } from "@booksyde/shared";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env.local).");

const db = createBooksydeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };
const PAGE = 1000;

console.log(`${apply ? "Applying" : "Dry run"}: books with an Open Library id and no series\n`);

// Every work with an Open Library id, paged by id; then drop the ones already filed.
const works: { id: string; title: string; subtitle: string | null; description: string | null; open_library_id: string }[] = [];
for (let after = ""; ; ) {
  const { data, error } = await db
    .from("works")
    .select("id, title, subtitle, description, open_library_id, series_works ( series_id )")
    .not("open_library_id", "is", null)
    .gt("id", after || "00000000-0000-0000-0000-000000000000")
    .order("id")
    .limit(PAGE);
  if (error) throw error;
  for (const w of data) if (w.series_works.length === 0) works.push({ id: w.id, title: w.title, subtitle: w.subtitle, description: w.description, open_library_id: w.open_library_id! });
  if (data.length < PAGE) break;
  after = data[data.length - 1].id;
}

const found = await getOpenLibrarySeries(
  works.map((w) => w.open_library_id),
  init,
);

const tally = { filed: 0, none: 0, failed: 0 };
const seriesSeen = new Set<string>();
for (const w of works) {
  // One request per book for the edition records, so only for books the search left out.
  const series = found.get(w.open_library_id) ?? (await getEditionSeries(w.open_library_id, w, init));
  if (!series) {
    tally.none++;
    continue;
  }
  seriesSeen.add(series.olid ?? series.name.toLowerCase());
  const source = series.olid ? "" : "  (from editions)";
  console.log(`${w.title.slice(0, 44).padEnd(44)} → ${series.name}${series.position != null ? ` #${series.position}` : ""}${source}`);
  if (!apply) {
    tally.filed++;
    continue;
  }
  try {
    await fileInSeries(db, w.id, series);
    tally.filed++;
  } catch (e) {
    tally.failed++;
    console.error(`  ✗ ${e instanceof Error ? e.message : JSON.stringify(e)}`);
  }
}

console.log(
  `\n${works.length} checked · ${tally.filed} ${apply ? "filed" : "to file"} in ${seriesSeen.size} series · ${tally.none} in no series${tally.failed ? ` · ${tally.failed} failed` : ""}`,
);
if (!apply && tally.filed) console.log("Dry run: re-run with --apply to write these.");
