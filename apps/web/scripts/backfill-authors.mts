/*
 * Fills in portraits, bios and dates for authors already in the catalogue,
 * from Open Library (the same lookup new imports use). Only empty fields
 * are written; anything already set is left alone.
 *
 *   npm run authors:backfill                 # dry run: prints what would change
 *   npm run authors:backfill -- --apply      # writes the changes
 *   npm run authors:backfill -- --limit=20   # only the first 20 authors without a photo
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
 */
import { createBooksydeClient, getOpenLibraryAuthor } from "@booksyde/shared";

const apply = process.argv.includes("--apply");
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || Infinity;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env.local).");

const db = createBooksydeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };
const PAGE = 500;

console.log(`${apply ? "Applying" : "Dry run"}: authors with an Open Library id and no photo\n`);
const tally = { updated: 0, photos: 0, nothing: 0, unreachable: 0 };
let seen = 0;
let after: string | null = null;

// Page by id, so rows that gain a photo mid-run don't shift the pages.
while (seen < limit) {
  let query = db
    .from("authors")
    .select("id, name, open_library_id, bio, birth_date, death_date")
    .is("photo_url", null)
    .not("open_library_id", "is", null);
  if (after) query = query.gt("id", after);
  const { data: authors, error } = await query.order("id").limit(Math.min(PAGE, limit - seen));
  if (error) throw error;
  if (authors.length === 0) break;
  after = authors[authors.length - 1].id;
  seen += authors.length;

  for (const a of authors) {
    const details = await getOpenLibraryAuthor(a.open_library_id!, init);
    if (!details) {
      tally.unreachable++;
      continue;
    }
    const update: { photo_url?: string; bio?: string; birth_date?: string; death_date?: string } = {};
    if (details.photoUrl) update.photo_url = details.photoUrl;
    if (!a.bio && details.bio) update.bio = details.bio;
    if (!a.birth_date && details.birthDate) update.birth_date = details.birthDate;
    if (!a.death_date && details.deathDate) update.death_date = details.deathDate;

    const fields = Object.keys(update);
    if (fields.length === 0) {
      tally.nothing++;
      continue;
    }
    tally.updated++;
    if (update.photo_url) tally.photos++;
    console.log(`${a.name.slice(0, 40).padEnd(40)} + ${fields.join(", ")}`);
    if (apply) {
      const { error: writeError } = await db.from("authors").update(update).eq("id", a.id);
      if (writeError) console.error(`  ✗ ${writeError.message}`);
    }
  }
}

console.log(
  `\n${seen} checked · ${tally.updated} updated (${tally.photos} with a photo) · ${tally.nothing} nothing new · ${tally.unreachable} unreachable`,
);
if (!apply && tally.updated) console.log("Dry run: re-run with --apply to write these.");
