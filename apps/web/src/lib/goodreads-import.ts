import "server-only";

import {
  bookIdentity,
  createBooksydeClient,
  type GoodreadsBook,
  goodreadsSearchTitle,
  searchOpenLibrary,
} from "@booksyde/shared";
import { findCatalogueMatch, importOpenLibraryWork, userAgent } from "./open-library-import";
import { supabaseKey, supabaseUrl } from "./supabase/env";

/*
 * Finding the Booksyde work for a row of a Goodreads export. Only the ISBN,
 * title and author from the visitor's file are used, and only to look things
 * up: anything added to the catalogue comes from Open Library.
 */

function publicClient() {
  return createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

/** ISBN-13 → ISBN-10, for editions only stored under the older number. */
function isbn13To10(isbn13: string) {
  if (!isbn13.startsWith("978")) return null;
  const body = isbn13.slice(3, 12);
  const sum = [...body].reduce((acc, ch, i) => acc + Number(ch) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return body + (check === 10 ? "X" : String(check));
}

async function byIsbn(isbn13: string) {
  const isbn10 = isbn13To10(isbn13);
  const { data } = await publicClient()
    .from("editions")
    .select("work_id")
    .or(isbn10 ? `isbn_13.eq.${isbn13},isbn_10.eq.${isbn10}` : `isbn_13.eq.${isbn13}`)
    .limit(1)
    .maybeSingle();
  return data?.work_id ?? null;
}

/**
 * The Booksyde work id for a Goodreads row, adding the book from Open Library
 * if we don't hold it yet. Null when no confident match turns up.
 */
export async function resolveGoodreadsBook(book: GoodreadsBook): Promise<string | null> {
  const title = goodreadsSearchTitle(book.title);

  if (book.isbn13) {
    const id = await byIsbn(book.isbn13);
    if (id) return id;
  }

  const held = await findCatalogueMatch(title, book.author);
  if (held) return held.id;

  // Open Library by ISBN first (exact), then by title + author (must match on both).
  if (book.isbn13) {
    const [hit] = await searchOpenLibrary(book.isbn13, 1, userAgent);
    if (hit) return importOpenLibraryWork(hit.olid);
  }
  const identity = bookIdentity(title, book.author);
  const hits = await searchOpenLibrary(book.author ? `${title} ${book.author}` : title, 5, userAgent);
  const hit = hits.find((b) => bookIdentity(b.title, b.authors[0]?.name) === identity);
  return hit ? importOpenLibraryWork(hit.olid) : null;
}
