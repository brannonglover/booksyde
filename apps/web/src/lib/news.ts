import "server-only";

import {
  type BooksydeClient,
  createBooksydeClient,
  getGoogleBooksByAuthor,
  searchOpenLibraryBooks,
  titleKey,
} from "@booksyde/shared";
import type { Database } from "@booksyde/types";
import { getBestsellerList, type ListEntry, NEWS_LISTS } from "./bestsellers";
import { userAgent } from "./open-library-import";
import { supabaseUrl } from "./supabase/env";

/*
 * The daily news job behind "This week in books" (run by /api/cron/news):
 *
 * - Chart stories: notable moves on this week's New York Times lists (new
 *   entries, No. 1, big climbers, long runs), for everyone.
 * - Release stories: new and forthcoming books by the authors readers have on
 *   their shelves, from Google Books (exact dates, pre-orders) or, without a
 *   key, Open Library (just the year). news_feed() shows each one only to the
 *   readers who shelve that author.
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

export type NewsRunResult = { charts: number | string; releases: number | string };

export async function refreshNews(): Promise<NewsRunResult> {
  const db = adminClient();
  // Each half reports its own failure, so a Google outage doesn't cost the week's chart stories.
  const [charts, releases] = await Promise.all([
    refreshCharts(db).catch((e: unknown) => (console.error("News: charts failed", e), String(e))),
    refreshReleases(db).catch((e: unknown) => (console.error("News: releases failed", e), String(e))),
  ]);
  return { charts, releases };
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

async function refreshCharts(db: BooksydeClient) {
  let stories = 0;
  for (const { list, name } of NEWS_LISTS) {
    const current = await getBestsellerList(list);
    if (!current?.books.length) continue;
    const matched = await matchCatalogue(db, current.books);

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

/** Things filed under an author that aren't a new book of theirs (bundles like "Ward D / The Tenant" too). */
const NOT_A_NEW_BOOK =
  /\b(summary|study guide|analysis|workbook|box(ed)? set|collection|omnibus|books? \d+\s*[-–&]|trilogy|series|coloring|colouring|journal|calendar|sampler|excerpt|preview|bestsellers)\b|\s\/\s/i;

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
