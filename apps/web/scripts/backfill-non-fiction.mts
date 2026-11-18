/*
 * Files books already in the catalogue under Non-fiction. Imports used to have
 * no rule for it, so the drawer sat empty; this re-reads each book's Open
 * Library subjects and adds the tag wherever the import rules now would.
 * Books filed under Biography and no fiction genre are non-fiction too, Open
 * Library or not (so that part still runs when Open Library is down). Only books without a
 * Non-fiction tag yet are touched.
 *
 *   npm run non-fiction:backfill                 # dry run: prints what would be filed
 *   npm run non-fiction:backfill -- --apply      # writes it
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
 */
import { createBooksydeClient, FICTION_GENRES, getOpenLibrarySubjects, openLibraryTags } from "@booksyde/shared";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env.local).");

const db = createBooksydeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };
const PAGE = 1000;

const { data: tags, error: tagError } = await db.from("tags").select("id, slug");
if (tagError) throw tagError;
const tag = tags.find((t) => t.slug === "non-fiction");
const biography = tags.find((t) => t.slug === "biography");
if (!tag) throw new Error("No non-fiction tag in the catalogue.");
const fictionTagIds = new Set(tags.filter((t) => FICTION_GENRES.has(t.slug)).map((t) => t.id));

console.log(`${apply ? "Applying" : "Dry run"}: books with no Non-fiction tag\n`);

// Every work, paged by id; then drop the ones already filed.
const works: { id: string; title: string; open_library_id: string | null; biography: boolean }[] = [];
for (let after = ""; ; ) {
  const { data, error } = await db
    .from("works")
    .select("id, title, open_library_id, work_tags ( tag_id, votes )")
    .gt("id", after || "00000000-0000-0000-0000-000000000000")
    .order("id")
    .limit(PAGE);
  if (error) throw error;
  for (const w of data) {
    if (w.work_tags.some((t) => t.tag_id === tag.id)) continue;
    const voted = w.work_tags.filter((t) => t.votes > 0);
    const isBiography = voted.some((t) => t.tag_id === biography?.id) && !voted.some((t) => fictionTagIds.has(t.tag_id));
    works.push({ id: w.id, title: w.title, open_library_id: w.open_library_id, biography: isBiography });
  }
  if (data.length < PAGE) break;
  after = data[data.length - 1].id;
}

let subjects = new Map<string, string[]>();
try {
  subjects = await getOpenLibrarySubjects(
    works.flatMap((w) => (w.open_library_id ? [w.open_library_id] : [])),
    init,
  );
} catch (e) {
  console.warn(`Open Library unavailable (${e instanceof Error ? e.message : e}); filing biographies only.\n`);
}

const toFile = works.filter(
  (w) => w.biography || (w.open_library_id && openLibraryTags(subjects.get(w.open_library_id) ?? []).includes("non-fiction")),
);
for (const w of toFile) console.log(`  ${w.title.slice(0, 70)}`);

if (apply && toFile.length) {
  for (let i = 0; i < toFile.length; i += 500) {
    const rows = toFile.slice(i, i + 500).map((w) => ({ work_id: w.id, tag_id: tag.id, votes: 1 }));
    const { error } = await db.from("work_tags").upsert(rows, { onConflict: "work_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

console.log(`\n${works.length} checked · ${toFile.length} ${apply ? "filed" : "to file"} under Non-fiction · ${subjects.size} found on Open Library`);
if (!apply && toFile.length) console.log("Dry run: re-run with --apply to write these.");
