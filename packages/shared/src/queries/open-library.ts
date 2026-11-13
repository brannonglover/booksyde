import { isValidIsbn13, isbn10To13, normalizeIsbn } from "../utils/isbn";

/*
 * Open Library (openlibrary.org) is our "wider stacks": books that aren't in
 * the Booksyde catalogue yet. Its API is free, needs no key and allows
 * browser requests, so web and mobile both call it directly for searching.
 * Adding a book to our catalogue happens server-side (see the web app).
 */

const API = "https://openlibrary.org";
const FIELDS = "key,title,subtitle,author_name,author_key,first_publish_year,cover_i,isbn,number_of_pages_median,subject,edition_count";

export type OpenLibraryBook = {
  /** Work id, e.g. "OL38495W". */
  olid: string;
  title: string;
  subtitle: string | null;
  authors: { name: string; olid: string | null }[];
  year: number | null;
  coverId: number | null;
  isbn13: string | null;
  /** ISBN-13s across the work's editions (capped), for spotting a book we already hold. */
  isbns: string[];
  /** How many editions Open Library knows; 1 often means a stub, audiobook or stray reprint record. */
  editionCount: number;
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
  edition_count?: number;
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

function allIsbn13s(isbns: string[] = [], max = 60) {
  const out = new Set<string>();
  for (const raw of isbns) {
    const isbn = normalizeIsbn(raw);
    const thirteen = isbn.length === 13 ? (isValidIsbn13(isbn) ? isbn : null) : isbn10To13(raw);
    if (thirteen) out.add(thirteen);
    if (out.size >= max) break;
  }
  return [...out];
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
    isbns: allIsbn13s(doc.isbn),
    editionCount: doc.edition_count ?? 0,
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

/** Markdown *emphasis*, **bold** or _underscores_ around whole words (not snake_case or 2 * 3). */
const EMPHASIS = /(?<![\w*])(\*{1,3}|_{1,3})(?![\s*_])([^\n]*?[^\s*_])\1(?![\w*])/g;

/** Open Library descriptions often carry source notes and markdown links and emphasis; keep the prose. */
export function cleanDescription(raw: string) {
  const text = raw
    .split(/\r?\n-{3,}|\r?\n\*\*\*|\(\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(EMPHASIS, "$2")
    .replace(EMPHASIS, "$2") // again, for emphasis nested inside emphasis
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

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "");

/** The part of a title that names the book: before any subtitle or "(Series Book 1)", minus a leading article. */
export function titleKey(title: string) {
  return norm(title.split(/[:;(]/)[0]);
}

function surnameKey(name: string) {
  return norm(name.trim().split(/\s+/).pop() ?? "");
}

/**
 * A strict key: title + lead author's surname. Handy for bulk de-duplication
 * of trusted data (the Open Library dumps); to ask whether a book is already
 * in the catalogue, use `sameBook`, which also copes with missing or
 * mis-ordered authors.
 */
export function bookIdentity(title: string, author?: string | null) {
  return `${titleKey(title)}|${author ? surnameKey(author) : ""}`;
}

/** Just what matching needs: a title and author names, lead author first. */
export type BookLike = { title: string; authors: string[] };

/**
 * Whether two records are the same book, across catalogues: the same title,
 * and at least one author surname in common. A side with no authors at all
 * (Open Library has authorless stub works) matches on title alone, and
 * co-authors count, so "Entangled, Lydia Fenwick" style credits don't need
 * the real author first. Different authors' same-titled books stay apart.
 */
export function sameBook(a: BookLike, b: BookLike) {
  const key = titleKey(a.title);
  if (!key || key !== titleKey(b.title)) return false;
  const theirs = new Set(a.authors.map(surnameKey).filter(Boolean));
  const ours = b.authors.map(surnameKey).filter(Boolean);
  return theirs.size === 0 || ours.length === 0 || ours.some((s) => theirs.has(s));
}

/**
 * For the wider stacks: whether an Open Library result is a book we already
 * hold, so it shouldn't be offered as a request slip. Besides `sameBook`, a
 * one-edition record titled like a held book (an audiobook, a stray reprint,
 * a mis-credited stub) is treated as that book rather than offered again.
 */
export function heldAlready(found: OpenLibraryBook, held: BookLike[]) {
  const asBook = { title: found.title, authors: found.authors.map((a) => a.name) };
  const key = titleKey(found.title);
  return held.some((h) => sameBook(h, asBook) || (found.editionCount <= 1 && titleKey(h.title) === key));
}
