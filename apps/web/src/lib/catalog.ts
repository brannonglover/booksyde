import "server-only";

import {
  createBooksydeClient,
  getDiscoverShelves as getDiscoverShelvesFor,
  getFeaturedBook as getFeaturedBookFor,
  type FeaturedBook,
  toFeatured,
  getMoreLikeThis,
  getNightstand,
  getRatingDistribution,
  getSeriesShelf,
  getShelfCounts,
  getWork,
  getWiderStacksPicks as getWiderStacksPicksFor,
  getWorkReviews,
  getBrowseDrawers as getBrowseDrawersFor,
  getMoodTags,
  getTagDrawers,
  getTrendingWorks,
  searchAuthors,
  searchCatalog,
  searchOpenLibrary,
  searchReaders,
} from "@booksyde/shared";
import { cacheLife, cacheTag } from "next/cache";
import { bestsellerAsFeatured, bestsellerOfTheDay } from "./bestsellers";
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

/** The books in a series that we hold, in reading order. Adding a book to the catalogue can add to it. */
export async function getSeriesBooks(seriesId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`series:${seriesId}`, "catalog-search");
  if (!UUID.test(seriesId)) return [];
  return getSeriesShelf(publicClient(), seriesId);
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

/** What readers have open right now, for the home page. Reading shelves move often. */
export async function getNightstandBooks(limit = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag("nightstand");
  return getNightstand(publicClient(), limit);
}

export { toFeatured, type FeaturedBook } from "@booksyde/shared";

/** The home page's pick of the day (see getFeaturedBook in @booksyde/shared). */
export async function getFeaturedBook(): Promise<FeaturedBook | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("featured");
  const client = publicClient();
  return getFeaturedBookFor(client, {
    // Before Booksyde has a crowd: a current bestseller, as its catalogue page when we have it.
    beforeCrowd: async (day) => {
      const pick = await bestsellerOfTheDay(day);
      if (!pick) return null;
      return (await findInCatalogue(pick.isbn13 ? [pick.isbn13] : [])) ?? bestsellerAsFeatured(pick);
    },
  });
}

/** A book we hold with a cover, by any of its ISBN-13s, so a pick can link to its own page; null if we don't. */
export async function findInCatalogue(isbns: string[]): Promise<FeaturedBook | null> {
  if (!isbns.length) return null;
  const { data } = await publicClient().from("editions").select("work_id").in("isbn_13", isbns.slice(0, 40)).limit(1);
  const work = data?.[0] ? await getBook(data[0].work_id) : null;
  return work?.cover_url ? toFeatured(work) : null;
}

/** The most-shelved books, as candidates to try in the hero preview. */
export async function getPreviewCandidates(limit = 16) {
  "use cache";
  cacheLife("hours");
  cacheTag("featured");
  return getTrendingWorks(publicClient(), limit);
}

/** Any book as a featured book, for the hero preview. */
export async function getFeaturedById(id: string): Promise<FeaturedBook | null> {
  const book = await getBook(id);
  return book ? toFeatured(book) : null;
}

export async function getSimilarBooks(id: string, limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag(`work:${id}`);
  return getMoreLikeThis(publicClient(), id, limit);
}

/** The public half of the Discover page (see getDiscoverShelves in @booksyde/shared). */
export async function getDiscoverShelves() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog-drawers", "discover");
  return getDiscoverShelvesFor(publicClient());
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

/** The moods readers can vote for on a book. */
export async function getMoods() {
  "use cache";
  cacheLife("days");
  cacheTag("catalog-drawers");
  return getMoodTags(publicClient());
}

/** The mood and genre drawers with a few covers each, for the browse cards. */
export async function getBrowseDrawers() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog-drawers");
  return getBrowseDrawersFor(publicClient());
}

/**
 * Open Library matches for a query ("the wider stacks"), each with its
 * Booksyde id when we already hold that work; null when Open Library can't
 * be reached. Open Library is often slow or briefly down, so a failed call is
 * tried once more, and a failure is never cached: the next search asks again
 * instead of reporting the stacks closed for hours.
 */
export async function searchWiderStacks(q: string) {
  try {
    return await widerStacksOnFile(q);
  } catch {
    try {
      return await widerStacksOnFile(q);
    } catch (e) {
      console.error("Open Library search failed", q, e);
      return null;
    }
  }
}

/** Throws when Open Library can't be reached, so the failure isn't cached. */
async function widerStacksOnFile(q: string) {
  "use cache";
  cacheLife("minutes");
  // Adding a book invalidates this, so its slip turns into a link straight away.
  cacheTag("catalog-search");
  const books = await openLibraryMatches(q);
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

/** Open Library's answer for a query; slow and rarely changes, so it keeps for hours. Throws (uncached) on failure. */
async function openLibraryMatches(q: string) {
  "use cache";
  cacheLife("hours");
  return searchOpenLibrary(q, 9, { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } }, { skipForgotten: true });
}

/** Open Library picks for a reader who has outgrown our shelves (see @booksyde/shared). */
export async function getWiderStacksPicks(authors: string[], genres: string[]) {
  "use cache";
  cacheLife("hours");
  // Adding a request slip to the catalogue invalidates this, so the slip turns into a link.
  cacheTag("catalog-search");
  return getWiderStacksPicksFor(publicClient(), authors, genres, {
    headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" },
  });
}

export type { WiderStacksBook } from "@booksyde/shared";
