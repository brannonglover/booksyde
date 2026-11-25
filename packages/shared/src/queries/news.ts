import type { Database } from "@booksyde/types";
import type { BooksydeClient } from "../client";

/*
 * "This week in books": bestseller-list moves for everyone, and new releases
 * from the reader's own authors (see the news migration and the web's daily
 * job). Both apps read the feed straight from Supabase.
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
 * The badge and the line under the title. Releases are worded from their date
 * on the day they're read, so a "Coming Jan 14" book reads "Out Jan 14" once it is.
 */
export function describeNews(item: NewsItem, now = new Date()): { badge: string; line: string } {
  if (item.kind === "release" && item.happens_at) {
    const out = new Date(item.happens_at).getTime() <= now.getTime();
    return { badge: out ? "Out now" : "Coming soon", line: `${out ? "Out" : "Coming"} ${dateLabel(item.happens_at, now)}` };
  }
  return { badge: item.label ?? "", line: item.headline };
}

/** Where a story leads: our book page, a search for a book we don't hold yet, or the story itself elsewhere. */
export function newsTarget(item: NewsItem): { workId: string } | { search: string } | { url: string } {
  if (item.work_id) return { workId: item.work_id };
  if (item.url) return { url: item.url };
  return { search: `${item.title ?? ""} ${item.author_name ?? ""}`.trim() };
}
