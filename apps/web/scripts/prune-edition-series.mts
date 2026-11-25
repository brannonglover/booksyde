/*
 * Undoes loose series filing from edition records. The first run of the
 * edition-records fallback (24 Nov) took any series line an edition gave, so
 * books were filed under publishers' lines ("Pelican Books"), book clubs
 * ("Oprah's Book Club #31") and translations' collections ("Colección
 * Teatro #256"). This keeps a name-only series link (series with no Open
 * Library id) only where the book's own title, subtitle or description names
 * the series (editionSeriesFits), and deletes series left with no books.
 * Series with an Open Library id are never touched.
 *
 *   npm run series:prune                 # dry run: prints what would be removed
 *   npm run series:prune -- --apply      # removes it
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
 */
import { createBooksydeClient, editionSeriesFits } from "@booksyde/shared";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env.local).");

const db = createBooksydeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PAGE = 1000;

const series: {
  id: string;
  name: string;
  series_works: { work_id: string; position: number | null; works: { title: string; subtitle: string | null; description: string | null } | null }[];
}[] = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from("series")
    .select("id, name, series_works ( work_id, position, works ( title, subtitle, description ) )")
    .is("open_library_id", null)
    // Oldest first, so series filed while this runs land on later pages instead of shifting rows past the reader.
    .order("created_at")
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) throw error;
  series.push(...data);
  if (data.length < PAGE) break;
}

console.log(`${apply ? "Applying" : "Dry run"}: ${series.length} series with no Open Library id\n`);
const tally = { kept: 0, unlinked: 0, emptied: 0, failed: 0 };
for (const s of series) {
  const wrong = s.series_works.filter((l) => !l.works || !editionSeriesFits(s.name, l.works));
  tally.kept += s.series_works.length - wrong.length;
  for (const l of wrong) console.log(`${(l.works?.title ?? l.work_id).slice(0, 44).padEnd(44)} ✗ ${s.name}${l.position != null ? ` #${l.position}` : ""}`);
  const empties = wrong.length === s.series_works.length;
  if (!apply) {
    tally.unlinked += wrong.length;
    if (empties) tally.emptied++;
    continue;
  }
  try {
    if (wrong.length) {
      const { error } = await db.from("series_works").delete().eq("series_id", s.id).in("work_id", wrong.map((l) => l.work_id));
      if (error) throw error;
      tally.unlinked += wrong.length;
    }
    if (empties) {
      const { error } = await db.from("series").delete().eq("id", s.id);
      if (error) throw error;
      tally.emptied++;
    }
  } catch (e) {
    tally.failed++;
    console.error(`  ✗ ${s.name}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
  }
}

console.log(
  `\n${tally.kept} links kept · ${tally.unlinked} ${apply ? "removed" : "to remove"} · ${tally.emptied} empty series ${apply ? "deleted" : "to delete"}${tally.failed ? ` · ${tally.failed} failed` : ""}`,
);
if (!apply && tally.unlinked) console.log("Dry run: re-run with --apply to remove these.");
