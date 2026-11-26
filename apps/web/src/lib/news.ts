import "server-only";

import {
  type BooksydeClient,
  createBooksydeClient,
  getGoogleBooksByAuthor,
  searchOpenLibraryBooks,
  titleKey,
} from "@booksyde/shared";
import type { Database } from "@booksyde/types";
import { createHash } from "node:crypto";
import { getBestsellerList, type ListEntry, NEWS_LISTS } from "./bestsellers";
import { BOOK_FEEDS, type FeedArticle, fetchFeed } from "./feeds";
import { importOpenLibraryWork, userAgent } from "./open-library-import";
import { supabaseUrl } from "./supabase/env";
import { type Adaptation, getAdaptations, getPrizeNews, type PrizeNews, type WikidataBook } from "./wikidata";

/*
 * The daily news job behind "This week in books" (run by /api/cron/news):
 *
 * - Chart stories: notable moves on this week's New York Times lists (new
 *   entries, No. 1, big climbers, long runs), for everyone.
 * - Release stories: new and forthcoming books by the authors readers have on
 *   their shelves, from Google Books (exact dates, pre-orders) or, without a
 *   key, Open Library (just the year). news_feed() shows each one only to the
 *   readers who shelve that author.
 * - Buzz stories: the books Booksyde readers are picking up, finishing,
 *   reviewing and talking about in clubs this week, once there's a crowd.
 * - Headline stories: articles about the authors readers shelve, from
 *   literary outlets' feeds (see feeds.ts), linking out to the outlet. Like
 *   releases, news_feed() shows each only to readers of that author.
 * - Prize stories: winners and nominees of the major book prizes, and screen
 *   stories: films and series of books coming out soon, both from Wikidata
 *   (see wikidata.ts), for everyone.
 *
 * Rows are upserted by a stable key, so running it twice in a day is harmless.
 */

type NewsInsert = Database["public"]["Tables"]["news_items"]["Insert"];

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
export const canWriteNews = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: only for writing news rows whose data came from the NYT, Google Books or Open Library. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const DAY = 86_400_000;
/** How many authors' releases each run looks up; the rest wait for the next day, longest-waiting first. */
const AUTHORS_PER_RUN = 40;
/** A release counts as news from this long before it's out until this long after. */
const AHEAD_DAYS = 240;
const BEHIND_DAYS = 60;

const JOBS = {
  charts: refreshCharts,
  releases: refreshReleases,
  buzz: refreshBuzz,
  headlines: refreshHeadlines,
  prizes: refreshPrizes,
  adaptations: refreshAdaptations,
} satisfies Record<string, (db: BooksydeClient) => Promise<number>>;

export type NewsJob = keyof typeof JOBS;
/** Stories written by each part, or why it failed. */
export type NewsRunResult = Partial<Record<NewsJob, number | string>>;

/** Runs every part of the job (or just `only`); each reports its own failure, so a Google outage doesn't cost the week's chart stories. */
export async function refreshNews(only: NewsJob[] = Object.keys(JOBS) as NewsJob[]): Promise<NewsRunResult> {
  const db = adminClient();
  const results = await Promise.all(
    only.map(async (name) => [name, await JOBS[name](db).catch((e: unknown) => (console.error(`News: ${name} failed`, e), String(e)))] as const),
  );
  return Object.fromEntries(results);
}

/* ───────────── Bestseller charts ───────────── */

const MILESTONE_WEEKS = new Set([10, 20, 26, 52, 78, 104, 156]);

/** The one thing worth saying about a book's week on the list, or null if it just held its place. */
function chartStory({ rank, rankLastWeek: last, weeksOnList: weeks }: ListEntry) {
  if (rank === 1) {
    if (last === 1) return { label: "No. 1", headline: `Still No. 1, ${weeks} weeks on the list`, weight: 100 };
    if (last === 0 && weeks <= 1) return { label: "No. 1", headline: "Goes straight in at No. 1", weight: 100 };
    return { label: "No. 1", headline: "Takes the No. 1 spot", weight: 100 };
  }
  if (last === 0) {
    return weeks <= 1
      ? { label: "New this week", headline: `New on the list at No. ${rank}`, weight: 80 }
      : { label: "Back on the list", headline: `Back on the list at No. ${rank}`, weight: 60 };
  }
  if (last - rank >= 3) return { label: "Climbing", headline: `Up ${last - rank} places to No. ${rank}`, weight: 50 + Math.min(last - rank, 15) };
  if (MILESTONE_WEEKS.has(weeks)) return { label: "Staying power", headline: `${weeks} weeks on the list`, weight: 40 };
  return null;
}

/** NYT bylines can be "A and B" or "A with B"; the first name is the one we'd hold. */
const leadAuthor = (byline: string) => byline.split(/\s+(?:and|with)\s+|,|&/)[0].trim();

