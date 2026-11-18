import { isValidIsbn13, isbn10To13, normalizeIsbn } from "../utils/isbn";

/*
 * Open Library (openlibrary.org) is our "wider stacks": books that aren't in
 * the Booksyde catalogue yet. Its API is free, needs no key and allows
 * browser requests, so web and mobile both call it directly for searching.
 * Adding a book to our catalogue happens server-side (see the web app).
 */

const API = "https://openlibrary.org";
const FIELDS =
  "key,title,subtitle,author_name,author_key,first_publish_year,cover_i,isbn,number_of_pages_median,subject,edition_count,series_key,series_name,series_position";

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
  /** The series the book belongs to, if Open Library files it in one. */
  series: OpenLibrarySeries | null;
};

export type OpenLibrarySeries = {
  /** Series id, e.g. "OL327572L". */
  olid: string;
  name: string;
  /** Its number in the series (2.5 for a novella between 2 and 3); null for an omnibus ("1-4") or unknown. */
  position: number | null;
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
  series_key?: string[];
  series_name?: string[];
  series_position?: string[];
};

export const OPEN_LIBRARY_WORK_ID = /^OL\d{1,12}W$/;
export const OPEN_LIBRARY_SERIES_ID = /^OL\d{1,12}L$/;

/**
 * The first series Open Library files a work under. Positions are free text:
 * a plain number ("3", "2.5") is kept, anything else ("1-4" for a box set) isn't.
 */
function firstSeries(doc: Pick<SearchDoc, "series_key" | "series_name" | "series_position">): OpenLibrarySeries | null {
  const olid = doc.series_key?.[0];
  const name = doc.series_name?.[0]?.trim();
  if (!olid || !name || !OPEN_LIBRARY_SERIES_ID.test(olid)) return null;
  const raw = doc.series_position?.[0]?.trim() ?? "";
  const position = /^\d{1,3}(\.\d{1,2})?$/.test(raw) ? Number(raw) : null;
  return { olid, name, position: position && position > 0 ? position : null };
}


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
    series: firstSeries(doc),
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

  const [res, editions] = await Promise.all([
    fetch(`${API}/works/${olid}.json`, init),
    getEditionCovers(olid, found.title, found.coverId, init),
  ]);
  const edition = preferredEdition(editions);
  let description: string | null = null;
  if (res.ok) {
    const work = (await res.json()) as { description?: string | { value?: string } };
    const raw = typeof work.description === "string" ? work.description : (work.description?.value ?? "");
    description = cleanDescription(raw);
  }
  return {
    ...found,
    coverId: edition?.coverId ?? found.coverId,
    isbn13: edition?.isbn13 ?? found.isbn13,
    description,
    /** Every English edition's cover, best first: fallbacks when the chosen one turns out to be poor. */
    editions: editions.map(({ coverId, isbn13 }) => ({ coverId, isbn13 })),
  };
}

type EditionDoc = {
  title?: string;
  languages?: { key: string }[];
  covers?: number[];
  isbn_13?: string[];
  isbn_10?: string[];
};

export type EditionCover = { coverId: number; isbn13: string | null };

/**
 * A work's English editions that have a cover (and their ISBNs), best first:
 * English by record beats English by title, and ties keep Open Library's own
 * pick (`currentCover`). Editions in other languages are left out. Empty if
 * the editions can't be read.
 */
export async function getEditionCovers(
  olid: string,
  workTitle: string,
  currentCover: number | null = null,
  init?: RequestInit,
): Promise<(EditionCover & { score: number })[]> {
  if (!OPEN_LIBRARY_WORK_ID.test(olid)) return [];
  try {
    const res = await fetch(`${API}/works/${olid}/editions.json?limit=50`, init);
    if (!res.ok) return [];
    const { entries = [] } = (await res.json()) as { entries?: EditionDoc[] };
    const workIdentity = bookIdentity(workTitle);
    const seen = new Set<number>();
    const ranked: (EditionCover & { score: number })[] = [];
    for (const e of entries) {
      const coverId = e.covers?.find((c) => c > 0);
      if (!coverId || seen.has(coverId)) continue;
      const langs = (e.languages ?? []).map((l) => l.key.replace("/languages/", ""));
      if (langs.length && !langs.includes("eng")) continue;
      seen.add(coverId);
      ranked.push({
        coverId,
        isbn13: firstIsbn13([...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])]),
        score:
          (langs.includes("eng") ? 2 : 0) +
          (e.title && bookIdentity(e.title) === workIdentity ? 1 : 0) +
          (coverId === currentCover ? 0.5 : 0),
      });
    }
    // Stable sort: equal scores keep Open Library's edition order.
    return ranked.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

/**
 * The edition whose cover and ISBN should stand for the work. Open Library's
 * own pick (the search `cover_i`) can be any translation, so prefer an
 * English edition, or failing that one titled like the work itself. Null
 * when nothing beats Open Library's pick (or the editions can't be read).
 */
