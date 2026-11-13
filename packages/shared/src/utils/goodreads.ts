import type { ReadingStatus } from "@booksyde/types";
import { z } from "zod";
import { parseCsvRecords } from "./csv";
import { isValidIsbn13, isbn10To13, normalizeIsbn } from "./isbn";

/*
 * Goodreads lets readers export their library as CSV (My Books → Import and
 * export → Export library). This turns that file into rows we can match
 * against the catalogue and shelve. Parsing happens in the browser; the
 * server re-validates every row with `goodreadsBookSchema`.
 */

export const goodreadsBookSchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(200).nullable(),
  isbn13: z.string().regex(/^[0-9]{13}$/).nullable(),
  status: z.enum(["want_to_read", "reading", "read", "did_not_finish"]),
  /** ISO dates (YYYY-MM-DD). */
  finishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  addedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string().max(20000).nullable(),
  hasSpoilers: z.boolean(),
  /** Custom shelves (not the read / reading / to-read ones). */
  shelves: z.array(z.string().trim().min(1).max(60)).max(30),
});

export type GoodreadsBook = z.infer<typeof goodreadsBookSchema>;

/** Rows per import request: small enough for steady progress and comfortably inside time limits. */
export const GOODREADS_BATCH_SIZE = 10;

export const goodreadsBatchSchema = z.object({
  books: z.array(goodreadsBookSchema).min(1).max(GOODREADS_BATCH_SIZE),
  includeReviews: z.boolean(),
});

export class NotAGoodreadsExportError extends Error {
  constructor() {
    super("That doesn’t look like a Goodreads library export.");
  }
}

const STATUS_SHELVES: Record<string, ReadingStatus> = {
  read: "read",
  "currently-reading": "reading",
  "to-read": "want_to_read",
};
const DNF_SHELF = /\b(dnf|did[\s-]*not[\s-]*finish|abandon(ed)?|gave[\s-]*up|unfinished|not[\s-]*finished)\b/i;

/** Goodreads wraps ISBNs as ="0439023483" so spreadsheets keep the zeros. */
function isbn13Of(isbn13: string, isbn10: string): string | null {
  const thirteen = normalizeIsbn(isbn13);
  if (thirteen.length === 13 && isValidIsbn13(thirteen)) return thirteen;
  return isbn10To13(isbn10);
}

/** "2023/05/14" → "2023-05-14"; anything else → null. */
function dateOf(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Goodreads reviews are light HTML; keep the words and paragraph breaks. */
function reviewText(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?spoiler>|\[\/?spoiler\]/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
      if (name in entities) return entities[name];
      if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
      return whole;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, 20000) : null;
}

function toBook(r: Record<string, string>): GoodreadsBook | null {
  const title = r["Title"]?.trim();
  if (!title) return null;

  const exclusive = (r["Exclusive Shelf"] ?? "").trim().toLowerCase();
  const finishedOn = dateOf(r["Date Read"] ?? "");
  const status: ReadingStatus =
    STATUS_SHELVES[exclusive] ?? (DNF_SHELF.test(exclusive) ? "did_not_finish" : finishedOn ? "read" : "want_to_read");

  const shelves = (r["Bookshelves"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !(s.toLowerCase() in STATUS_SHELVES) && s.toLowerCase() !== exclusive);
  // A custom exclusive shelf ("dnf", "owned-unread") is worth keeping as a shelf too.
  if (exclusive && !(exclusive in STATUS_SHELVES)) shelves.unshift(exclusive);

  const rating = Number.parseInt(r["My Rating"] ?? "", 10);
  const rawReview = r["My Review"] ?? "";

  return {
    title: title.slice(0, 500),
    author: (r["Author"] ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null,
    isbn13: isbn13Of(r["ISBN13"] ?? "", r["ISBN"] ?? ""),
    status,
    finishedOn: status === "read" ? finishedOn : null,
    addedOn: dateOf(r["Date Added"] ?? ""),
    rating: rating >= 1 && rating <= 5 ? rating : null,
    review: reviewText(rawReview),
    hasSpoilers: /^true$/i.test((r["Spoiler"] ?? "").trim()) || /<spoiler>|\[spoiler\]/i.test(rawReview),
    shelves: [...new Set(shelves.map((s) => s.slice(0, 60)))].slice(0, 30),
  };
}

/** Parse a Goodreads library export. Throws NotAGoodreadsExportError for other files. */
export function parseGoodreadsExport(csv: string): GoodreadsBook[] {
  const records = parseCsvRecords(csv);
  const first = records[0];
  if (!first || !("Title" in first) || !("Exclusive Shelf" in first)) throw new NotAGoodreadsExportError();
  return records.map(toBook).filter((b): b is GoodreadsBook => b !== null);
}

/** "The Hunger Games (The Hunger Games, #1)" → "The Hunger Games". */
export function goodreadsSearchTitle(title: string) {
  return title.replace(/\s*\([^()]*#\s*[\d.]+\)\s*$/, "").trim() || title;
}