/** Our work and lead author for each list entry (by rank), by ISBN first and the author's exact name second. */
async function matchCatalogue(db: BooksydeClient, books: ListEntry[]) {
  const isbns = [...new Set(books.flatMap((b) => b.isbns))];
  const { data: editions } = isbns.length
    ? await db.from("editions").select("work_id, isbn_13").in("isbn_13", isbns)
    : { data: [] };
  const workByIsbn = new Map((editions ?? []).flatMap((e) => (e.isbn_13 ? [[e.isbn_13, e.work_id] as const] : [])));
  const workIds = [...new Set(workByIsbn.values())];
  const { data: credits } = workIds.length
    ? await db.from("work_contributors").select("work_id, author_id, position").eq("role", "author").in("work_id", workIds).order("position")
    : { data: [] };
  const authorByWork = new Map<string, string>();
  for (const c of credits ?? []) if (!authorByWork.has(c.work_id)) authorByWork.set(c.work_id, c.author_id);

  const names = [...new Set(books.map((b) => leadAuthor(b.author)))];
  const { data: authors } = await db.from("authors").select("id, name").in("name", names);
  // Only a name that means one author; two "John Smith"s and we'd rather not guess.
  const byName = new Map<string, string | null>();
  for (const a of authors ?? []) byName.set(a.name, byName.has(a.name) ? null : a.id);

  return new Map(
    books.map((b) => {
      const workId = b.isbns.map((i) => workByIsbn.get(i)).find(Boolean) ?? null;
      const authorId = (workId && authorByWork.get(workId)) || byName.get(leadAuthor(b.author)) || null;
      return [b.rank, { workId, authorId }] as const;
    }),
  );
}

/** Open Library's work for a list entry: by ISBN, else by title and author, as long as the title agrees. */
async function findOnOpenLibrary(b: ListEntry) {
  const init = { ...userAgent, cache: "no-store" as const, signal: AbortSignal.timeout(15_000) };
  const same = (t: string) => titleKey(t) === titleKey(b.title);
  for (const isbn of b.isbns.slice(0, 2)) {
    const hit = (await searchOpenLibraryBooks({ q: `isbn:${isbn}`, limit: "1" }, init)).find((x) => same(x.title));
    if (hit) return hit.olid;
  }
  return (await searchOpenLibraryBooks({ title: b.title, author: leadAuthor(b.author), limit: "5" }, init)).find((x) => same(x.title))?.olid ?? null;
}

async function addChartBooks(db: BooksydeClient, books: ListEntry[], matched: Map<number, { workId: string | null; authorId: string | null }>) {
  const added: { rank: number; workId: string }[] = [];
  await eachLimited(books, 2, async (b) => {
    try {
      const olid = await findOnOpenLibrary(b);
      const workId = olid ? await importOpenLibraryWork(olid) : null;
      if (workId) added.push({ rank: b.rank, workId });
    } catch (e) {
      console.error(`News: couldn't add "${b.title}" to the catalogue`, e);
    }
  });
  if (!added.length) return;
  const { data: credits } = await db
    .from("work_contributors")
    .select("work_id, author_id, position")
    .eq("role", "author")
    .in("work_id", added.map((a) => a.workId))
    .order("position");
  for (const { rank, workId } of added) {
    const authorId = matched.get(rank)?.authorId ?? credits?.find((c) => c.work_id === workId)?.author_id ?? null;
    matched.set(rank, { workId, authorId });
  }
}

async function refreshCharts(db: BooksydeClient) {
  let stories = 0;
  for (const { list, name } of NEWS_LISTS) {
    const current = await getBestsellerList(list);
    if (!current?.books.length) continue;
    const matched = await matchCatalogue(db, current.books);
    // Books with a story that we don't hold yet come in from Open Library, so the card opens a book page.
    await addChartBooks(db, current.books.filter((b) => chartStory(b) && !matched.get(b.rank)?.workId), matched);

    const { error: snapshotError } = await db.from("bestseller_entries").upsert(
      current.books.map((b) => ({
        list_name: list,
        list_date: current.date,
        rank: b.rank,
        rank_last_week: b.rankLastWeek,
        weeks_on_list: b.weeksOnList,
        title: b.title,
        author: b.author,
        isbn13: b.isbn13,
        cover_url: b.coverUrl || null,
        work_id: matched.get(b.rank)?.workId ?? null,
      })),
      { onConflict: "list_name,list_date,rank" },
    );
    if (snapshotError) throw snapshotError;

    const listDate = new Date(`${current.date}T12:00:00Z`);
    const rows: NewsInsert[] = current.books.flatMap((b) => {
      const story = chartStory(b);
      if (!story) return [];
      const { workId, authorId } = matched.get(b.rank) ?? { workId: null, authorId: null };
      return [
        {
          kind: "chart",
          key: `chart:${list}:${current.date}:${b.isbn13 ?? titleKey(b.title)}`,
          ...story,
          title: b.title,
          author_name: b.author,
          work_id: workId,
          author_id: authorId,
          cover_url: b.coverUrl || null,
          source: `New York Times · ${name}`,
          url: `https://www.nytimes.com/books/best-sellers/${list}/`,
          happens_at: listDate.toISOString(),
          expires_at: new Date(listDate.getTime() + 14 * DAY).toISOString(),
          data: { list, list_date: current.date, rank: b.rank, rank_last_week: b.rankLastWeek, weeks_on_list: b.weeksOnList },
        },
      ];
    });
    if (rows.length) {
      const { error } = await db.from("news_items").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }
    stories += rows.length;

    // Last week's stories from this list make way for this week's.
    const now = new Date().toISOString();
    const { error: expireError } = await db
      .from("news_items")
      .update({ expires_at: now })
      .eq("kind", "chart")
      .like("key", `chart:${list}:%`)
      .not("key", "like", `chart:${list}:${current.date}:%`)
      .gt("expires_at", now);
    if (expireError) throw expireError;
  }
  return stories;
}

