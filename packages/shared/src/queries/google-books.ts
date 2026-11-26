import { normalizeIsbn } from "../utils/isbn";

/*
 * Google Books: publisher-supplied, flat front covers, looked up by ISBN.
 * Google gives anonymous callers no quota, so every call needs an API key
 * (Google Cloud console → enable the Books API → create an API key).
 */

const API = "https://www.googleapis.com/books/v1/volumes";

type ImageLinks = Partial<Record<"smallThumbnail" | "thumbnail" | "small" | "medium" | "large" | "extraLarge", string>>;

/** Largest first: the volume endpoint offers the big sizes, search results only thumbnails. */
const SIZES = ["extraLarge", "large", "medium", "small", "thumbnail"] as const;

/** Google's image URLs: force https and drop the fake page-curl it paints on thumbnails. */
function cleanImageUrl(url: string) {
  const u = new URL(url.replace(/^http:/, "https:"));
  u.searchParams.delete("edge");
  return u.toString();
}

/**
 * Front-cover URLs Google Books has for an ISBN, largest first (empty when it
 * has none). Throws on HTTP errors so callers can tell "no cover" from "no quota".
 */
export async function getGoogleBooksCovers(isbn: string, apiKey: string, init?: RequestInit): Promise<string[]> {
  const clean = normalizeIsbn(isbn);
  if (clean.length !== 10 && clean.length !== 13) return [];
  const key = encodeURIComponent(apiKey);

  const found = await fetch(`${API}?q=isbn:${clean}&maxResults=1&fields=items(id)&key=${key}`, init);
  if (!found.ok) throw new Error(`Google Books search failed (${found.status})`);
  const id = ((await found.json()) as { items?: { id: string }[] }).items?.[0]?.id;
  if (!id) return [];

  const volume = await fetch(`${API}/${encodeURIComponent(id)}?fields=volumeInfo/imageLinks&key=${key}`, init);
  if (!volume.ok) throw new Error(`Google Books volume failed (${volume.status})`);
  const links = ((await volume.json()) as { volumeInfo?: { imageLinks?: ImageLinks } }).volumeInfo?.imageLinks ?? {};
  return [...new Set(SIZES.flatMap((size) => (links[size] ? [cleanImageUrl(links[size])] : [])))];
}

export type GoogleBooksRelease = {
  id: string;
  title: string;
  authors: string[];
  /** "2026-03-04"; volumes with only a year or month are left out. */
  publishedDate: string;
  isbn13: string | null;
  coverUrl: string | null;
};

type SearchVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: ImageLinks;
  };
};

/**
 * An author's newest English books with an exact publication date (recent and
 * forthcoming ones come first), for "new from your authors". Every edition is
 * its own volume, so expect repeats of a title; callers group them.
 */
export async function getGoogleBooksByAuthor(author: string, apiKey: string, init?: RequestInit): Promise<GoogleBooksRelease[]> {
  const params = new URLSearchParams({
    q: `inauthor:"${author.replace(/"/g, "")}"`,
    orderBy: "newest",
    printType: "books",
    langRestrict: "en",
    maxResults: "20",
    fields: "items(id,volumeInfo(title,authors,publishedDate,language,industryIdentifiers,imageLinks))",
    key: apiKey,
  });
  const res = await fetch(`${API}?${params}`, init);
  if (!res.ok) throw new Error(`Google Books search failed (${res.status})`);
  const items = ((await res.json()) as { items?: SearchVolume[] }).items ?? [];
  return items.flatMap((item) => {
    const info = item.volumeInfo;
    if (!info?.title || !info.publishedDate || !/^\d{4}-\d{2}-\d{2}$/.test(info.publishedDate)) return [];
    if (info.language && info.language !== "en") return [];
    const isbn13 = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null;
    const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
    return [
      {
        id: item.id,
        title: info.title,
        authors: info.authors ?? [],
        publishedDate: info.publishedDate,
        isbn13,
        // Search results only offer thumbnails; zoom=1 is the largest Google serves at this URL.
        coverUrl: image ? cleanImageUrl(image) : null,
      },
    ];
  });
}

export type GoogleBook = {
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  /** "2026-11-18" when Google has the day; null otherwise. */
  publishedDate: string | null;
  year: number | null;
  pageCount: number | null;
};

/** What Google Books says about the book with this ISBN, for a page about a book Open Library doesn't have yet. Null when Google has no such volume. */
export async function getGoogleBookByIsbn(isbn: string, apiKey: string, init?: RequestInit): Promise<GoogleBook | null> {
  const clean = normalizeIsbn(isbn);
  if (clean.length !== 10 && clean.length !== 13) return null;
  const params = new URLSearchParams({
    q: `isbn:${clean}`,
    maxResults: "1",
    fields: "items(volumeInfo(title,subtitle,authors,description,publishedDate,pageCount))",
    key: apiKey,
  });
  const res = await fetch(`${API}?${params}`, init);
  if (!res.ok) throw new Error(`Google Books search failed (${res.status})`);
  const info = ((await res.json()) as {
    items?: { volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; description?: string; publishedDate?: string; pageCount?: number } }[];
  }).items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const date = info.publishedDate ?? "";
  return {
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    // Descriptions come as light HTML; the book page shows plain paragraphs.
    description: info.description ? info.description.replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim() : null,
    publishedDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    pageCount: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
  };
}
