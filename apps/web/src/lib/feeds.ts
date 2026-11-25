import "server-only";

/*
 * Book news from literary outlets' RSS feeds, for author headlines in "This
 * week in books". Every feed here covers books only, so an author's full name
 * in a story almost always means the story is about that author. We keep the
 * headline, link, date and outlet; the story itself stays on their site.
 */

export const BOOK_FEEDS = [
  { source: "The Guardian", url: "https://www.theguardian.com/books/rss" },
  { source: "Literary Hub", url: "https://lithub.com/feed/" },
  { source: "Book Riot", url: "https://bookriot.com/feed/" },
  { source: "Publishers Weekly", url: "https://www.publishersweekly.com/pw/feeds/recent/index.xml" },
] as const;

export type FeedArticle = {
  source: string;
  title: string;
  url: string;
  /** The start of the outlet's summary, as plain text, for matching only (never shown or stored). */
  summary: string;
  publishedAt: Date;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

/** Feed text as plain text: CDATA unwrapped, tags dropped, entities decoded, whitespace collapsed. */
function plain(raw: string) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
}

function field(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : null;
}

/** The items of an RSS 2.0 feed; anything malformed is skipped rather than guessed at. */
export function parseFeed(xml: string, source: string): FeedArticle[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const title = plain(field(item, "title") ?? "");
    const url = plain(field(item, "link") ?? "");
    const date = new Date(plain(field(item, "pubDate") ?? field(item, "dc:date") ?? ""));
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(date.getTime())) return [];
    const summary = plain(field(item, "description") ?? "").slice(0, 600);
    return [{ source, title, url, summary, publishedAt: date }];
  });
}

/** One feed's articles; empty (and logged) if the outlet is down, so one bad feed never sinks the rest. */
export async function fetchFeed(feed: (typeof BOOK_FEEDS)[number]): Promise<FeedArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), feed.source);
  } catch (e) {
    console.error(`News: ${feed.source} feed failed`, e);
    return [];
  }
}
