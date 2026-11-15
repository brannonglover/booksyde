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

/**
 * The home page's pick of the day: one of the most-shelved books that has a
 * cover, a different one each day. Null when the catalogue is empty.
 */
export async function getFeaturedBook(client: BooksydeClient): Promise<FeaturedBook | null> {
  const { data, error } = await client
    .from("works")
    .select("id")
    .not("cover_url", "is", null)
    .order("shelved_count", { ascending: false })
    .limit(FEATURED_POOL);
  if (error) throw error;
  if (!data?.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const book = await getWork(client, data[day % data.length].id);
  return book ? toFeatured(book) : null;
}
