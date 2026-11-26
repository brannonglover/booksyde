import "server-only";

import {
  createBooksydeClient,
  getGoogleBooksEnglishVolumes,
  getOpenLibraryAuthor,
  NOT_A_BOOK,
  searchOpenLibraryBooks,
  titleKey,
} from "@booksyde/shared";
import { findAuthorPortrait } from "./author-portrait";
import { importOpenLibraryWork, userAgent } from "./open-library-import";
import { supabaseUrl } from "./supabase/env";

/*
 * The daily author job (/api/cron/authors): for the authors readers have on
 * their shelves or follow, never-checked first and then longest-ago,
 *
 * - a portrait for those who have none: Open Library's if it has one now,
 *   otherwise a freely licensed one from Wikimedia Commons, credited (see
 *   author-portrait.ts);
 * - the rest of their books: what Open Library lists with them as lead
 *   author that we don't hold yet, imported the way a search would import it.
 *   Books only reach the catalogue when a reader searches for them, so
 *   without this an author page shows just the one or two that readers
 *   happened to find.
 *
 * Open Library's languages can't be trusted (self-published translations come
 * through as English, or with no language), so a book is only added when
 * Google Books also has it in English under the author's name, by ISBN or
 * title. That needs GOOGLE_BOOKS_API_KEY; without it, only portraits are done.
 * Bundles, box sets, audio editions, placeholder titles ("Fae and Alchemy #2")
 * and anthologies where they're one name among several are left out.
 *
 * An author counts as checked only once all their books are in, so one cut
 * short by the time limit, Open Library or Google's quota is first in line
 * next run. It runs before the cover job, which can use up the Google quota.
 */

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
export const canRefreshAuthors = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: only for author and catalogue writes whose data came from Open Library and Wikimedia. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Db = ReturnType<typeof adminClient>;
type Author = { author_id: string; name: string; open_library_id: string | null; photo_url: string | null };

/** Authors looked at per run; at the platform's time limit, the rest wait for tomorrow. */
const AUTHORS_PER_RUN = 40;
/** Open Library refuses bursts, so two authors at a time, one book after another within each. */
const CONCURRENCY = 2;
/** The most books one author gets in a run; a prolific one carries on the next time round. */
const BOOKS_PER_AUTHOR = 40;
/** Series placeholders for books not yet titled: "Fae and Alchemy #2", "Fae and Alchemy 3", "Septimus Heap, Book Three". */
const PLACEHOLDER = /#\s?\d+$|\b(book|volume|vol\.|part)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)$|\s\d$/i;
/** Whether an error from Google means "slow down" or "no more today" (rate limit or quota). */
const isQuota = (e: unknown) => /\((429|403)\)/.test(String(e));
/** "J.K. Rowling" and "J. K. Rowling" are the same person. */
const nameKey = (name: string) => name.normalize("NFD").toLowerCase().replace(/[^\p{L}]/gu, "");

export type AuthorRunResult = {
  authors: number;
  photos: number;
  books: number;
  unfinished: number;
  failed: number;
  stoppedBy: string | null;
};

