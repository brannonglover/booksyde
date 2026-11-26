import type { BooksydeClient } from "../client";
import { bylineNames, sameBook } from "./open-library";
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
 * Public-domain classics the pick of the day falls back on before there's a
 * crowd, when no other pick (e.g. a bestseller) is to hand. Built in rather
 * than looked up, because a young catalogue is mostly whatever its first
 * readers imported. No `id`: they may not be in the catalogue, so
 * `linkToCatalogue` looks them up, and the home page searches for any we don't hold.
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
 * The home page's pick of the day, a different one each day. Once enough
 * different readers are shelving books (see has_crowd), one of the
 * most-shelved books with a cover. Before then, so a handful of readers'
 * shelves don't show through, whatever `beforeCrowd` picks (the web app uses
 * the bestseller list), or one of CLASSIC_PICKS. Null when the catalogue is empty.
 */
export async function getFeaturedBook(
  client: BooksydeClient,
  { beforeCrowd }: { beforeCrowd?: (day: number) => Promise<FeaturedBook | null> } = {},
): Promise<FeaturedBook | null> {
  const day = Math.floor(Date.now() / 86_400_000);
  // An error (e.g. the crowd migration hasn't run) counts as no crowd.
  const { data: crowd } = await client.rpc("has_crowd");
  if (!crowd) {
    const pick = beforeCrowd ? await beforeCrowd(day).catch(() => null) : null;
    return linkToCatalogue(client, pick ?? CLASSIC_PICKS[day % CLASSIC_PICKS.length]);
  }

  const { data, error } = await client.rpc("featured_pool", { max_results: FEATURED_POOL });
  if (error) throw error;
  if (!data?.length) return null;
  const book = await getWork(client, data[day % data.length].work_id);
  return book ? toFeatured(book) : null;
}

/**
 * Our copy of a book found elsewhere (a bestseller list, Open Library, a
 * built-in pick), by its title and an author in common; null if we don't hold
 * it. Prefers a copy with a cover, should we hold the title twice.
 */
export async function findWorkByTitle(client: BooksydeClient, title: string, author: string): Promise<string | null> {
  const lead = title.split(/[:;(]/)[0].trim();
  if (!lead || !author.trim()) return null;
  const { data, error } = await client
    .from("works")
    .select("id, title, cover_url, work_contributors ( role, authors ( name ) )")
    // Starts with the title, so ours can carry a subtitle, and any punctuation
    // stands for any one character ("Moby-Dick" finds "Moby Dick"); `sameBook` has the final say.
    .ilike("title", `${lead.replace(/[^\p{L}\p{N}\s]/gu, "_")}%`)
    .limit(20);
  if (error) throw error;
  const theirs = { title, authors: bylineNames(author) };
  const matches = (data ?? []).filter((w) => {
    const authors = w.work_contributors.flatMap((c) => (c.role === "author" && c.authors ? [c.authors.name] : []));
    // An authorless record would match on title alone; not enough to stake a pick on.
    return authors.length > 0 && sameBook(theirs, { title: w.title, authors });
  });
  return (matches.find((w) => w.cover_url) ?? matches[0])?.id ?? null;
}

/**
 * A pick with no `id` as its catalogue page, when we hold it, so it opens
 * there instead of in a search. Keeps the pick's own cover if ours has none.
 * A pick we don't hold (or a failed lookup) comes back as it was.
 */
export async function linkToCatalogue(client: BooksydeClient, pick: FeaturedBook): Promise<FeaturedBook> {
  if (pick.id) return pick;
  const id = await findWorkByTitle(client, pick.title, pick.author).catch(() => null);
  const work = id ? await getWork(client, id).catch(() => null) : null;
  if (!work) return pick;
  const ours = toFeatured(work);
  return { ...ours, cover_url: ours.cover_url ?? pick.cover_url, cover_color: ours.cover_color ?? pick.cover_color };
}
