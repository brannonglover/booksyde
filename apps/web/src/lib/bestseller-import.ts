import "server-only";

import { bylineNames, createBooksydeClient, getGoogleBookByIsbn, titleKey } from "@booksyde/shared";
import type { ListEntry } from "./bestsellers";
import { pickCover } from "./covers";
import { findCatalogueMatch, userAgent } from "./open-library-import";
import { supabaseUrl } from "./supabase/env";

/*
 * A book page for a new bestseller that Open Library doesn't have yet, so its
 * "This week in books" card opens a book rather than a search. Built from the
 * New York Times list (title, authors, ISBN, publisher, a one-line
 * description) and, with a key, Google Books (the full description, page
 * count, publication date and a checked cover).
 *
 * When Open Library catches up, its import finds this work by ISBN or by title
 * and author (findCatalogueMatch) and adopts it rather than filing it twice.
 */

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

/** Bypasses RLS: only for catalogue writes whose data came from the NYT and Google Books, never from a visitor. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">", nbsp: " " };
const decode = (text: string) => text.replace(/&(amp|quot|apos|#39|lt|gt|nbsp);/g, (_, e: string) => ENTITIES[e]);

/** Adds a list entry to the catalogue (or finds it there) and returns its work id; null if it can't be added. */
export async function importBestseller(entry: ListEntry): Promise<string | null> {
  if (!supabaseUrl || !secretKey) return null;
  const names = bylineNames(entry.author);
  if (!names.length) return null;

  const held = await findCatalogueMatch({ title: entry.title, authors: names, isbns: entry.isbns });
  if (held) return held.id;

  const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
  const isbn = entry.isbn13 ?? entry.isbns[0] ?? null;
  const google =
    googleKey && isbn ? await getGoogleBookByIsbn(isbn, googleKey, { cache: "no-store" }).catch(() => null) : null;
  // Only trust Google's details when it's plainly the same book.
  const same = google && titleKey(google.title) === titleKey(entry.title) ? google : null;
  const cover = await pickCover({ isbns: entry.isbns, init: { ...userAgent, cache: "no-store" } });

  const db = adminClient();
  const { data: work, error } = await db
    .from("works")
    .insert({
      title: same?.title ?? entry.title,
      subtitle: same?.subtitle ?? null,
      description: decode(same?.description ?? entry.description ?? "") || null,
      first_published_year: same?.year ?? new Date().getUTCFullYear(),
      // The list's own image when nothing better checks out; left unsourced so the cover backfill can improve on it.
      cover_url: cover?.url ?? (entry.coverUrl || null),
      cover_source: cover?.source ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Google's spelling of the authors when it has them (the list's byline can include a "with" co-writer).
  for (const [position, name] of (same?.authors.length ? same.authors : names).entries()) {
    const { data: found } = await db.from("authors").select("id").ilike("name", name.replace(/[%_\\]/g, "")).limit(1).maybeSingle();
    let authorId = found?.id ?? null;
    if (!authorId) {
      const created = await db.from("authors").insert({ name }).select("id").single();
      if (created.error) continue;
      authorId = created.data.id;
    }
    await db.from("work_contributors").insert({ work_id: work.id, author_id: authorId, role: "author", position });
  }

  // One edition so the ISBN finds it next time (without the ISBN if another work already has it).
  const edition = {
    work_id: work.id,
    isbn_13: isbn,
    publisher: entry.publisher,
    published_date: same?.publishedDate ?? null,
    page_count: same?.pageCount ?? null,
    format: "other" as const,
  };
  const { error: editionError } = await db.from("editions").insert(edition);
  if (editionError && isbn) await db.from("editions").insert({ ...edition, isbn_13: null });

  return work.id;
}