/* ───────────── New releases ───────────── */

type WatchedAuthor = Database["public"]["Functions"]["watched_authors"]["Returns"][number];

type Release = {
  title: string;
  isbn13: string | null;
  coverUrl: string | null;
  /** "2026-03-04" from Google Books; null from Open Library, which only knows the year. */
  date: string | null;
  year: number;
};

/** Things filed under an author that aren't a new book of theirs (bundles like "Ward D / The Tenant", and "Untitled…" placeholders, too). */
const NOT_A_NEW_BOOK =
  /\b(summary|study guide|analysis|workbook|box(ed)? set|collection|omnibus|books? \d+\s*[-–&]|trilogy|series|coloring|colouring|journal|calendar|sampler|excerpt|preview|bestsellers)\b|\s\/\s|^untitled\b/i;

/** "J.K. Rowling" and "J. K. Rowling" are the same person. */
const nameKey = (name: string) => name.toLowerCase().replace(/[^\p{L}]/gu, "");

async function googleReleases(author: WatchedAuthor, apiKey: string, now: number): Promise<Release[]> {
  const volumes = await getGoogleBooksByAuthor(author.name, apiKey, { cache: "no-store" });
  const key = nameKey(author.name);
  const byTitle = new Map<string, Release>();
  for (const v of volumes) {
    if (!v.authors.some((a) => nameKey(a) === key) || NOT_A_NEW_BOOK.test(v.title)) continue;
    const at = new Date(`${v.publishedDate}T12:00:00Z`).getTime();
    if (at < now - BEHIND_DAYS * DAY || at > now + AHEAD_DAYS * DAY) continue;
    const k = titleKey(v.title);
    const seen = byTitle.get(k);
    // Editions of one book: keep the first date it's out, and any cover we can get.
    if (!seen || v.publishedDate < seen.date!) {
      byTitle.set(k, {
        title: v.title,
        isbn13: v.isbn13 ?? seen?.isbn13 ?? null,
        coverUrl: v.coverUrl ?? seen?.coverUrl ?? null,
        date: v.publishedDate,
        year: Number(v.publishedDate.slice(0, 4)),
      });
    } else if (!seen.coverUrl && v.coverUrl) {
      seen.coverUrl = v.coverUrl;
    }
  }
  return [...byTitle.values()];
}

async function openLibraryReleases(author: WatchedAuthor, now: number): Promise<Release[]> {
  if (!author.open_library_id) return [];
  const thisYear = new Date(now).getUTCFullYear();
  const books = await searchOpenLibraryBooks(
    { q: `author_key:${author.open_library_id}`, sort: "new", language: "eng", limit: "10" },
    { ...userAgent, cache: "no-store" },
  );
  return books
    .filter((b) => b.year && b.year >= thisYear && b.coverId && b.authors[0]?.olid === author.open_library_id && !NOT_A_NEW_BOOK.test(b.title))
    .map((b) => ({
      title: b.title,
      isbn13: b.isbn13,
      coverUrl: `https://covers.openlibrary.org/b/id/${b.coverId}-L.jpg`,
      date: null,
      year: b.year!,
    }));
}

/**
 * Drops reissues (a new edition of a book the author published years ago, which
 * we hold under its original year) and links the rest to our copy if we have one.
 */
async function againstCatalogue(db: BooksydeClient, authorId: string, releases: Release[], thisYear: number) {
  if (!releases.length) return [];
  const { data } = await db
    .from("work_contributors")
    .select("works ( id, title, first_published_year )")
    .eq("author_id", authorId)
    .eq("role", "author");
  const held = new Map((data ?? []).flatMap((c) => (c.works ? [[titleKey(c.works.title), c.works] as const] : [])));
  return releases.flatMap((r) => {
    const ours = held.get(titleKey(r.title));
    if (ours?.first_published_year && ours.first_published_year < thisYear - 1) return [];
    return [{ ...r, workId: ours?.id ?? null }];
  });
}

const dateLabel = (iso: string, thisYear: number) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(Number(iso.slice(0, 4)) !== thisYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

function releaseRow(author: WatchedAuthor, r: Release & { workId: string | null }, source: string, now: number): NewsInsert {
  const thisYear = new Date(now).getUTCFullYear();
  const at = r.date ? new Date(`${r.date}T12:00:00Z`).getTime() : null;
  const upcoming = at ? at > now : r.year > thisYear;
  return {
    kind: "release",
    key: `release:${author.author_id}:${titleKey(r.title)}`,
    label: upcoming ? "Coming soon" : "Out now",
    headline: r.date ? `${upcoming ? "Coming" : "Out"} ${dateLabel(r.date, thisYear)}` : upcoming ? `Coming in ${r.year}` : `New in ${r.year}`,
    title: r.title,
    author_name: author.name,
    author_id: author.author_id,
    work_id: r.workId,
    cover_url: r.coverUrl,
    source,
    happens_at: at ? new Date(at).toISOString() : null,
    // A month past release for books announced ahead; two months for ones already out; a season for year-only ones.
    expires_at: new Date(at ? Math.max(at + (upcoming ? 30 : BEHIND_DAYS) * DAY, now + DAY) : now + 120 * DAY).toISOString(),
    weight: upcoming ? 65 : 70,
    data: { isbn13: r.isbn13 },
  };
}

/** Runs `fn` over `items`, a few at a time, to stay polite to the APIs. */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  }));
}

