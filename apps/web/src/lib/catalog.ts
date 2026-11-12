import "server-only";

import {
  createBooksydeClient,
  getMoreLikeThis,
  getRatingDistribution,
  getShelfCounts,
  getWork,
  getWorkReviews,
  getTagDrawers,
  searchAuthors,
  searchCatalog,
  searchOpenLibrary,
  searchReaders,
} from "@booksyde/shared";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "./supabase/env";

/*
 * Public catalog reads. They use a cookie-less client (what any visitor can
 * see), so results can be cached and shared between visitors. Anything
 * personal (your shelf status) is fetched in the browser instead.
 */

function publicClient() {
  return createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The work with authors, editions and tags; null if there's no such book. */
export async function getBook(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`work:${id}`);
  if (!UUID.test(id)) return null;
  return getWork(publicClient(), id);
}

/** Ratings, reviews and shelf counts change more often than the book itself. */
export async function getBookCommunity(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`work:${id}`, `work:${id}:community`);
  const client = publicClient();
  const [distribution, reviews, shelves] = await Promise.all([
    getRatingDistribution(client, id),
    getWorkReviews(client, id, 6),
    getShelfCounts(client, id),
  ]);
  return { distribution, reviews, shelves };
}

export async function getSimilarBooks(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`work:${id}`);
  return getMoreLikeThis(publicClient(), id, 6);
}

const TAG = /^[a-z0-9-]{1,40}$/;

/** Read `?q=…&tags=a,b` into a clean query (at most 5 well-formed tag slugs). */
export function parseSearch(params: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = first(params.q).trim().slice(0, 120);
  const tags = [
    ...new Set(
      first(params.tags)
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => TAG.test(t)),
    ),
  ].slice(0, 5);
  return { q, tags };
}

/** Books, authors and readers for a catalogue search. */
export async function searchEverything(q: string, tags: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog-search");
  const client = publicClient();
  const [books, authors, readers] = await Promise.all([
    searchCatalog(client, { q, tags, limit: 40 }),
    q ? searchAuthors(client, q) : [],
    q ? searchReaders(client, q) : [],
  ]);
  return { books, authors, readers };
}

/** The subject drawers (moods, genres, tropes…) and how full each one is. */
export async function getDrawers() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog-drawers");
  return getTagDrawers(publicClient());
}

/**
 * Open Library matches for a query ("the wider stacks"), each with its
 * Booksyde id when we already hold that work.
 */
export async function searchWiderStacks(q: string) {
  "use cache";
  cacheLife("hours");
  const books = await searchOpenLibrary(q, 9, { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } }).catch(
    () => null,
  );
  if (!books) return null;
  const { data } = await publicClient()
    .from("works")
    .select("id, open_library_id")
    .in(
      "open_library_id",
      books.map((b) => b.olid),
    );
  const onFile = new Map((data ?? []).map((w) => [w.open_library_id, w.id]));
  return books.map((b) => ({ ...b, workId: onFile.get(b.olid) ?? null }));
}

export type WiderStacksBook = NonNullable<Awaited<ReturnType<typeof searchWiderStacks>>>[number];
