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
