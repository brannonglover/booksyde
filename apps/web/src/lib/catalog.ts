import "server-only";

import {
  browseOpenLibrary,
  createBooksydeClient,
  getMoreLikeThis,
  getNightstand,
  getRatingDistribution,
  getShelfCounts,
  getWork,
  getWorkReviews,
  openLibrarySubject,
  type OpenLibraryBook,
  getTagDrawers,
  getTrendingWorks,
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

/** What readers have open right now, for the home page. Reading shelves move often. */
export async function getNightstandBooks(limit = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag("nightstand");
  return getNightstand(publicClient(), limit);
}

type Book = NonNullable<Awaited<ReturnType<typeof getWork>>>;

/** A work trimmed to what a featured-book stage needs: cover, byline and backdrop inputs. */
export function toFeatured(book: Book) {
  const author =
    [...book.work_contributors]
      .filter((c) => c.role === "author" && c.authors)
      .sort((a, b) => a.position - b.position)[0]?.authors?.name ?? "";
  return {
    id: book.id,
    title: book.title,
    author,
    year: book.first_published_year,
    cover_url: book.cover_url,
    cover_color: book.cover_color,
    // `*` select: absent until the backdrop_style migration has run, which reads as auto.
    backdrop_style: book.backdrop_style ?? null,
    tags: book.work_tags.flatMap((t) => (t.tags ? [{ slug: t.tags.slug, kind: t.tags.kind, votes: t.votes }] : [])),
  };
}

export type FeaturedBook = ReturnType<typeof toFeatured>;

/** How many of the most-shelved books (with covers) the home page hero rotates through. */
const FEATURED_POOL = 30;

/**
 * The home page's pick of the day: one of the most-shelved books that has a
 * cover, a different one each day. Null when the catalogue is empty.
 */
export async function getFeaturedBook(): Promise<FeaturedBook | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("featured");
  const client = publicClient();
  const { data, error } = await client
    .from("works")
    .select("id")
    .not("cover_url", "is", null)
    .order("shelved_count", { ascending: false })
    .limit(FEATURED_POOL);
  if (error) throw error;
  if (!data?.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const book = await getWork(client, data[day % data.length].id);
  return book ? toFeatured(book) : null;
}

/** The most-shelved books, as candidates to try in the backdrop preview. */
export async function getBackdropCandidates(limit = 16) {
  "use cache";
  cacheLife("hours");
  cacheTag("featured");
  return getTrendingWorks(publicClient(), limit);
}

/** Any book as a featured-book stage, for the backdrop preview. */
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

/**
 * The public half of the Discover page: the most-shelved books, and a shelf
 * for each of the fullest mood (then genre) drawers, with no book on two shelves.
 */
export async function getDiscoverShelves() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog-drawers", "discover");
  const client = publicClient();
  const [trending, drawers] = await Promise.all([getTrendingWorks(client, 12), getTagDrawers(client)]);
  const byFullness = (kind: string) =>
    drawers.filter((d) => d.kind === kind && d.works >= 3).sort((a, b) => b.works - a.works);
  const candidates = [...byFullness("mood"), ...byFullness("genre")].slice(0, 8);
  const filled = await Promise.all(
    candidates.map(async (drawer) => ({ drawer, books: await searchCatalog(client, { tags: [drawer.slug], limit: 18 }) })),
  );
  // Neighbouring drawers overlap a lot (fantasy / young adult), so each book appears on one shelf only.
  const seen = new Set<string>();
  const moods = [];
  for (const { drawer, books } of filled) {
    const fresh = books.filter((b) => !seen.has(b.id)).slice(0, 6);
    if (fresh.length < 3) continue;
    for (const b of fresh) seen.add(b.id);
    moods.push({ drawer, books: fresh });
    if (moods.length === 4) break;
  }
  return { trending, drawers, moods };
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

/**
 * Open Library books for a reader who has outgrown our shelves: the most-read
 * books by their favourite authors (within their genres), and the most-read
 * books in their top genres. Each comes with its Booksyde id when we hold it.
 */
export async function getWiderStacksPicks(authors: string[], genres: string[]) {
  "use cache";
  cacheLife("hours");
  // Adding a request slip to the catalogue invalidates this, so the slip turns into a link.
  cacheTag("catalog-search");
  const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" } };
  const subjects = genres.flatMap((g) => openLibrarySubject(g) ?? []);
  // Open Library's subjects are crowd-tagged; keep adult and off-genre books out unless the reader reads them.
  const notSubjects = ["erotica", ...(genres.includes("romance") ? [] : ["romance"])];
  const [byAuthor, bySubject] = await Promise.all([
    Promise.all(
      authors.map((author) =>
        // Within their genres, so a fantasy author's contemporary romances don't come up.
        browseOpenLibrary({ author, anySubjects: subjects, notSubjects: ["erotica"] }, 10, init).catch(() => []),
      ),
    ),
    subjects.length ? browseOpenLibrary({ subjects: subjects.slice(0, 2), notSubjects }, 30, init).catch(() => []) : [],
  ]);

  const olids = [...new Set([...byAuthor.flat(), ...bySubject].map((b) => b.olid))];
  if (olids.length === 0) return { byAuthor: [], bySubject: [] };
  const { data } = await publicClient().from("works").select("id, open_library_id").in("open_library_id", olids);
  const onFile = new Map((data ?? []).map((w) => [w.open_library_id, w.id]));
  const withId = (b: OpenLibraryBook) => ({ ...b, workId: onFile.get(b.olid) ?? null });
  return { byAuthor: byAuthor.flat().map(withId), bySubject: bySubject.map(withId) };
}

export type WiderStacksBook = OpenLibraryBook & { workId: string | null };
