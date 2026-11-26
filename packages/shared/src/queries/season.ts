import type { FeaturedBook } from "./featured";
import { type OpenLibraryBook, searchOpenLibraryBooks } from "./open-library";

/*
 * December's home-page pair: a New York Times bestseller and a Christmas book
 * people are reading right now. The web works them out (the bestseller needs
 * its NYT key) and serves them at /api/season-picks for the app.
 */

export type SeasonPick = FeaturedBook & {
  kind: "bestseller" | "christmas";
  /** A short line about why it's here, e.g. "No. 1 on the New York Times list". */
  note: string;
};

export type SeasonPicks = { bestseller: SeasonPick | null; christmas: SeasonPick | null };

/** Subjects that mean a book isn't the warm, feel-good kind we want under the tree. */
const NOT_COZY = /\b(erotic|dark romance|horror|thriller|juvenile|picture book|board book|coloring|activity)/i;
/** A trending book needs at least this many Open Library readers, so one stray shelf doesn't count. */
const MIN_READERS = 3;
/** How many trending books the daily pick rotates through. */
const POOL = 8;

/**
 * Christmas fiction from the last few years that Open Library readers shelve
 * most, minus children's books and anything dark. Empty if there aren't
 * enough good ones (or Open Library is down), so callers can fall back.
 */
export async function getTrendingChristmasBooks(init?: RequestInit): Promise<OpenLibraryBook[]> {
  const year = new Date().getUTCFullYear();
  const books = await searchOpenLibraryBooks(
    {
      q: `subject:christmas subject:fiction -subject:juvenile -subject:"picture books" -subject:"board books" first_publish_year:[${year - 4} TO ${year}]`,
      sort: "readinglog",
      language: "eng",
      limit: "30",
    },
    init,
  );
  const good = books.filter(
    (b) => b.coverId && b.readers >= MIN_READERS && b.authors.length > 0 && !b.subjects.some((s) => NOT_COZY.test(s)),
  );
  return good.length >= 3 ? good.slice(0, POOL) : [];
}

/** An Open Library cover, by cover id. */
const coverUrl = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

type Curated = { title: string; author: string; year: number; coverId: number };

/**
 * When the trending list comes up thin: feel-good, Hallmark-style holiday
 * reads (small towns, snowed-in romances, bookshops at Christmas), then the
 * classic. Built in, so the section is never empty.
 */
export const FEEL_GOOD_HOLIDAY_PICKS: FeaturedBook[] = (
  [
    { title: "In a Holidaze", author: "Christina Lauren", year: 2020, coverId: 10505228 },
    { title: "The Christmas Bookshop", author: "Jenny Colgan", year: 2021, coverId: 12366345 },
    { title: "Lovelight Farms", author: "B.K. Borison", year: 2021, coverId: 15139523 },
    { title: "The Holiday Swap", author: "Maggie Knox", year: 2021, coverId: 11486505 },
    { title: "The Christmas Tree Farm", author: "Laurie Gilmore", year: 2024, coverId: 15126504 },
    { title: "Winter Street", author: "Elin Hilderbrand", year: 2014, coverId: 8994580 },
    { title: "A Christmas Carol", author: "Charles Dickens", year: 1843, coverId: 12875748 },
  ] satisfies Curated[]
).map((b) => ({
  id: "",
  title: b.title,
  author: b.author,
  year: b.year,
  cover_url: coverUrl(b.coverId),
  cover_color: null,
  backdrop_style: null,
  tags: [],
}));

/** An Open Library book as a featured book (no id: see `linkToCatalogue` for finding our copy). */
export function openLibraryAsFeatured(book: OpenLibraryBook): FeaturedBook {
  return {
    id: "",
    title: book.title,
    author: book.authors[0]?.name ?? "",
    year: book.year,
    cover_url: book.coverId ? coverUrl(book.coverId) : null,
    cover_color: null,
    backdrop_style: null,
    tags: [],
  };
}

/** Today's Christmas pick from a list, a different one each day, skipping a title already on the page. */
export function christmasOfTheDay<T extends { title: string }>(books: T[], day: number, skipTitle?: string): T | null {
  const skip = skipTitle?.trim().toLowerCase();
  const pool = books.filter((b) => b.title.trim().toLowerCase() !== skip);
  return pool.length ? pool[day % pool.length] : null;
}