/** The books Open Library lists for an author that we should hold and don't, best known first. */
async function missingBooks(db: Db, author: Author & { open_library_id: string }, googleKey: string) {
  const listed = await searchOpenLibraryBooks(
    { q: `author_key:${author.open_library_id}`, sort: "editions", limit: "100" },
    { ...userAgent, cache: "no-store" },
  );
  const titles = new Set(listed.map((b) => titleKey(b.title)));
  const books = listed.filter(
    (b) =>
      b.authors[0]?.olid === author.open_library_id &&
      // English, or not recorded: many books catalogued from a single record carry no language.
      (b.languages.length === 0 || b.languages.includes("eng")) &&
      !NOT_A_BOOK.test(b.title) &&
      !PLACEHOLDER.test(b.title.split(/[:;(]/)[0].trim()) &&
      // Two of their books in one ("Burn & Fallen"), when either is listed on its own.
      !b.title.split(/\s+(?:&|and)\s+/).some((part, _, parts) => parts.length > 1 && titles.has(titleKey(part))) &&
      (b.isbns.length > 0 || b.coverId),
  );
  if (!books.length) return [];

  // What Google Books has of theirs in English; a book has to be among it.
  const english = (await getGoogleBooksEnglishVolumes(author.name, googleKey, { cache: "no-store" })).filter((v) =>
    v.authors.some((a) => nameKey(a) === nameKey(author.name)),
  );
  const englishIsbns = new Set(english.flatMap((v) => v.isbns));
  const englishTitles = new Set(english.map((v) => titleKey(v.title)));
  const inEnglish = (b: (typeof books)[number]) => englishTitles.has(titleKey(b.title)) || b.isbns.some((i) => englishIsbns.has(i));

  const [{ data: credits }, { data: byOl }] = await Promise.all([
    db.from("work_contributors").select("works ( title )").eq("author_id", author.author_id).eq("role", "author"),
    db.from("works").select("open_library_id").in("open_library_id", books.map((b) => b.olid)),
  ]);
  const heldTitles = new Set((credits ?? []).flatMap((c) => (c.works ? [titleKey(c.works.title)] : [])));
  const heldIds = new Set((byOl ?? []).map((w) => w.open_library_id));
  // Open Library often files one book twice ("Brimstone" and "Brimstone"); one is enough.
  const seen = new Set<string>();
  return books.filter((b) => {
    const key = titleKey(b.title);
    if (heldIds.has(b.olid) || heldTitles.has(key) || seen.has(key) || !inEnglish(b)) return false;
    seen.add(key);
    return true;
  });
}

/** A portrait for an author who has none, or null. Open Library's first: it needs no credit. */
async function findPortrait(author: Author) {
  const ol = author.open_library_id ? await getOpenLibraryAuthor(author.open_library_id, { ...userAgent, cache: "no-store" }) : null;
  if (ol?.photoUrl) return { photo_url: ol.photoUrl, photo_credit: null, photo_credit_url: null };
  const commons = await findAuthorPortrait(author.name, author.open_library_id);
  return commons ? { photo_url: commons.url, photo_credit: commons.credit, photo_credit_url: commons.creditUrl } : null;
}

async function authorsById(db: Db, ids: string[]): Promise<Author[]> {
  const { data, error } = await db.from("authors").select("id, name, open_library_id, photo_url").in("id", ids);
  if (error) throw error;
  return data.map(({ id, ...a }) => ({ author_id: id, ...a }));
}

/**
 * One run of the job. `authorIds` checks just those authors (for a one-off
 * fix); `photos: false` leaves portraits alone; `apply: false` reports what it
 * would do without writing anything.
 */
export async function refreshAuthors({
  budgetMs = 240_000,
  limit = AUTHORS_PER_RUN,
  authorIds,
  photos = true,
  apply = true,
  googleKey = process.env.GOOGLE_BOOKS_API_KEY,
  log = () => {},
}: {
  budgetMs?: number;
  limit?: number;
  authorIds?: string[];
  photos?: boolean;
  apply?: boolean;
  googleKey?: string;
  log?: (line: string) => void;
} = {}): Promise<AuthorRunResult> {
  const db = adminClient();
  const deadline = Date.now() + budgetMs;
  const result: AuthorRunResult = { authors: 0, photos: 0, books: 0, unfinished: 0, failed: 0, stoppedBy: null };
  const going = () => {
    if (Date.now() >= deadline) result.stoppedBy ??= "time limit";
    return !result.stoppedBy;
  };

  if (!googleKey) log("No GOOGLE_BOOKS_API_KEY: portraits only; books wait for a run that has one.");

  const authors: Author[] = authorIds?.length
    ? await authorsById(db, authorIds)
    : await db.rpc("authors_to_refresh", { max_results: limit }).then(({ data, error }) => {
        if (error) throw error;
        return data;
      });

  async function check(author: Author) {
    if (photos && !author.photo_url) {
      const portrait = await findPortrait(author).catch((e: unknown) => (console.error(`Authors: portrait for ${author.name} failed`, e), null));
      if (portrait) {
        result.photos++;
        log(`${author.name}: photo ${portrait.photo_url}${portrait.photo_credit ? ` (${portrait.photo_credit})` : ""}`);
        if (apply) {
          const { error } = await db.from("authors").update(portrait).eq("id", author.author_id);
          if (error) throw error;
        }
      }
    }

    let finished = true;
    if (author.open_library_id && !googleKey) finished = false;
    else if (author.open_library_id && googleKey) {
      const missing = await missingBooks(db, { ...author, open_library_id: author.open_library_id }, googleKey).catch((e: unknown) => {
        // Out of Google quota: stop here, and everyone left waits for tomorrow.
        if (isQuota(e)) result.stoppedBy ??= "Google quota";
        throw e;
      });
      if (missing.length > BOOKS_PER_AUTHOR) finished = false;
      for (const book of missing.slice(0, BOOKS_PER_AUTHOR)) {
        if (!going()) {
          finished = false;
          break;
        }
        if (!apply) {
          log(`${author.name}: would add "${book.title}" (${book.year ?? "?"}, ${book.olid})`);
          result.books++;
          continue;
        }
        const workId = await importOpenLibraryWork(book.olid).catch((e: unknown) => {
          console.error(`Authors: importing ${book.olid} for ${author.name} failed`, e);
          return null;
        });
        // Open Library busy or the book unreadable: try the author again another day.
        if (!workId) {
          finished = false;
          continue;
        }
        result.books++;
        log(`${author.name}: filed "${book.title}" (${book.olid})`);
      }
    }

    if (!finished) result.unfinished++;
    else if (apply) {
      const { error } = await db.from("authors").update({ catalogue_checked_at: new Date().toISOString() }).eq("id", author.author_id);
      if (error) throw error;
    }
    result.authors++;
  }

  const queue = [...authors];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let a = queue.shift(); a && going(); a = queue.shift()) {
        // Left unchecked, so it's first in line next run.
        await check(a).catch((e: unknown) => (result.failed++, console.error(`Authors: ${a.name} failed`, e)));
      }
    }),
  );
  return result;
}
