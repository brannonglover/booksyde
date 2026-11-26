import "server-only";

import {
  christmasOfTheDay,
  FEEL_GOOD_HOLIDAY_PICKS,
  getOpenLibraryBook,
  getTrendingChristmasBooks,
  openLibraryAsFeatured,
  type SeasonPick,
  type SeasonPicks,
} from "@booksyde/shared";
import { cacheLife, cacheTag } from "next/cache";
import { bestsellerAsFeatured, getBestsellers } from "./bestsellers";
import { getFeaturedBook, inCatalogue } from "./catalog";

/*
 * December's pair for the home page (see SeasonPicks in @booksyde/shared).
 * Worked out from mid-November to mid-January (server time), so the section is
 * ready whichever time zone a reader's December starts in; the pages
 * themselves show it only while it's December on the reader's clock.
 */

/** Whether the picks are worth fetching today: November, December or January. */
function nearDecember(now = new Date()) {
  return [10, 11, 0].includes(now.getUTCMonth());
}

const same = (a: string, b?: string | null) => a.trim().toLowerCase() === b?.trim().toLowerCase();

export async function getSeasonPicks(): Promise<SeasonPicks | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("season-picks");
  if (!nearDecember()) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  // Don't repeat the hero's pick of the day beside it.
  const hero = await getFeaturedBook().catch(() => null);

  const [bestseller, christmas] = await Promise.all([pickBestseller(hero?.title), pickChristmas(day, hero?.title)]);
  // Never the same book twice, should a Christmas book top the list.
  const christmasPick = christmas && bestseller && same(christmas.title, bestseller.title) ? null : christmas;
  if (!bestseller && !christmasPick) return null;
  return { bestseller, christmas: christmasPick };
}

/** The top of this week's list, or the next one down if that's already the hero. */
async function pickBestseller(skipTitle?: string): Promise<SeasonPick | null> {
  const list = await getBestsellers().catch(() => []);
  const book = list.find((b) => !same(b.title, skipTitle));
  if (!book) return null;
  const featured = await inCatalogue(bestsellerAsFeatured(book), book.isbn13 ? [book.isbn13] : []);
  return {
    ...featured,
    kind: "bestseller",
    note: book.rank === 1 ? "No. 1 New York Times bestseller" : `No. ${book.rank} on the New York Times list`,
  };
}

/** A Christmas book readers are shelving now; failing that, a feel-good holiday favorite. */
async function pickChristmas(day: number, skipTitle?: string): Promise<SeasonPick | null> {
  const trending = await getTrendingChristmasBooks().catch(() => []);
  const book = christmasOfTheDay(trending, day, skipTitle);
  if (book) {
    // Open Library's work cover can be any language's edition; ask for the best English one.
    const english = await getOpenLibraryBook(book.olid).catch(() => null);
    const withCover = english?.coverId ? { ...book, coverId: english.coverId } : book;
    const featured = await inCatalogue(openLibraryAsFeatured(withCover), book.isbns);
    return { ...featured, kind: "christmas", note: "Trending this Christmas" };
  }
  const favorite = christmasOfTheDay(FEEL_GOOD_HOLIDAY_PICKS, day, skipTitle);
  return favorite ? { ...(await inCatalogue(favorite)), kind: "christmas", note: "A feel-good holiday read" } : null;
}
