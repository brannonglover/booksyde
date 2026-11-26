import "server-only";

import {
  type BookLike,
  bylineNames,
  createBooksydeClient,
  fileInSeries,
  getOpenLibraryAuthor,
  getOpenLibraryBook,
  OPEN_LIBRARY_WORK_ID,
  type OpenLibrarySeries,
  openLibraryTags,
  sameBook,
  titleKey,
} from "@booksyde/shared";
import { inspectCover, pickCover } from "./covers";
import { supabaseUrl } from "./supabase/env";

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
export const canImportBooks = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: only ever use it for catalogue writes whose data came from Open Library, never from the visitor. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Db = ReturnType<typeof adminClient>;

export const userAgent = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };

type HeldWork = { id: string; title: string; open_library_id: string | null; authors: string[] };

const heldSelect = "id, title, open_library_id, work_contributors ( position, authors ( name ) )";

function toHeld(w: { id: string; title: string; open_library_id: string | null; work_contributors: { position: number; authors: { name: string } }[] }): HeldWork {
  const authors = [...w.work_contributors].sort((a, b) => a.position - b.position).map((c) => c.authors.name);
  return { id: w.id, title: w.title, open_library_id: w.open_library_id, authors };
}

/**
 * A work we already hold that is this book, or null. An edition with one of
 * its ISBNs counts (as long as title or an author agrees, in case Open Library
 * filed a stray ISBN under the wrong work); otherwise `sameBook` on title and
 * authors. Every way into the catalogue goes through here, so this is what
 * keeps the same book from being filed twice.
 */