async function refreshReleases(db: BooksydeClient) {
  const { data: authors, error } = await db.rpc("watched_authors", { max_results: AUTHORS_PER_RUN });
  if (error) throw error;
  const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
  const source = googleKey ? "Google Books" : "Open Library";
  const now = Date.now();
  const thisYear = new Date(now).getUTCFullYear();
  const rows: NewsInsert[] = [];
  const checked: string[] = [];

  await eachLimited(authors ?? [], 4, async (author) => {
    try {
      const found = googleKey ? await googleReleases(author, googleKey, now) : await openLibraryReleases(author, now);
      for (const r of await againstCatalogue(db, author.author_id, found, thisYear)) rows.push(releaseRow(author, r, source, now));
      checked.push(author.author_id);
    } catch (e) {
      // Left unchecked, so it's first in line tomorrow.
      console.error(`News: releases for ${author.name} failed`, e);
    }
  });

  // Our copy by ISBN, for releases the title match didn't find.
  const isbnOf = (r: NewsInsert) => (r.data as { isbn13?: string | null }).isbn13 ?? null;
  const isbns = rows.filter((r) => !r.work_id).flatMap((r) => isbnOf(r) ?? []);
  if (isbns.length) {
    const { data } = await db.from("editions").select("work_id, isbn_13").in("isbn_13", isbns);
    const byIsbn = new Map((data ?? []).map((e) => [e.isbn_13, e.work_id]));
    for (const r of rows) r.work_id ||= byIsbn.get(isbnOf(r) ?? "") ?? null;
  }

  if (rows.length) {
    // One row per key: Postgres won't update the same row twice in one upsert.
    const unique = [...new Map(rows.map((r) => [r.key, r])).values()];
    const { error: upsertError } = await db.from("news_items").upsert(unique, { onConflict: "key" });
    if (upsertError) throw upsertError;
  }
  if (checked.length) {
    const { error: checkError } = await db.from("authors").update({ releases_checked_at: new Date(now).toISOString() }).in("id", checked);
    if (checkError) throw checkError;
  }
  return rows.length;
}

/* ───────────── Booksyde buzz ───────────── */

type BuzzRow = Database["public"]["Functions"]["buzz_works"]["Returns"][number];

/** A book needs this many different readers active on it to be buzz, so no story points at one person. */
const BUZZ_MIN_READERS = 3;
const BUZZ_DAYS = 7;
const BUZZ_STORIES = 6;

const readers = (n: number) => `${n} ${n === 1 ? "reader" : "readers"}`;

/** What's happening with a book this week, in a line: club talk first, then reviews, then the most common move. */
export function buzzStory(b: BuzzRow) {
  let headline: string;
  if (b.clubs >= 1 && b.club_posts >= 5) {
    headline = `Talked about in ${b.clubs === 1 ? "a club" : `${b.clubs} clubs`} this week`;
  } else if (b.reviewed >= BUZZ_MIN_READERS) {
    headline = `${b.reviewed} new reviews this week`;
  } else {
    const moves = [
      ["started it", b.started],
      ["finished it", b.finished],
      ["added it to their shelves", b.shelved],
    ] as const;
    const [verb, n] = moves.reduce((best, move) => (move[1] > best[1] ? move : best));
    headline = n >= BUZZ_MIN_READERS ? `${readers(n)} ${verb} this week` : `${readers(b.readers)} picked it up this week`;
  }
  return { label: "Booksyde buzz", headline, weight: 70 + Math.min(b.readers, 25) };
}

