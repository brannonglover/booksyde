/*
 * Re-picks covers for the works already in the catalogue, using the same
 * checks and sources as new imports (src/lib/covers.ts).
 *
 *   npm run covers:backfill                 # dry run: prints what would change
 *   npm run covers:backfill -- --apply      # writes the changes
 *   npm run covers:backfill -- --limit=20   # only the 20 most-shelved works
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and (optionally)
 * GOOGLE_BOOKS_API_KEY from apps/web/.env.local. Hand-picked covers
 * (cover_source = 'manual') are never touched. Without a Google key only
 * covers that fail the checks or are small get re-picked; with one, every
 * cover is offered the publisher's art.
 */
import { createBooksydeClient, getEditionCovers, type EditionCover } from "@booksyde/shared";
import { type CoverSource, inspectCover, openLibraryCoverUrl, pickCover } from "../src/lib/covers";

const apply = process.argv.includes("--apply");
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 10_000;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const googleKey = process.env.GOOGLE_BOOKS_API_KEY || undefined;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env.local).");

const db = createBooksydeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };
const GOOD_HEIGHT = 400;

const { data: works, error } = await db
  .from("works")
  .select("id, title, cover_url, cover_source, open_library_id, editions ( isbn_13 )")
  .or("cover_source.is.null,cover_source.neq.manual")
  .order("shelved_count", { ascending: false })
  .limit(limit);
if (error) throw error;

console.log(`${apply ? "Applying" : "Dry run"} over ${works.length} works · Google Books ${googleKey ? "on" : "off (no GOOGLE_BOOKS_API_KEY)"}\n`);
const tally = { kept: 0, replaced: 0, cleared: 0, found: 0, none: 0 };

for (const work of works) {
  const label = work.title.slice(0, 50).padEnd(50);
  const current = work.cover_url ? await inspectCover(work.cover_url, init) : null;
  const fine = current?.ok && current.height >= GOOD_HEIGHT;
  if (fine && (!googleKey || work.cover_source === "google_books")) {
    tally.kept++;
    continue;
  }

  // The current Open Library cover stays in the running, ahead of the other editions.
  const currentId = Number(work.cover_url?.match(/covers\.openlibrary\.org\/b\/id\/(\d+)-/)?.[1]) || null;
  const editions: EditionCover[] = work.open_library_id
    ? await getEditionCovers(work.open_library_id, work.title, currentId, init)
    : [];
  if (currentId && !editions.some((e) => e.coverId === currentId)) editions.unshift({ coverId: currentId, isbn13: null });

  const picked = await pickCover({
    isbns: work.editions.map((e) => e.isbn_13),
    editions,
    googleKey,
    init,
  });
  const why = current ? (current.ok ? `small (${current.width}×${current.height})` : current.reason) : "no cover";

  let update: { cover_url: string | null; cover_source: CoverSource | null } | null = null;
  if (picked && picked.url !== work.cover_url) {
    update = { cover_url: picked.url, cover_source: picked.source };
    tally[work.cover_url ? "replaced" : "found"]++;
    console.log(`${label} ${why} → ${picked.source} ${picked.width}×${picked.height}  ${picked.url}`);
  } else if (!picked && work.cover_url && !current?.ok) {
    update = { cover_url: null, cover_source: null };
    tally.cleared++;
    console.log(`${label} ${why} → nothing usable; typeset cover`);
  } else {
    tally[work.cover_url ? "kept" : "none"]++;
  }

  if (apply && update) {
    const { error: writeError } = await db.from("works").update(update).eq("id", work.id);
    if (writeError) console.error(`  ✗ ${writeError.message}`);
  }
}

console.log(
  `\n${tally.replaced} replaced · ${tally.found} found · ${tally.cleared} cleared to typeset · ${tally.kept} kept · ${tally.none} still without`,
);
if (!apply && tally.replaced + tally.found + tally.cleared) console.log("Dry run: re-run with --apply to write these.");