export async function findCatalogueMatch(book: BookLike & { isbns?: string[] }): Promise<HeldWork | null> {
  const db = adminClient();
  const key = titleKey(book.title);

  if (book.isbns?.length) {
    const { data } = await db.from("editions").select(`works ( ${heldSelect} )`).in("isbn_13", book.isbns).limit(10);
    for (const row of data ?? []) {
      if (!row.works) continue;
      const held = toHeld(row.works);
      const sharesAuthor = sameBook({ ...held, title: book.title }, book);
      if (titleKey(held.title) === key || sharesAuthor) return held;
    }
  }

  // Narrow by title in the database (the words before any subtitle), then compare properly.
  const words = book.title.split(/[:;(]/)[0].trim().replace(/^(the|a|an)\s+/i, "").replace(/[%_\\]/g, "");
  if (!words) return null;
  const { data: sameTitle } = await db
    .from("works")
    .select(heldSelect)
    .ilike("title", `%${words}%`)
    .order("shelved_count", { ascending: false })
    .limit(25);
  return (sameTitle ?? []).map(toHeld).find((w) => sameBook(w, book)) ?? null;
}

/** How a New York Times list has a book: its cover image and ISBNs, the list's main one first. */
export type Listing = { coverUrl: string | null; isbns: string[] };

/**
 * This book on a New York Times list we've seen (the latest week it was on
 * one), by ISBN or else by title and an author. Null if it hasn't charted.
 */
export async function findListing(db: Db, book: BookLike & { isbns: string[] }): Promise<Listing | null> {
  const fields = "isbn13, cover_url, title, author";
  const toListing = (e: { isbn13: string | null; cover_url: string | null }) => ({ coverUrl: e.cover_url, isbns: e.isbn13 ? [e.isbn13] : [] });

  if (book.isbns.length) {
    const { data } = await db.from("bestseller_entries").select(fields).in("isbn13", book.isbns).order("list_date", { ascending: false }).limit(1);
    if (data?.[0]) return toListing(data[0]);
  }
  // The lists print titles in capitals, so match loosely here and compare properly after.
  const words = book.title.split(/[:;(]/)[0].trim().replace(/[%_\\]/g, "");
  if (!words) return null;
  const { data } = await db.from("bestseller_entries").select(fields).ilike("title", `${words}%`).order("list_date", { ascending: false }).limit(20);
  const hit = (data ?? []).find((e) => sameBook({ title: e.title, authors: bylineNames(e.author) }, book));
  return hit ? toListing(hit) : null;
}

/**
 * Files a listing's main ISBN with the work, so the news job finds our copy
 * by ISBN (Open Library often lacks the US edition a list names), and points
 * the list's rows and stories for that ISBN at it so their cards open the book now.
 */
async function fileListing(db: Db, workId: string, listing: Listing) {
  const isbn = listing.isbns[0];
  if (!isbn) return;
  const held = await db.from("editions").select("work_id").eq("isbn_13", isbn).maybeSingle();
  if (held.data && held.data.work_id !== workId) return;
  if (!held.data) await db.from("editions").insert({ work_id: workId, isbn_13: isbn, format: "other" });
  await db.from("bestseller_entries").update({ work_id: workId }).eq("isbn13", isbn).is("work_id", null);
  await db.from("news_items").update({ work_id: workId }).like("key", `chart:%:${isbn}`).is("work_id", null);
}

/**
 * Brings an Open Library work into the catalogue (title, description, cover,
 * authors, one edition, genre tags) and returns its Booksyde id. Idempotent:
 * a work we already hold — by Open Library id, a shared ISBN, or same title
 * and an author in common — just returns the existing id. Null if Open Library doesn't know the work.
 *
 * `listing` is the book as a New York Times list has it, when the caller is
 * working from one (the news job); otherwise the lists we've stored are
 * checked. New bestsellers often chart before anyone gives Open Library a
 * cover, so the list's image stands in until a better one turns up.
 */
export async function importOpenLibraryWork(olid: string, listing?: Listing): Promise<string | null> {
  if (!OPEN_LIBRARY_WORK_ID.test(olid)) return null;
  if (!canImportBooks) throw new Error("SUPABASE_SECRET_KEY is not set, so books can't be added to the catalogue.");
  const db = adminClient();

  const existing = await db.from("works").select("id").eq("open_library_id", olid).maybeSingle();
  if (existing.data) {
    if (listing) await fileListing(db, existing.data.id, listing);
    return existing.data.id;
  }

  const book = await getOpenLibraryBook(olid, userAgent);
  if (!book) return null;
  const authors = book.authors.map((a) => a.name);

  // Already on file under another (or no) Open Library id? See findCatalogueMatch for what counts.
  const match = await findCatalogueMatch({ title: book.title, authors, isbns: book.isbns });
  if (match) {
    if (!match.open_library_id) await db.from("works").update({ open_library_id: olid }).eq("id", match.id);
    await fileSeries(db, match.id, book.series, { onlyIfUnfiled: true });
    if (listing) await fileListing(db, match.id, listing);
    return match.id;
  }

  // The chosen edition's cover first, then the other English editions in case it's poor.
  const editions =
    book.coverId && !book.editions.some((e) => e.coverId === book.coverId)
      ? [{ coverId: book.coverId, isbn13: book.isbn13 }, ...book.editions]
      : book.editions;
  const cover = await pickCover({ isbns: [book.isbn13], editions, init: userAgent });
  const listed = listing ?? (await findListing(db, { title: book.title, authors, isbns: book.isbns }));
  // Left unsourced, like the list covers bestseller-import uses, so the cover backfill can improve on it.
  const listCover =
    !cover && listed?.coverUrl && (await inspectCover(listed.coverUrl, userAgent)).ok ? listed.coverUrl : null;

  const { data: work, error } = await db
    .from("works")
    .insert({
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      first_published_year: book.year,
      cover_url: cover?.url ?? listCover,
      cover_source: cover?.source ?? null,
      open_library_id: olid,
    })
    .select("id")
    .single();
  if (error) {
    // Someone else imported it a moment ago.
    const again = await db.from("works").select("id").eq("open_library_id", olid).maybeSingle();
    if (again.data) return again.data.id;
    throw error;
  }

  // Authors: reuse by Open Library id, then by exact name; otherwise create.
  for (const [position, author] of book.authors.entries()) {
    let authorId: string | null = null;
    if (author.olid) {
      const byOl = await db.from("authors").select("id").eq("open_library_id", author.olid).maybeSingle();
      authorId = byOl.data?.id ?? null;
    }
    if (!authorId) {
      const byName = await db.from("authors").select("id, open_library_id").ilike("name", author.name.replace(/[%_\\]/g, "")).limit(1).maybeSingle();
      if (byName.data) {
        authorId = byName.data.id;
        if (!byName.data.open_library_id && author.olid) {
          await db.from("authors").update({ open_library_id: author.olid }).eq("id", authorId);
        }
      }
    }
    if (!authorId) {
      // New to us: bring their portrait, bio and dates along for the book page.
      const details = author.olid ? await getOpenLibraryAuthor(author.olid, userAgent) : null;
      const created = await db
        .from("authors")
        .insert({
          name: author.name,
          open_library_id: author.olid,
          bio: details?.bio ?? null,
          photo_url: details?.photoUrl ?? null,
          birth_date: details?.birthDate ?? null,
          death_date: details?.deathDate ?? null,
        })
        .select("id")
        .single();
      if (created.error) continue;
      authorId = created.data.id;
    }
    await db.from("work_contributors").insert({ work_id: work.id, author_id: authorId, role: "author", position });
  }

  // One edition so the ISBN finds it next time (skipped if another work already has that ISBN).
  if (book.isbn13 || book.pages) {
    const edition = { work_id: work.id, isbn_13: book.isbn13, page_count: book.pages, format: "other" as const };
    const { error: editionError } = await db.from("editions").insert(edition);
    if (editionError && book.isbn13) await db.from("editions").insert({ ...edition, isbn_13: null });
  }
  if (listed) await fileListing(db, work.id, listed);

  const slugs = openLibraryTags(book.subjects);
  if (slugs.length) {
    const { data: tags } = await db.from("tags").select("id").in("slug", slugs);
    if (tags?.length) await db.from("work_tags").insert(tags.map((t) => ({ work_id: work.id, tag_id: t.id, votes: 1 })));
  }

  await fileSeries(db, work.id, book.series);

  return work.id;
}

/**
 * Files the work under its Open Library series. Never fails the import: the
 * book is on the shelf either way, and the series backfill can catch up later.
 */
async function fileSeries(
  db: ReturnType<typeof adminClient>,
  workId: string,
  series: OpenLibrarySeries | null,
  { onlyIfUnfiled = false } = {},
) {
  if (!series) return;
  try {
    if (onlyIfUnfiled) {
      const { count } = await db.from("series_works").select("work_id", { count: "exact", head: true }).eq("work_id", workId);
      if (count) return;
    }
    await fileInSeries(db, workId, series);
  } catch (e) {
    console.error("Couldn't file the book under its series", workId, series, e);
  }
}
