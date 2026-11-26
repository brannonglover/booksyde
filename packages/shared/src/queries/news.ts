import type { Database } from "@booksyde/types";
import type { BooksydeClient } from "../client";

/*
 * "This week in books": bestseller-list moves, prizes and screen adaptations
 * for everyone, and news and new releases from the reader's own authors (see
 * the news migrations and the web's daily job). Both apps read the feed
 * straight from Supabase.
 */

export type NewsItem = Database["public"]["Functions"]["news_feed"]["Returns"][number];

/** Current stories, the reader's own first. Empty if the feed can't be read (e.g. before the migration runs). */
export async function getNewsFeed(client: BooksydeClient, limit = 12): Promise<NewsItem[]> {
  const { data, error } = await client.rpc("news_feed", { max_results: limit });
  if (error) {
    console.warn("News feed unavailable", error.message);
    return [];
  }
  return data ?? [];
}

function dateLabel(iso: string, now: Date) {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/**
 * How a card words a story: its badge, its title, the line under the title,
 * and what its cover is of (for the cover's alt text).
 *
 * Releases are worded from their date on the day they're read, so a "Coming
 * Jan 14" book reads "Out Jan 14" once it is. A headline is its own title, with
 * its date beneath; its cover is one of the author's books, not the article's.
 */
export function describeNews(
  item: NewsItem,
  now = new Date(),
): { badge: string; title: string; line: string; coverTitle: string } {
  const title = item.title ?? item.headline;
  if (item.kind === "release" && item.happens_at) {
    const out = new Date(item.happens_at).getTime() <= now.getTime();
    return { badge: out ? "Out now" : "Coming soon", title, line: `${out ? "Out" : "Coming"} ${dateLabel(item.happens_at, now)}`, coverTitle: title };
  }
  if (item.kind === "adaptation" && item.happens_at && new Date(item.happens_at).getTime() <= now.getTime()) {
    // Worded by the daily job, which may not have run since it came out.
    const line = item.headline.replace(/ comes out /, " came out ").replace(/ starts /, " started ");
    return { badge: item.label ?? "On screen", title, line, coverTitle: title };
  }
  if (item.kind === "award" && !item.work_id && !item.author_name) {
    // A prize for an author's work as a whole: the author is the title, and the cover is one of their books.
    return { badge: item.label ?? "", title, line: item.headline, coverTitle: `a book by ${title}` };
  }
  if (item.kind === "article") {
    const line = item.happens_at ? `Published ${dateLabel(item.happens_at, now)}` : "";
    return { badge: item.label ?? "In the news", title: item.headline, line, coverTitle: "a book" };
  }
  return { badge: item.label ?? "", title, line: item.headline, coverTitle: title };
}

const SHELF_TAGS: Record<NonNullable<NewsItem["shelf_status"]>, string> = {
  want_to_read: "On your Want to read shelf",
  reading: "You’re reading this",
  read: "You’ve read this",
  did_not_finish: "You set this down",
};

/**
 * The pill saying how a story touches the reader: which shelf the book is on,
 * or, for a book they don't have, that it's by an author they read. Null for
 * stories that aren't theirs (and for visitors).
 */
export function newsShelfTag(item: NewsItem): { text: string; onShelf: boolean } | null {
  if (item.shelf_status) return { text: SHELF_TAGS[item.shelf_status], onShelf: true };
  if (item.for_you) return { text: "An author you read", onShelf: false };
  return null;
}

/** Where a story leads: our book page, a search for a book we don't hold yet, or the story itself elsewhere. */
export function newsTarget(item: NewsItem): { workId: string } | { search: string } | { url: string } {
  if (item.work_id) return { workId: item.work_id };
  if (item.url) return { url: item.url };
  return { search: `${item.title ?? ""} ${item.author_name ?? ""}`.trim() };
}