function preferredEdition(editions: (EditionCover & { score: number })[]) {
  const best = editions[0];
  return best && best.score >= 1 ? best : null;
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

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Open Library's free-text dates as YYYY-MM-DD. Only full, unambiguous dates
 * ("2003-02-01", "February 1, 2003", "1 Feb 2003"); anything vaguer is null.
 */
export function fullDate(raw?: string) {
  const s = raw?.trim() ?? "";
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^([A-Za-z]{3,})\.? (\d{1,2}),? (\d{4})$/))) [y, mo, d] = [Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2])];
  else if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3,})\.?,? (\d{4})$/))) [y, mo, d] = [Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1])];
  else return null;
  if (!mo || y < 1000 || y > new Date().getFullYear() + 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export const OPEN_LIBRARY_AUTHOR_ID = /^OL\d{1,12}A$/;

export type OpenLibraryAuthor = { bio: string | null; photoUrl: string | null; birthDate: string | null; deathDate: string | null };

/** An author's bio, portrait and dates, or null if Open Library can't be read. */
export async function getOpenLibraryAuthor(olid: string, init?: RequestInit): Promise<OpenLibraryAuthor | null> {
  if (!OPEN_LIBRARY_AUTHOR_ID.test(olid)) return null;
  const res = await fetch(`${API}/authors/${olid}.json`, init).catch(() => null);
  if (!res?.ok) return null;
  const a = (await res.json()) as { bio?: string | { value?: string }; photos?: number[]; birth_date?: string; death_date?: string };
  const photoId = a.photos?.find((p) => p > 0);
  return {
    bio: cleanDescription(typeof a.bio === "string" ? a.bio : (a.bio?.value ?? "")),
    photoUrl: photoId ? `https://covers.openlibrary.org/a/id/${photoId}-L.jpg` : null,
    birthDate: fullDate(a.birth_date),
    deathDate: fullDate(a.death_date),
  };
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

/** Our genre tags as Open Library subjects (for looking further afield than our own shelves). */
const tagSubjects: Record<string, string> = {
  fantasy: "fantasy",
  romance: "romance",
  thriller: "thriller",
  mystery: "mystery",
  "science-fiction": "science fiction",
  horror: "horror",
  "literary-fiction": "literary fiction",
  "historical-fiction": "historical fiction",
  biography: "biography",
  "young-adult": "young adult fiction",
  poetry: "poetry",
  classics: "classics",
  gothic: "gothic",
};

export function openLibrarySubject(tagSlug: string): string | null {
  return tagSubjects[tagSlug] ?? null;
}

const quoted = (s: string) => `"${s.replace(/["\\]/g, " ").trim()}"`;

/** Box sets and omnibus listings ("Books 1-3", "Set of 2 Books") rather than one book. */
const BUNDLE = /\b(box(ed)?\s*set|collection set|set of \d+|\d+\s*books?\b|books?\s*\d+\s*[-–&]\s*\d+)/i;

/**
 * The most-read Open Library books matching every one of these (all optional):
 * by `author`, carrying all of `subjects`, at least one of `anySubjects`, and
 * none of `notSubjects`. Box sets are left out.
 */
export async function browseOpenLibrary(
  {
    author,
    subjects = [],
    anySubjects = [],
    notSubjects = [],
  }: { author?: string; subjects?: string[]; anySubjects?: string[]; notSubjects?: string[] },
  limit = 12,
  init?: RequestInit,
) {
  if (!author && subjects.length === 0 && anySubjects.length === 0) return [];
  const terms = [
    ...(author ? [`author:${quoted(author)}`] : []),
    ...subjects.map((s) => `subject:${quoted(s)}`),
    ...(anySubjects.length ? [`(${anySubjects.map((s) => `subject:${quoted(s)}`).join(" OR ")})`] : []),
    ...notSubjects.map((s) => `-subject:${quoted(s)}`),
  ];
  const books = await search({ q: terms.join(" "), sort: "readinglog", limit: String(limit) }, init);
  return books.filter((b) => !BUNDLE.test(b.title));
}

/**
 * The series Open Library files each of these works under, by work id (works
 * in no series are left out). Asks in batches of 100, so a whole catalogue
 * is a handful of requests. Throws if Open Library can't be read.
 */
export async function getOpenLibrarySeries(olids: string[], init?: RequestInit) {
  const found = new Map<string, OpenLibrarySeries>();
  const ids = [...new Set(olids)].filter((id) => OPEN_LIBRARY_WORK_ID.test(id));
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const params = new URLSearchParams({
      q: `key:(${batch.map((id) => `/works/${id}`).join(" OR ")})`,
      fields: "key,series_key,series_name,series_position",
      limit: String(batch.length),
    });
    const res = await fetch(`${API}/search.json?${params}`, init);
    if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
    const { docs = [] } = (await res.json()) as { docs?: SearchDoc[] };
    for (const doc of docs) {
      const series = firstSeries(doc);
      if (series) found.set(doc.key.replace("/works/", ""), series);
    }
  }
  return found;
}
