import "server-only";

import type { FeaturedBook } from "@booksyde/shared";
import { cacheLife, cacheTag } from "next/cache";

/*
 * The New York Times Best Sellers list (combined print & e-book fiction), for
 * the home page's pick of the day while Booksyde has too few readers for its
 * own "most shelved" to mean anything. Needs NYT_BOOKS_API_KEY; without it,
 * or if the API is down, callers get null and fall back to the classics.
 */

const LIST = "combined-print-and-e-book-fiction";
/** How far down the list the daily pick rotates. */
const TOP = 10;

type NytBook = {
  rank: number;
  title: string;
  author: string;
  book_image: string | null;
  primary_isbn13: string | null;
};

export type Bestseller = { title: string; author: string; coverUrl: string; isbn13: string | null };

/** The current list, top first. The list changes weekly; a few hours' cache keeps well inside the API's limits. */
export async function getBestsellers(): Promise<Bestseller[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("bestsellers");
  const key = process.env.NYT_BOOKS_API_KEY;
  if (!key) return [];
  const res = await fetch(`https://api.nytimes.com/svc/books/v3/lists/current/${LIST}.json?api-key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`NYT Books API: ${res.status}`);
  const json = (await res.json()) as { results?: { books?: NytBook[] } };
  return (json.results?.books ?? [])
    .filter((b) => b.book_image)
    .sort((a, b) => a.rank - b.rank)
    .map((b) => ({
      title: titleCase(b.title),
      author: b.author,
      coverUrl: b.book_image!,
      isbn13: b.primary_isbn13 || null,
    }));
}

/** One of the top books, a different one each day. */
export async function bestsellerOfTheDay(day: number): Promise<Bestseller | null> {
  const books = (await getBestsellers()).slice(0, TOP);
  return books.length ? books[day % books.length] : null;
}

/** As a featured book, for when it isn't in the catalogue (no id, so the hero links to search). */
export function bestsellerAsFeatured(book: Bestseller): FeaturedBook {
  return {
    id: "",
    title: book.title,
    author: book.author,
    year: null,
    cover_url: book.coverUrl,
    cover_color: null,
    backdrop_style: null,
    tags: [],
  };
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "with"]);

/** NYT titles come in capitals: "THE HOUSE OF THE SPIRITS" → "The House of the Spirits". */
function titleCase(title: string) {
  const words = title.toLowerCase().split(/\s+/);
  return words
    .map((word, i) => {
      const startsPhrase = i === 0 || i === words.length - 1 || words[i - 1].endsWith(":");
      if (!startsPhrase && SMALL_WORDS.has(word)) return word;
      // Capitalise after hyphens too ("Twenty-One"), but not after apostrophes ("Don't").
      return word.replace(/(^|-)(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
    })
    .join(" ");
}
