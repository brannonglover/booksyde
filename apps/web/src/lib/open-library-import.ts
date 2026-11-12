import "server-only";

import { bookIdentity, createBooksydeClient, getOpenLibraryBook, OPEN_LIBRARY_WORK_ID, openLibraryTags } from "@booksyde/shared";
import { supabaseUrl } from "./supabase/env";

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
export const canImportBooks = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: only ever use it for catalogue writes whose data came from Open Library, never from the visitor. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const userAgent = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };

/**
 * Brings an Open Library work into the catalogue (title, description, cover,
 * authors, one edition, genre tags) and returns its Booksyde id. Idempotent:
 * a work we already hold — by Open Library id, or same title and author —
 * just returns the existing id. Null if Open Library doesn't know the work.
 */
export async function importOpenLibraryWork(olid: string): Promise<string | null> {
  if (!OPEN_LIBRARY_WORK_ID.test(olid)) return null;
  if (!canImportBooks) throw new Error("SUPABASE_SECRET_KEY is not set, so books can't be added to the catalogue.");
  const db = adminClient();

  const existing = await db.from("works").select("id").eq("open_library_id", olid).maybeSingle();
  if (existing.data) return existing.data.id;

  const book = await getOpenLibraryBook(olid, userAgent);
  if (!book) return null;

  // Already on file under another (or no) Open Library id? Same title + lead author counts.
  const identity = bookIdentity(book.title, book.authors[0]?.name);
  const { data: sameTitle } = await db
    .from("works")
    .select("id, title, open_library_id, work_contributors ( position, authors ( name ) )")
    .ilike("title", `${book.title.split(/[:;(]/)[0].trim().replace(/[%_\\]/g, "")}%`)
    .limit(10);
  const match = (sameTitle ?? []).find((w) => {
    const lead = [...w.work_contributors].sort((a, b) => a.position - b.position)[0]?.authors.name;
    return bookIdentity(w.title, lead) === identity;
  });
  if (match) {
    if (!match.open_library_id) await db.from("works").update({ open_library_id: olid }).eq("id", match.id);
    return match.id;
  }

  const { data: work, error } = await db
    .from("works")
    .insert({
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      first_published_year: book.year,
      cover_url: book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : null,
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
      const created = await db.from("authors").insert({ name: author.name, open_library_id: author.olid }).select("id").single();
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

  const slugs = openLibraryTags(book.subjects);
  if (slugs.length) {
    const { data: tags } = await db.from("tags").select("id").in("slug", slugs);
    if (tags?.length) await db.from("work_tags").insert(tags.map((t) => ({ work_id: work.id, tag_id: t.id, votes: 1 })));
  }

  return work.id;
}
