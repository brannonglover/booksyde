import { isValidIsbn13, isbn10To13, normalizeIsbn } from "../utils/isbn";

/*
 * Open Library (openlibrary.org) is our "wider stacks": books that aren't in
 * the Booksyde catalogue yet. Its API is free, needs no key and allows
 * browser requests, so web and mobile both call it directly for searching.
 * Adding a book to our catalogue happens server-side (see the web app).
 */

const API = "https://openlibrary.org";
const FIELDS = "key,title,subtitle,author_name,author_key,first_publish_year,cover_i,isbn,number_of_pages_median,subject";

export type OpenLibraryBook = {
  /** Work id, e.g. "OL38495W". */
  olid: string;
  title: string;
  subtitle: string | null;
  authors: { name: string; olid: string | null }[];
  year: number | null;
  coverId: number | null;
  isbn13: string | null;
  pages: number | null;
  subjects: string[];
};

type SearchDoc = {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
};

export const OPEN_LIBRARY_WORK_ID = /^OL\d{1,12}W$/;

function firstIsbn13(isbns: string[] = []) {
  for (const raw of isbns) {
    const isbn = normalizeIsbn(raw);
    if (isbn.length === 13 && isValidIsbn13(isbn)) return isbn;
  }
  for (const raw of isbns) {
    const converted = isbn10To13(raw);
    if (converted) return converted;
  }
  return null;
}

function toBook(doc: SearchDoc): OpenLibraryBook | null {
  const olid = doc.key.replace("/works/", "");
  if (!OPEN_LIBRARY_WORK_ID.test(olid) || !doc.title) return null;
  return {
    olid,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: (doc.author_name ?? []).slice(0, 3).map((name, i) => ({ name, olid: doc.author_key?.[i] ?? null })),
    year: doc.first_publish_year ?? null,
    coverId: doc.cover_i ?? null,
    isbn13: firstIsbn13(doc.isbn),
    pages: doc.number_of_pages_median ?? null,
    subjects: (doc.subject ?? []).slice(0, 40),
  };
}

async function search(params: Record<string, string>, init?: RequestInit) {
  const url = `${API}/search.json?${new URLSearchParams({ ...params, fields: FIELDS })}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  const json = (await res.json()) as { docs?: SearchDoc[] };
  return (json.docs ?? []).map(toBook).filter((b): b is OpenLibraryBook => b !== null);
}

/** Books on Open Library matching a free-text query (title, author or ISBN). */
export async function searchOpenLibrary(query: string, limit = 8, init?: RequestInit) {
  const q = query.trim();
  if (q.length < 2) return [];
  const isbn = normalizeIsbn(q);
  const params: Record<string, string> = isbn.length === 10 || isbn.length === 13 ? { isbn } : { q };
  return search({ ...params, limit: String(limit) }, init);
}

/** One work with the details we keep, or null if Open Library doesn't know it. */
export async function getOpenLibraryBook(olid: string, init?: RequestInit) {
  if (!OPEN_LIBRARY_WORK_ID.test(olid)) return null;
  const [found] = await search({ q: `key:/works/${olid}`, limit: "1" }, init);
  if (!found) return null;

  let description: string | null = null;
  const res = await fetch(`${API}/works/${olid}.json`, init);
  if (res.ok) {
    const work = (await res.json()) as { description?: string | { value?: string } };
    const raw = typeof work.description === "string" ? work.description : (work.description?.value ?? "");
    description = cleanDescription(raw);
  }
  return { ...found, description };
}

/** Open Library descriptions often carry source notes and markdown links; keep the prose. */
function cleanDescription(raw: string) {
  const text = raw
    .split(/\r?\n-{3,}|\r?\n\*\*\*|\(\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "")
    .trim();
  return text ? text.slice(0, 3000) : null;
}

/** Map Open Library's free-form subjects onto our genre tags. */
const subjectRules: [RegExp, string][] = [
  [/\bfantasy\b|\bmagic\b|\bdragons?\b/i, "fantasy"],
  [/\bromance\b|\blove stories\b/i, "romance"],
  [/\bthriller|\bsuspense\b/i, "thriller"],
  [/\bmyster|\bdetective\b|\bcrime\b/i, "mystery"],
  [/science fiction|\bsci-fi\b|\bdystopia/i, "science-fiction"],
  [/\bhorror\b|\bghost stories\b|\bvampires?\b/i, "horror"],
  [/historical fiction|history.*fiction/i, "historical-fiction"],
  [/\bbiograph|\bautobiograph|\bmemoir/i, "biography"],
  [/young adult|juvenile fiction|\bteen/i, "young-adult"],
  [/\bpoetry\b|\bpoems\b/i, "poetry"],
  [/\bclassic/i, "classics"],
  [/\bgothic\b/i, "gothic"],
  [/literary fiction|\bliterature\b/i, "literary-fiction"],
];

export function openLibraryTags(subjects: string[]) {
  const slugs = new Set<string>();
  for (const subject of subjects) for (const [re, slug] of subjectRules) if (re.test(subject)) slugs.add(slug);
  return [...slugs].slice(0, 4);
}

/** A loose identity for "the same book" across catalogues: title + lead author's surname. */
export function bookIdentity(title: string, author?: string | null) {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/^(the|a|an)\s+/, "")
      .replace(/[^a-z0-9]/g, "");
  const surname = author?.trim().split(/\s+/).pop() ?? "";
  return `${norm(title.split(/[:;(]/)[0])}|${norm(surname)}`;
}