async function refreshBuzz(db: BooksydeClient) {
  const now = Date.now();
  // Until enough different people read here, "what readers are talking about" would really be one or two shelves.
  const { data: crowd, error: crowdError } = await db.rpc("has_crowd", {});
  if (crowdError) throw crowdError;
  let books: BuzzRow[] = [];
  if (crowd) {
    const { data, error } = await db.rpc("buzz_works", { days: BUZZ_DAYS, min_readers: BUZZ_MIN_READERS, max_results: BUZZ_STORIES });
    if (error) throw error;
    books = data ?? [];
  }

  const workIds = books.map((b) => b.work_id);
  const { data: credits } = workIds.length
    ? await db
        .from("work_contributors")
        .select("work_id, author_id, position, authors ( name )")
        .eq("role", "author")
        .in("work_id", workIds)
        .order("position")
    : { data: [] };
  const lead = new Map<string, { id: string; name: string | null }>();
  for (const c of credits ?? []) if (!lead.has(c.work_id)) lead.set(c.work_id, { id: c.author_id, name: c.authors?.name ?? null });

  const rows: NewsInsert[] = books.map((b) => ({
    kind: "buzz",
    key: `buzz:${b.work_id}`,
    ...buzzStory(b),
    work_id: b.work_id,
    author_id: lead.get(b.work_id)?.id ?? null,
    author_name: lead.get(b.work_id)?.name ?? null,
    source: "Booksyde readers",
    // Fresh each day it's still buzzing; gone two days after it stops.
    published_at: new Date(now).toISOString(),
    expires_at: new Date(now + 2 * DAY).toISOString(),
    data: { ...b },
  }));
  if (rows.length) {
    const { error } = await db.from("news_items").upsert(rows, { onConflict: "key" });
    if (error) throw error;
  }

  // Books that have gone quiet drop out today rather than lingering.
  const iso = new Date(now).toISOString();
  let quiet = db.from("news_items").update({ expires_at: iso }).eq("kind", "buzz").gt("expires_at", iso);
  if (rows.length) quiet = quiet.not("key", "in", `(${rows.map((r) => `"${r.key}"`).join(",")})`);
  const { error: quietError } = await quiet;
  if (quietError) throw quietError;
  return rows.length;
}

/* ───────────── Author headlines ───────────── */

/** How far back a headline counts as news. */
const HEADLINE_DAYS = 14;
/** An item naming more of our authors than this is a roundup, not a story about any of them. */
const MAX_AUTHORS_PER_HEADLINE = 3;

/**
 * Text for name matching: lower case, no accents or punctuation, and runs of
 * initials joined, so "J.K. Rowling", "J. K. Rowling" and "JK Rowling" agree.
 */
export function matchKey(text: string) {
  const words = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out: string[] = [];
  let initials = false; // whether the last word in `out` is a run of single letters
  for (const w of words) {
    if (w.length === 1 && initials) out[out.length - 1] += w;
    else out.push(w);
    initials = w.length === 1;
  }
  return ` ${out.join(" ")} `;
}

/** The authors an article is about: named in its headline, or the only one of ours its summary names. */
export function authorsInArticle<A extends { key: string }>(article: Pick<FeedArticle, "title" | "summary">, authors: A[]): A[] {
  const title = matchKey(article.title);
  const inTitle = authors.filter((a) => title.includes(a.key));
  if (inTitle.length) return inTitle.length <= MAX_AUTHORS_PER_HEADLINE ? inTitle : [];
  const summary = matchKey(article.summary);
  const inSummary = authors.filter((a) => summary.includes(a.key));
  return inSummary.length === 1 ? inSummary : [];
}

/**
 * The book on the card of a story about an author rather than one book: their
 * most-shelved book we hold with a cover. Its cover is the card's, and it's what the cover opens.
 */
async function authorCovers(db: BooksydeClient, authorIds: string[]) {
  const ids = [...new Set(authorIds)];
  const { data: credits } = ids.length
    ? await db.from("work_contributors").select("author_id, works ( id, cover_url, shelved_count )").eq("role", "author").in("author_id", ids)
    : { data: [] };
  const best = new Map<string, { url: string; workId: string; shelved: number }>();
  for (const c of credits ?? []) {
    const w = c.works;
    if (!w?.cover_url) continue;
    const seen = best.get(c.author_id);
    if (!seen || w.shelved_count > seen.shelved) best.set(c.author_id, { url: w.cover_url, workId: w.id, shelved: w.shelved_count });
  }
  return best;
}

async function refreshHeadlines(db: BooksydeClient) {
  const now = Date.now();
  const { data: watched, error } = await db.rpc("watched_authors", { max_results: 200 });
  if (error) throw error;
  // One-word names ("Homer", "Sappho") would match too much; two words or more is a person.
  const authors = (watched ?? [])
    .map((a) => ({ ...a, key: matchKey(a.name) }))
    .filter((a) => a.key.trim().split(" ").length >= 2);
  if (!authors.length) return 0;

  const articles = (await Promise.all(BOOK_FEEDS.map(fetchFeed)))
    .flat()
    .filter((a) => a.publishedAt.getTime() > now - HEADLINE_DAYS * DAY && a.publishedAt.getTime() <= now + DAY);
  const found = articles.flatMap((article) => authorsInArticle(article, authors).map((author) => ({ article, author })));
  if (!found.length) return 0;

  const cover = await authorCovers(db, found.map((f) => f.author.author_id));

  const rows: NewsInsert[] = found.flatMap(({ article, author }) => {
    const book = cover.get(author.author_id);
    const coverUrl = book?.url;
    // Without a cover the card would typeset the headline as if it were a book.
    if (!coverUrl) return [];
    const at = article.publishedAt.toISOString();
    return [
      {
        kind: "article",
        key: `article:${author.author_id}:${createHash("sha1").update(article.url).digest("hex").slice(0, 20)}`,
        label: "In the news",
        headline: article.title,
        title: null,
        author_name: author.name,
        author_id: author.author_id,
        cover_url: coverUrl,
        source: article.source,
        url: article.url,
        happens_at: at,
        published_at: at,
        expires_at: new Date(article.publishedAt.getTime() + HEADLINE_DAYS * DAY).toISOString(),
        weight: 55,
        data: { book_id: book!.workId },
      },
    ];
  });
  const unique = [...new Map(rows.map((r) => [r.key, r])).values()];
  if (unique.length) {
    const { error: upsertError } = await db.from("news_items").upsert(unique, { onConflict: "key" });
    if (upsertError) throw upsertError;
  }
  return unique.length;
}

