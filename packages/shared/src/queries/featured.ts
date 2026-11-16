import type { BooksydeClient } from "../client";
import { getWork } from "./works";

type Book = NonNullable<Awaited<ReturnType<typeof getWork>>>;

/** A work trimmed to what a featured-book stage needs: cover, byline and backdrop inputs. */
export function toFeatured(book: Book) {
  const author =
    [...book.work_contributors]
      .filter((c) => c.role === "author" && c.authors)
      .sort((a, b) => a.position - b.position)[0]?.authors?.name ?? "";
  return {
    id: book.id,
    title: book.title,
    author,
    year: book.first_published_year,
    cover_url: book.cover_url,
    cover_color: book.cover_color,
    // `*` select: absent until the backdrop_style migration has run, which reads as auto.
    backdrop_style: book.backdrop_style ?? null,
    tags: book.work_tags.flatMap((t) => (t.tags ? [{ slug: t.tags.slug, kind: t.tags.kind, votes: t.votes }] : [])),
  };
}

export type FeaturedBook = ReturnType<typeof toFeatured>;

/** How many of the most-shelved books (with covers) the home page hero rotates through. */
const FEATURED_POOL = 30;

/** An Open Library cover, by cover id. */
const olCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

/**
 * Public-domain classics the pick of the day rotates through until enough
 * readers are shelving books. Built in rather than looked up, because a young
 * catalogue is mostly whatever its first readers imported. No `id`: they may
 * not be in the catalogue, so the home page links them to a search instead.
 */
export const CLASSIC_PICKS: FeaturedBook[] = [
  { title: "Pride and Prejudice", author: "Jane Austen", year: 1813, coverId: 14348537, color: "#C2416B" },
  { title: "Jane Eyre", author: "Charlotte Brontë", year: 1847, coverId: 8235363, color: null },
  { title: "Frankenstein", author: "Mary Shelley", year: 1818, coverId: 12356249, color: "#2F6B5E" },
  { title: "Wuthering Heights", author: "Emily Brontë", year: 1847, coverId: 12818862, color: null },
  { title: "Moby-Dick", author: "Herman Melville", year: 1851, coverId: 10544254, color: "#2457A6" },
].map((b) => ({
  id: "",
  title: b.title,
  author: b.author,
  year: b.year,
  cover_url: olCover(b.coverId),
  cover_color: b.color,
  backdrop_style: null,
  tags: [],
}));

/**
 * The home page's pick of the day, a different one each day: one of the
 * most-shelved books with a cover once enough different readers are shelving
 * (see has_crowd), and one of CLASSIC_PICKS before then, so a handful of
 * readers' shelves don't show through. Null when the catalogue is empty.
 */
export async function getFeaturedBook(client: BooksydeClient): Promise<FeaturedBook | null> {
  const day = Math.floor(Date.now() / 86_400_000);
  // An error (e.g. the crowd migration hasn't run) counts as no crowd.
  const { data: crowd } = await client.rpc("has_crowd");
  if (!crowd) return CLASSIC_PICKS[day % CLASSIC_PICKS.length];

  const { data, error } = await client.rpc("featured_pool", { max_results: FEATURED_POOL });
  if (error) throw error;
  if (!data?.length) return null;
  const book = await getWork(client, data[day % data.length].work_id);
  return book ? toFeatured(book) : null;
}