/* ───────────── Wikidata books, matched to ours ───────────── */

type CatalogueMatch = {
  workId: string | null;
  title: string | null;
  coverUrl: string | null;
  authorId: string | null;
  /** Open Library's work for a book we don't hold, so it can be added. */
  openLibraryId: string | null;
};

const isWorkId = (ol: string | null): ol is string => Boolean(ol && /^OL\d+W$/.test(ol));
const isAuthorId = (ol: string | null): ol is string => Boolean(ol && /^OL\d+A$/.test(ol));

/**
 * Our copy of each book Wikidata named (by Open Library ID, else by its
 * author and title) and our record of its author. A book we don't hold keeps
 * Open Library's cover, so the card still shows the book.
 */
async function matchWikidataBooks(db: BooksydeClient, books: WikidataBook[]): Promise<CatalogueMatch[]> {
  const workOls = [...new Set(books.map((b) => b.openLibraryId).filter(isWorkId))];
  const authorOls = [...new Set(books.map((b) => b.authorOpenLibraryId).filter(isAuthorId))];
  const names = [...new Set(books.flatMap((b) => (b.author ? [b.author] : [])))];
  const [{ data: works }, { data: byOl }, { data: byName }] = await Promise.all([
    workOls.length
      ? db.from("works").select("id, title, cover_url, open_library_id").in("open_library_id", workOls)
      : Promise.resolve({ data: [] as { id: string; title: string; cover_url: string | null; open_library_id: string | null }[] }),
    authorOls.length
      ? db.from("authors").select("id, open_library_id").in("open_library_id", authorOls)
      : Promise.resolve({ data: [] as { id: string; open_library_id: string | null }[] }),
    names.length ? db.from("authors").select("id, name").in("name", names) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const workByOl = new Map((works ?? []).map((w) => [w.open_library_id, w]));
  const authorByOl = new Map((byOl ?? []).map((a) => [a.open_library_id, a.id]));
  // Only a name that means one author; two "John Smith"s and we'd rather not guess.
  const authorByName = new Map<string, string | null>();
  for (const a of byName ?? []) authorByName.set(a.name, authorByName.has(a.name) ? null : a.id);

  const matches = books.map((b): CatalogueMatch => {
    const work = b.openLibraryId ? workByOl.get(b.openLibraryId) : undefined;
    const authorId = (b.authorOpenLibraryId && authorByOl.get(b.authorOpenLibraryId)) || (b.author && authorByName.get(b.author)) || null;
    return {
      workId: work?.id ?? null,
      title: work?.title ?? null,
      coverUrl: work?.cover_url ?? null,
      authorId,
      openLibraryId: isWorkId(b.openLibraryId) ? b.openLibraryId : null,
    };
  });

  // Books we didn't find by ID: the author's book of the same title, if we hold the author.
  const unmatchedAuthors = [...new Set(matches.flatMap((m, i) => (!m.workId && m.authorId && books[i].title ? [m.authorId] : [])))];
  if (unmatchedAuthors.length) {
    const { data: credits } = await db
      .from("work_contributors")
      .select("author_id, works ( id, title, cover_url )")
      .eq("role", "author")
      .in("author_id", unmatchedAuthors);
    const held = new Map((credits ?? []).flatMap((c) => (c.works ? [[`${c.author_id}|${titleKey(c.works.title)}`, c.works] as const] : [])));
    matches.forEach((m, i) => {
      if (m.workId || !m.authorId || !books[i].title) return;
      const w = held.get(`${m.authorId}|${titleKey(books[i].title!)}`);
      if (w) Object.assign(m, { workId: w.id, title: w.title, coverUrl: w.cover_url });
    });
  }

  // Books we hold no copy of (or no cover for): Open Library's cover, from the work Wikidata
  // names, else from a search by title and author (new books often have the cover on another record).
  const cover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
  await eachLimited(
    matches.flatMap((m, i) => (!m.coverUrl && books[i].title ? [i] : [])),
    4,
    async (i) => {
      const book = books[i];
      try {
        if (isWorkId(book.openLibraryId)) {
          const res = await fetch(`https://openlibrary.org/works/${book.openLibraryId}.json`, { ...userAgent, cache: "no-store", signal: AbortSignal.timeout(15_000) });
          const id = res.ok ? ((await res.json()) as { covers?: number[] }).covers?.find((c) => c > 0) : undefined;
          if (id) return void (matches[i].coverUrl = cover(id));
        }
        const found = await searchOpenLibraryBooks(
          { title: book.title!, ...(book.author ? { author: book.author } : {}), limit: "5" },
          { ...userAgent, cache: "no-store", signal: AbortSignal.timeout(15_000) },
        );
        const hit = found.find((b) => b.coverId && titleKey(b.title) === titleKey(book.title!));
        if (hit?.coverId) Object.assign(matches[i], { coverUrl: cover(hit.coverId), openLibraryId: matches[i].openLibraryId ?? hit.olid });
      } catch {
        // No cover; the story waits for another day.
      }
    },
  );
  return matches;
}

/** Brings books we don't hold in from Open Library, so a story's card can open a book page. */
async function addToCatalogue(matches: CatalogueMatch[]) {
  await eachLimited(
    matches.filter((m) => !m.workId && m.openLibraryId),
    2,
    async (m) => {
      try {
        m.workId = await importOpenLibraryWork(m.openLibraryId!);
      } catch (e) {
        console.error(`News: couldn't add ${m.openLibraryId} to the catalogue`, e);
      }
    },
  );
}

/* ───────────── Prizes ───────────── */

/** A dated prize is news for this long after it's given. */
const PRIZE_FRESH_DAYS = 30;
/** How long a prize story stays in the feed. */
const PRIZE_SHOWN_DAYS = 21;

const prizeKey = (p: Pick<PrizeNews, "bookId" | "authorId" | "prizeId" | "year">, won: boolean) =>
  `award:${p.bookId ?? p.authorId}:${p.prizeId}:${p.year}:${won ? "won" : "nominated"}`;

/** "Won the 2026 Booker Prize", "Nominated for a 2026 Goodreads Choice Award". */
export function prizeHeadline(p: Pick<PrizeNews, "prize" | "year" | "won">) {
  const prize = /Awards$/.test(p.prize) ? `a ${p.year} ${p.prize.replace(/Awards$/, "Award")}` : `the ${p.year} ${p.prize}`;
  return `${p.won ? "Won" : "Nominated for"} ${prize}`;
}

async function refreshPrizes(db: BooksydeClient) {
  const now = Date.now();
  const today = new Date(now);
  const iso = (t: number) => new Date(t).toISOString();
  // Last year's prizes still count in January, when Wikidata is catching up on December's.
  const latestYear = today.getUTCFullYear() - (today.getUTCMonth() === 0 ? 1 : 0);
  const prizes = await getPrizeNews(today.getUTCFullYear() - 1);
  if (!prizes.length) return 0;

  // Prizes are written once, when first seen: Wikidata mostly records only the
  // year, so the day we first see one is the closest we get to the day it was given.
  // Ones in the feed now are only touched up (their book, link and cover).
  const { data: have, error } = await db
    .from("news_items")
    .select("key, expires_at")
    .in("key", prizes.map((p) => prizeKey(p, p.won)));
  if (error) throw error;
  const known = new Map((have ?? []).map((r) => [r.key, r.expires_at]));
  const fresh = prizes.filter((p) => !known.has(prizeKey(p, p.won)));
  const showing = prizes.filter((p) => (known.get(prizeKey(p, p.won)) ?? "") > iso(now));
  if (!fresh.length && !showing.length) return 0;
  // On the very first run everything is "first seen", including May's Pulitzers, so only dated prizes count then.
  const { count, error: countError } = await db.from("news_items").select("id", { count: "exact", head: true }).eq("kind", "award");
  if (countError) throw countError;
  const firstRun = !count;

  const all = [...fresh, ...showing];
  const matched = await matchWikidataBooks(db, all);
  const covers = await authorCovers(db, matched.flatMap((m, i) => (!all[i].bookId && m.authorId ? [m.authorId] : [])));
  const shown = (p: PrizeNews, i: number) => {
    const dated = p.date ? new Date(`${p.date}T12:00:00Z`).getTime() : null;
    // Undated, it's news the day it turns up, unless it's an older year Wikidata is only now filling in.
    const news = i >= fresh.length || (dated ? dated > now - PRIZE_FRESH_DAYS * DAY : !firstRun && p.year >= latestYear);
    // A prize for an author's work as a whole has the author as its title, and one of their books as its cover.
    const book = p.bookId ? null : matched[i].authorId ? covers.get(matched[i].authorId!) : undefined;
    const coverUrl = p.bookId ? matched[i].coverUrl : (book?.url ?? null);
    return { dated, news, coverUrl, bookId: book?.workId ?? null };
  };
  // Books in the feed that we don't hold come in from Open Library.
  await addToCatalogue(all.flatMap((p, i) => (p.bookId && shown(p, i).news && shown(p, i).coverUrl ? [matched[i]] : [])));

  const details = (p: PrizeNews, i: number) => {
    const { coverUrl, bookId } = shown(p, i);
    return {
      work_id: matched[i].workId,
      author_id: matched[i].authorId,
      cover_url: coverUrl,
      // The prize's Wikipedia page is where a reader finds out more.
      source: p.prizeUrl ? "Wikipedia" : "Wikidata",
      url: p.prizeUrl,
      data: { prize_id: p.prizeId, prize: p.prize, year: p.year, won: p.won, wikidata: p.bookId ?? p.authorId, book_id: bookId },
    };
  };

  const rows: NewsInsert[] = fresh.flatMap((p, i) => {
    const { dated, news, coverUrl } = shown(p, i);
    // News with nothing to put on the card isn't written yet: tomorrow's run may find a cover.
    if (news && !coverUrl) return [];
    const at = dated && news ? dated : now;
    return [
      {
        kind: "award",
        key: prizeKey(p, p.won),
        label: p.won ? "Prize winner" : "Nominated",
        headline: prizeHeadline(p),
        title: p.bookId ? (matched[i].title ?? p.title) : p.author,
        author_name: p.bookId ? p.author : null,
        ...details(p, i),
        happens_at: dated ? iso(dated) : null,
        published_at: iso(at),
        // Old news: kept (so it isn't news tomorrow) but never shown.
        expires_at: iso(news ? at + PRIZE_SHOWN_DAYS * DAY : now),
        weight: p.won ? 75 : 50,
      },
    ];
  });
  if (rows.length) {
    const { error: insertError } = await db.from("news_items").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
  for (const [j, p] of showing.entries()) {
    const i = fresh.length + j;
    const { cover_url, ...rest } = details(p, i);
    const { error: touchError } = await db
      .from("news_items")
      .update({ ...rest, ...(cover_url ? { cover_url } : {}) })
      .eq("key", prizeKey(p, p.won));
    if (touchError) throw touchError;
  }

  // A nominee that's now won: the win replaces the nomination.
  const superseded = rows.filter((r) => r.key.endsWith(":won")).map((r) => r.key.replace(/:won$/, ":nominated"));
  if (superseded.length) {
    const { error: expireError } = await db.from("news_items").update({ expires_at: iso(now) }).in("key", superseded).gt("expires_at", iso(now));
    if (expireError) throw expireError;
  }
  return rows.filter((r) => r.expires_at! > iso(now)).length;
}

/* ───────────── Screen adaptations ───────────── */

/** A film or series is news from this long before it's out until this long after. */
const SCREEN_AHEAD_DAYS = 45;
const SCREEN_BEHIND_DAYS = 7;

/** "The film comes out Nov 20", or with its own name when it isn't the book's: "The film Ebenezer comes out Nov 12". */
export function screenHeadline(a: Pick<Adaptation, "format" | "screenTitle" | "date">, bookTitle: string, upcoming: boolean, thisYear: number) {
  const named = a.screenTitle && !matchKey(a.screenTitle).includes(matchKey(bookTitle)) ? ` ${a.screenTitle}` : "";
  const verb = a.format === "series" ? (upcoming ? "starts" : "started") : upcoming ? "comes out" : "came out";
  return `The ${a.format}${named} ${verb} ${dateLabel(a.date, thisYear)}`;
}

async function refreshAdaptations(db: BooksydeClient) {
  const now = Date.now();
  const thisYear = new Date(now).getUTCFullYear();
  const found = await getAdaptations(new Date(now - SCREEN_BEHIND_DAYS * DAY), new Date(now + SCREEN_AHEAD_DAYS * DAY));
  const matched = await matchWikidataBooks(db, found);
  await addToCatalogue(matched.filter((m) => m.coverUrl));

  const rows: NewsInsert[] = found.flatMap((a, i) => {
    const m = matched[i];
    if (!m.coverUrl) return [];
    const at = new Date(`${a.date}T12:00:00Z`).getTime();
    const title = m.title ?? a.title!;
    const days = Math.abs(at - now) / DAY;
    return [
      {
        kind: "adaptation",
        key: `adaptation:${a.screenId}:${a.bookId}`,
        label: "On screen",
        headline: screenHeadline(a, title, at > now, thisYear),
        title,
        author_name: a.author,
        work_id: m.workId,
        author_id: m.authorId,
        cover_url: m.coverUrl,
        // The film's Wikipedia page, where there is one, is where a reader finds out more.
        source: a.screenUrl ? "Wikipedia" : "Wikidata",
        url: a.screenUrl,
        happens_at: new Date(at).toISOString(),
        // Rewritten daily while it's in the window (like buzz), nearest release first.
        published_at: new Date(now).toISOString(),
        expires_at: new Date(at + SCREEN_BEHIND_DAYS * DAY).toISOString(),
        weight: 70 - Math.round(Math.min(days, 40) / 2),
        data: { screen_id: a.screenId, screen_title: a.screenTitle, format: a.format, date: a.date, wikidata: a.bookId },
      },
    ];
  });
  const unique = [...new Map(rows.map((r) => [r.key, r])).values()];
  if (unique.length) {
    const { error } = await db.from("news_items").upsert(unique, { onConflict: "key" });
    if (error) throw error;
  }

  // Ones whose date has moved out of the window (or off Wikidata) drop out today; one
  // still listed keeps yesterday's story if today's cover lookup failed.
  const iso = new Date(now).toISOString();
  const listed = found.map((a) => `adaptation:${a.screenId}:${a.bookId}`);
  let gone = db.from("news_items").update({ expires_at: iso }).eq("kind", "adaptation").gt("expires_at", iso);
  if (listed.length) gone = gone.not("key", "in", `(${listed.map((k) => `"${k}"`).join(",")})`);
  const { error: goneError } = await gone;
  if (goneError) throw goneError;
  return unique.length;
}
