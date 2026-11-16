/*
 * Seed the catalogue from Open Library's monthly data dumps.
 *
 *   npm run db:import -- --limit 10000 --dry-run
 *   npm run db:import -- --limit 10000
 *
 * Reads the dumps from disk (see README.md for the download commands), so the
 * only network traffic is the one-time download plus batched writes to
 * Supabase. Books are ranked by how often Open Library readers shelve and
 * rate them, then the top --limit with an English edition are imported with their authors, one
 * edition each (ISBN, pages, publisher) and genre tags.
 *
 * Safe to re-run: works and authors are matched on open_library_id (and on
 * title + lead author for books added by hand), so nothing is duplicated.
 * Existing rows are never overwritten.
 */

import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/types/src/database";
import { bookIdentity, cleanDescription, fullDate as dateOf, openLibraryTags, sameBook, titleKey } from "../../packages/shared/src/queries/open-library";
import { isbn10To13, isValidIsbn10, isValidIsbn13, normalizeIsbn } from "../../packages/shared/src/utils/isbn";

// ---------------------------------------------------------------------------
// Options

const { values: opts } = parseArgs({
  options: {
    dir: { type: "string", default: "supabase/import/dumps" },
    works: { type: "string" },
    editions: { type: "string" },
    authors: { type: "string" },
    "reading-log": { type: "string" },
    ratings: { type: "string" },
    limit: { type: "string", default: "10000" },
    "allow-no-cover": { type: "boolean", default: false },
    "all-languages": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    env: { type: "string" },
    remote: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (opts.help) {
  console.log(`Usage: npm run db:import -- [options]

  --limit N           How many books to import (default 10000)
  --dry-run           Read the dumps and report what would be imported; write nothing
  --allow-no-cover    Include books without a cover (skipped by default)
  --all-languages     Include books with no English edition (skipped by default; needs the editions dump to tell)
  --dir PATH          Folder holding the ol_dump_*.txt.gz files (default supabase/import/dumps)
  --works/--editions/--authors/--reading-log/--ratings PATH
                      Point at a specific dump file instead of auto-detecting it in --dir
  --env PATH          Env file with the Supabase URL and SUPABASE_SECRET_KEY (default: the local stack)
  --remote            Required to write to a non-local Supabase project`);
  process.exit(0);
}

const limit = Number(opts.limit);
if (!Number.isInteger(limit) || limit < 1) fail(`--limit must be a positive whole number, got "${opts.limit}".`);

function findDump(kind: string) {
  const explicit = opts[kind as keyof typeof opts];
  if (typeof explicit === "string") {
    if (!existsSync(explicit)) fail(`--${kind} ${explicit} doesn't exist.`);
    return explicit;
  }
  if (!existsSync(opts.dir)) return null;
  const pattern = new RegExp(`^ol_dump_${kind}_.*\\.txt(\\.gz)?$`);
  const matches = readdirSync(opts.dir).filter((f) => pattern.test(f)).sort();
  return matches.length ? join(opts.dir, matches[matches.length - 1]) : null;
}

const files = {
  works: findDump("works"),
  editions: findDump("editions"),
  authors: findDump("authors"),
  readingLog: findDump("reading-log"),
  ratings: findDump("ratings"),
};
if (!files.works) fail(`No works dump found. Put ol_dump_works_*.txt.gz in ${opts.dir} or pass --works.`);
if (!files.authors) fail(`No authors dump found. Put ol_dump_authors_*.txt.gz in ${opts.dir} or pass --authors.`);
if (!files.readingLog && !files.ratings) {
  fail(`No reading-log or ratings dump found; one is needed to rank books by popularity. Put it in ${opts.dir}.`);
}
const englishOnly = !opts["all-languages"] && Boolean(files.editions);
if (!files.editions) {
  log("No editions dump: books will be imported without ISBNs, page counts or publishers, in any language.");
}

// ---------------------------------------------------------------------------
// Supabase (only needed when writing)

/** URL and secret key of the local stack, from `supabase status`. */
function localStack() {
  try {
    const out = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const env = Object.fromEntries(out.split("\n").map((l) => l.match(/^(\w+)="?(.*?)"?$/)).filter((m) => m !== null).map((m) => [m[1], m[2]]));
    return { url: env.API_URL ?? "", key: env.SECRET_KEY ?? "" };
  } catch {
    return { url: "", key: "" };
  }
}

function connect() {
  let url = process.env.SUPABASE_URL ?? "";
  let key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (opts.env) {
    if (!existsSync(opts.env)) fail(`--env ${opts.env} doesn't exist.`);
    process.loadEnvFile(opts.env);
    url ||= process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    key ||= process.env.SUPABASE_SECRET_KEY ?? "";
  } else if (!url || !key) {
    ({ url, key } = localStack());
    if (!url || !key) fail("The local Supabase isn't running (npm run db:start), and no --env file was given.");
  }
  if (!url || !key) fail(`${opts.env} needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY.`);
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
  if (!local && !opts.remote) fail(`${url} isn't a local Supabase. Pass --remote if you really mean to import into it.`);
  log(`Writing to ${url}`);
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
type Db = ReturnType<typeof connect>;

// ---------------------------------------------------------------------------
// Helpers

const started = Date.now();
function log(message: string) {
  const s = Math.round((Date.now() - started) / 1000);
  console.log(`[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}] ${message}`);
}
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Every line of a dump, gzipped or not, with a progress note every few million lines. */
async function* lines(file: string, label: string) {
  const input = createReadStream(file);
  const stream = file.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  let n = 0;
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (++n % 5_000_000 === 0) log(`  ${label}: ${(n / 1e6).toFixed(0)}M lines`);
    yield line;
  }
  log(`  ${label}: done, ${n.toLocaleString()} lines`);
}

/** Dump rows are: type, key, revision, last_modified, JSON. */
function columns(line: string) {
  const a = line.indexOf("\t");
  const b = line.indexOf("\t", a + 1);
  const c = line.indexOf("\t", b + 1);
  const d = line.indexOf("\t", c + 1);
  return { type: line.slice(0, a), key: line.slice(a + 1, b), json: line.slice(d + 1) };
}

const WORK_KEY = /^\/works\/OL(\d+)W$/;
const AUTHOR_KEY = /^\/authors\/OL(\d+)A$/;
const EDITION_KEY = /^\/books\/OL(\d+)M$/;
const EDITION_WORK = /"works":\s*\[\s*\{\s*"key":\s*"\/works\/OL(\d+)W"/;
const LOG_WORK = /^\/works\/OL(\d+)W\t/;

type Text = string | { value?: string } | undefined;
const text = (t: Text) => (typeof t === "string" ? t : (t?.value ?? ""));
const clean = (t: Text) => cleanDescription(text(t));

const thisYear = new Date().getFullYear();
function yearOf(s?: string) {
  const m = s?.match(/\b(\d{4})\b/);
  const y = m ? Number(m[1]) : NaN;
  return y >= 1000 && y <= thisYear + 1 ? y : null;
}

const LANGUAGES: Record<string, string> = {
  eng: "en", fre: "fr", ger: "de", spa: "es", ita: "it", por: "pt", rus: "ru", jpn: "ja", chi: "zh", dut: "nl",
  swe: "sv", dan: "da", nor: "no", fin: "fi", pol: "pl", cze: "cs", gre: "el", heb: "he", ara: "ar", hin: "hi",
  kor: "ko", tur: "tr", hun: "hu", lat: "la", ukr: "uk", cat: "ca", rum: "ro", ice: "is", ind: "id", vie: "vi",
};

type Format = Database["public"]["Enums"]["edition_format"];
function formatOf(raw?: string): Format {
  const s = raw?.toLowerCase() ?? "";
  if (/audio|cd|cassette/.test(s)) return "audiobook";
  if (/e-?book|electronic|kindle|epub|digital/.test(s)) return "ebook";
  if (/mass.?market/.test(s)) return "mass_market";
  if (/paper|soft/.test(s)) return "paperback";
  if (/hard|cloth|library binding/.test(s)) return "hardcover";
  return "other";
}

const coverUrl = (id: number | undefined, kind: "b" | "a" = "b") =>
  id && id > 0 ? `https://covers.openlibrary.org/${kind}/id/${id}-L.jpg` : null;

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// 1. Popularity: one point per reading-log entry or rating.

const score = new Map<number, number>();
for (const file of [files.readingLog, files.ratings]) {
  if (!file) continue;
  log(`Ranking books from ${file}`);
  for await (const line of lines(file, "popularity")) {
    const m = LOG_WORK.exec(line);
    if (m) {
      const id = Number(m[1]);
      score.set(id, (score.get(id) ?? 0) + 1);
    }
  }
}
// Some candidates will lack a cover, an author or an English edition, or turn out to be duplicates,
// so read a wider pool.
const pool = new Set(
  [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit * (englishOnly ? 3 : 2))
    .map(([id]) => id),
);
log(`${score.size.toLocaleString()} books have reader activity; considering the top ${pool.size.toLocaleString()}`);

// ---------------------------------------------------------------------------
// 2. Works

type Work = {
  id: number;
  olid: string;
  title: string;
  subtitle: string | null;
  /** As Open Library has them, before any switch to the English title or cover. */
  originalTitle: string;
  originalSubtitle: string | null;
  originalCoverId: number | undefined;
  description: string | null;
  year: number | null;
  coverId: number | undefined;
  authorIds: number[];
  subjects: string[];
};
type WorkJson = {
  title?: string;
  subtitle?: string;
  description?: Text;
  first_publish_date?: string;
  covers?: number[];
  authors?: { author?: { key?: string } | string }[];
  subjects?: string[];
};

const works = new Map<number, Work>();
log(`Reading works from ${files.works}`);
for await (const line of lines(files.works, "works")) {
  const { type, key, json } = columns(line);
  if (type !== "/type/work") continue;
  const m = WORK_KEY.exec(key);
  if (!m || !pool.has(Number(m[1]))) continue;
  const w = JSON.parse(json) as WorkJson;
  const title = w.title?.trim();
  const coverId = w.covers?.find((c) => c > 0);
  const authorIds = [
    ...new Set(
      (w.authors ?? [])
        .map((a) => (typeof a.author === "string" ? a.author : a.author?.key) ?? "")
        .map((k) => AUTHOR_KEY.exec(k)?.[1])
        .filter((k): k is string => Boolean(k))
        .map(Number),
    ),
  ].slice(0, 3);
  if (!title || title.length > 500 || !authorIds.length || (!coverId && !opts["allow-no-cover"])) continue;
  const subtitle = w.subtitle?.trim() || null;
  // Some records were split at the colon inside a bracket: "Fetch (Five Nights at Freddy's" + "Fazbear Frights #2)".
  const broken = subtitle?.endsWith(")") && (title.match(/\(/g) ?? []).length > (title.match(/\)/g) ?? []).length;
  works.set(Number(m[1]), {
    id: Number(m[1]),
    olid: `OL${m[1]}W`,
    title: broken ? `${title}: ${subtitle}` : title,
    subtitle: broken ? null : subtitle,
    originalTitle: title,
    originalSubtitle: subtitle,
    originalCoverId: coverId,
    description: clean(w.description),
    year: yearOf(w.first_publish_date),
    coverId,
    authorIds,
    subjects: (w.subjects ?? []).slice(0, 40),
  });
}
log(`${works.size.toLocaleString()} candidate works have a title, an author${opts["allow-no-cover"] ? "" : " and a cover"}`);

// ---------------------------------------------------------------------------
// 3. Editions, for every candidate: the best edition, the earliest publication year, and
//    whether the book is published in English at all (so we can choose by it).

type Edition = {
  olid: string;
  title: string | null;
  isbn13: string | null;
  isbn10: string | null;
  format: Format;
  publisher: string | null;
  publishedDate: string | null;
  pages: number | null;
  language: string | null;
  coverUrl: string | null;
  rank: number;
};
type EditionJson = {
  title?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  physical_format?: string;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  languages?: { key?: string }[];
  covers?: number[];
  description?: Text;
};

/** ISBN registration groups for English-language publishing: 978-0, 978-1 and 979-8 (US). */
const ENGLISH_ISBN = /^(978[01]|9798)/;

/*
 * English titles for translated books. Open Library titles a work in its original language
 * ("Преступление и наказание"), so each work's English editions vote on what to call it
 * instead. We also count which editions use the work's own title: when mostly non-English
 * ones do, the title is a foreign original; when English ones do too, it stays
 * (so "Harry Potter and the Philosopher's Stone" isn't swapped for the US title).
 */
type TitleVotes = { english: Map<string, Map<string, number>>; originalInEnglish: number; originalElsewhere: number };
const titleVotes = new Map<number, TitleVotes>();

function voteTitle(work: Work, raw: string, english: boolean, languageKnown: boolean) {
  const key = titleKey(raw);
  if (!key) return; // nothing Latin-script to compare
  let votes = titleVotes.get(work.id);
  if (!votes) titleVotes.set(work.id, (votes = { english: new Map(), originalInEnglish: 0, originalElsewhere: 0 }));
  if (key === titleKey(work.title)) {
    if (english) votes.originalInEnglish++;
    else if (languageKnown) votes.originalElsewhere++;
  }
  if (!english) return;
  // The title proper, without "(Penguin Classics)", ": A Novel" or a catalogue's trailing slash.
  const shown = raw.split(/\s*[:;([]/)[0].replace(/[\s.,/]+$/, "").trim();
  if (!shown) return;
  const spellings = votes.english.get(key) ?? new Map<string, number>();
  spellings.set(shown, (spellings.get(shown) ?? 0) + 1);
  votes.english.set(key, spellings);
}

/** Title Case, not a library catalogue's "Crime and punishment" or a shouty "CRIME AND PUNISHMENT". */
const titleCased = (s: string) =>
  s !== s.toUpperCase() && s.split(/\s+/).filter((w) => w.length > 3 && /^\p{L}/u.test(w)).every((w) => /^\p{Lu}/u.test(w));

/** The English title to use instead of the work's own, or null to keep it. */
function englishTitle(work: Work) {
  const votes = titleVotes.get(work.id);
  if (!votes) return null;
  const ownKey = titleKey(work.title);
  // A Latin-script title that English editions use at least as often as foreign ones is already English.
  if (ownKey && votes.originalElsewhere <= votes.originalInEnglish) return null;
  let best: { key: string; count: number; spellings: Map<string, number> } | null = null;
  for (const [key, spellings] of votes.english) {
    const count = [...spellings.values()].reduce((a, b) => a + b, 0);
    if (!best || count > best.count) best = { key, count, spellings };
  }
  if (!best || best.key === ownKey || best.count < 2) return null;
  // The most common wording ignoring case ("The stranger" and "The Stranger" are one), then its Title
  // Case spelling if any edition has one. Bookseller feeds often drop a leading article ("Stranger"),
  // so a bare wording's votes go to its "The …" / "A …" form whenever at least two editions use that.
  const wordings = new Map<string, { votes: number; spellings: [string, number][] }>();
  for (const [spelling, n] of best.spellings) {
    const k = spelling.toLowerCase();
    const w = wordings.get(k) ?? { votes: 0, spellings: [] };
    w.votes += n;
    w.spellings.push([spelling, n]);
    wordings.set(k, w);
  }
  for (const [k, w] of wordings) {
    const bare = wordings.get(k.replace(/^(the|an?) /, ""));
    if (bare && bare !== w && w.votes >= 2) {
      w.votes += bare.votes;
      bare.votes = 0;
    }
  }
  const wording = [...wordings.values()].sort((a, b) => b.votes - a.votes)[0];
  return wording.spellings.sort((a, b) => Number(titleCased(b[0])) - Number(titleCased(a[0])) || b[1] - a[1])[0][0];
}

const editions = new Map<number, Edition>();
/** Candidates whose title or cover we corrected; kept apart from the selection, see toCorrect. */
const corrected: Work[] = [];
const editionDescriptions = new Map<number, string>();
const inEnglish = new Set<number>();
/*
 * English covers. A work's cover is often its original edition's (L'Étranger for The Stranger). When
 * the work's cover belongs to a non-English edition and to no English one, use the cover of the best
 * English edition that has one.
 */
const coverOnForeignEdition = new Set<number>();
const coverOnEnglishEdition = new Set<number>();
const bestEnglishCover = new Map<number, { id: number; rank: number }>();
if (files.editions) {
  log(`Reading editions from ${files.editions}`);
  for await (const line of lines(files.editions, "editions")) {
    const m = EDITION_WORK.exec(line);
    if (!m) continue;
    const workId = Number(m[1]);
    const work = works.get(workId);
    if (!work) continue;
    const { type, key, json } = columns(line);
    const ek = EDITION_KEY.exec(key);
    if (type !== "/type/edition" || !ek) continue;
    const e = JSON.parse(json) as EditionJson;

    const year = yearOf(e.publish_date);
    if (year && (!work.year || year < work.year)) work.year = year;

    const isbn10 = (e.isbn_10 ?? []).map(normalizeIsbn).find(isValidIsbn10) ?? null;
    const isbn13 = (e.isbn_13 ?? []).map(normalizeIsbn).find(isValidIsbn13) ?? (isbn10 ? isbn10To13(isbn10) : null);
    const language = LANGUAGES[e.languages?.[0]?.key?.replace("/languages/", "") ?? ""] ?? null;
    // English by the language field, or, when an edition has none, by its ISBN's registration group.
    const english = language ? language === "en" : ENGLISH_ISBN.test(isbn13 ?? "");
    if (english) inEnglish.add(workId);
    const title = e.title?.trim() || null;
    if (title) voteTitle(work, title, english, Boolean(language || isbn13));
    const coverIds = (e.covers ?? []).filter((c) => c > 0);
    if (work.originalCoverId && coverIds.includes(work.originalCoverId)) {
      if (english) coverOnEnglishEdition.add(workId);
      else if (language || isbn13) coverOnForeignEdition.add(workId);
    }
    if (englishOnly && !english) continue;

    if (!work.description && !editionDescriptions.has(workId)) {
      const d = clean(e.description);
      if (d) editionDescriptions.set(workId, d);
    }
    const pages = e.number_of_pages && e.number_of_pages > 0 && e.number_of_pages < 20000 ? Math.round(e.number_of_pages) : null;
    const format = formatOf(e.physical_format);
    const publisher = e.publishers?.[0]?.trim().slice(0, 300) || null;
    const cover = coverUrl(e.covers?.find((c) => c > 0));
    const languageRank = language ? (language === "en" ? 3 : -4) : english ? 2 : 0;
    const rank = (isbn13 ? 8 : 0) + (pages ? 4 : 0) + languageRank + (cover ? 1 : 0) + (publisher ? 1 : 0) + (format !== "other" ? 1 : 0);
    if (english && coverIds.length && rank > (bestEnglishCover.get(workId)?.rank ?? -Infinity)) {
      bestEnglishCover.set(workId, { id: coverIds[0], rank });
    }
    if ((editions.get(workId)?.rank ?? -Infinity) >= rank) continue;

    editions.set(workId, {
      olid: `OL${ek[1]}M`,
      title: title?.slice(0, 500) ?? null, // cleared below if it's just the work's title
      isbn13,
      isbn10,
      format,
      publisher,
      publishedDate: dateOf(e.publish_date),
      pages,
      language,
      coverUrl: cover,
      rank,
    });
  }
  for (const [id, d] of editionDescriptions) works.get(id)!.description ??= d;
  editionDescriptions.clear();

  for (const work of works.values()) {
    const title = englishTitle(work);
    if (title) {
      work.title = title;
      work.subtitle = null; // it belonged to the original-language title
    }
    const e = editions.get(work.id);
    if (e?.title && e.title.toLowerCase() === work.title.toLowerCase()) e.title = null;
    const englishCover = bestEnglishCover.get(work.id);
    if (englishCover && coverOnForeignEdition.has(work.id) && !coverOnEnglishEdition.has(work.id)) work.coverId = englishCover.id;
  }
  titleVotes.clear();
  bestEnglishCover.clear();
}
corrected.push(...[...works.values()].filter((w) => w.title !== w.originalTitle || w.coverId !== w.originalCoverId));
log(
  `Corrected ${corrected.filter((w) => w.title !== w.originalTitle).length.toLocaleString()} titles and ` +
    `${corrected.filter((w) => w.coverId !== w.originalCoverId).length.toLocaleString()} covers (English for translations, repaired splits)`,
);
if (englishOnly) {
  const before = works.size;
  for (const id of works.keys()) if (!inEnglish.has(id)) works.delete(id);
  log(`${works.size.toLocaleString()} of ${before.toLocaleString()} have an English edition (--all-languages to keep the rest)`);
}

// ---------------------------------------------------------------------------
// 4. Authors

type Author = { id: number; olid: string; name: string; bio: string | null; photoUrl: string | null; birth: string | null; death: string | null };
type AuthorJson = { name?: string; bio?: Text; photos?: number[]; birth_date?: string; death_date?: string };

const neededAuthors = new Set([...works.values()].flatMap((w) => w.authorIds));
const authors = new Map<number, Author>();
log(`Reading ${neededAuthors.size.toLocaleString()} authors from ${files.authors}`);
for await (const line of lines(files.authors, "authors")) {
  const { type, key, json } = columns(line);
  if (type !== "/type/author") continue;
  const m = AUTHOR_KEY.exec(key);
  if (!m || !neededAuthors.has(Number(m[1]))) continue;
  const a = JSON.parse(json) as AuthorJson;
  const name = a.name?.trim();
  if (!name || name.length > 300) continue;
  authors.set(Number(m[1]), {
    id: Number(m[1]),
    olid: `OL${m[1]}A`,
    name,
    bio: clean(a.bio),
    photoUrl: coverUrl(a.photos?.find((p) => p > 0), "a"),
    birth: dateOf(a.birth_date),
    death: dateOf(a.death_date),
  });
}

// Pick the final list: most popular first, one work per title + lead author (Open Library has many duplicates).
const seen = new Set<string>();
const selected: Work[] = [];
for (const w of [...works.values()].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.id - b.id)) {
  w.authorIds = w.authorIds.filter((id) => authors.has(id));
  if (!w.authorIds.length) continue;
  const identity = bookIdentity(w.title, authors.get(w.authorIds[0])!.name);
  if (seen.has(identity)) continue;
  seen.add(identity);
  selected.push(w);
  if (selected.length === limit) break;
}
works.clear();
log(`Selected ${selected.length.toLocaleString()} books`);

// ---------------------------------------------------------------------------
// Report

const chosenEditions = selected.map((w) => editions.get(w.id)).filter((e): e is Edition => Boolean(e));
const withIsbn = chosenEditions.filter((e) => e.isbn13).length;
log(
  `Ready: ${selected.length.toLocaleString()} books, ${new Set(selected.flatMap((w) => w.authorIds)).size.toLocaleString()} authors, ` +
    `${chosenEditions.length.toLocaleString()} editions (${withIsbn.toLocaleString()} with an ISBN), ` +
    `${selected.filter((w) => w.description).length.toLocaleString()} with a description`,
);
for (const w of selected.slice(0, 10)) {
  const e = editions.get(w.id);
  console.log(
    `  ${String(score.get(w.id)).padStart(6)}  ${w.title} — ${authors.get(w.authorIds[0])!.name}` +
      `${w.year ? ` (${w.year})` : ""}${e?.isbn13 ? `  ISBN ${e.isbn13}` : ""}  [${openLibraryTags(w.subjects).join(", ")}]`,
  );
}
if (opts["dry-run"]) {
  log("Dry run: nothing written.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 5. Write

const db = connect();

/** Every row of a table, 1,000 at a time (PostgREST's page size). */
async function all<T>(label: string, page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) fail(`Couldn't read ${label}: ${JSON.stringify(error)}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
function check(label: string, error: unknown) {
  if (error) fail(`Couldn't write ${label}: ${JSON.stringify(error)}`);
}

log("Loading what the catalogue already holds");
const existingWorks = await all("works", (a, b) =>
  db.from("works").select("id, title, subtitle, cover_url, open_library_id, work_contributors ( position, authors ( name ) )").order("id").range(a, b),
);
const existingAuthors = await all("authors", (a, b) => db.from("authors").select("id, name, open_library_id").order("id").range(a, b));
const existingEditions = await all("editions", (a, b) =>
  db.from("editions").select("isbn_13, isbn_10, open_library_id").order("id").range(a, b),
);
const { data: tagRows, error: tagError } = await db.from("tags").select("id, slug");
if (tagError) fail(`Couldn't read tags: ${JSON.stringify(tagError)}`);
const tagId = new Map((tagRows ?? []).map((t) => [t.slug, t.id]));

const workByOl = new Map<string, { id: string; hasAuthors: boolean; title: string; subtitle: string | null; coverUrl: string | null }>();
// Held works by title, so each candidate is only compared (with sameBook) against same-titled ones.
const worksByTitle = new Map<string, { id: string; olid: string | null; title: string; authors: string[] }[]>();
for (const w of existingWorks) {
  if (w.open_library_id) {
    workByOl.set(w.open_library_id, { id: w.id, hasAuthors: w.work_contributors.length > 0, title: w.title, subtitle: w.subtitle, coverUrl: w.cover_url });
  }
  const names = [...w.work_contributors].sort((x, y) => x.position - y.position).map((c) => c.authors.name);
  const key = titleKey(w.title);
  worksByTitle.set(key, [...(worksByTitle.get(key) ?? []), { id: w.id, olid: w.open_library_id, title: w.title, authors: names }]);
}
const authorByOl = new Map(existingAuthors.filter((a) => a.open_library_id).map((a) => [a.open_library_id!, a.id]));
const authorByName = new Map(existingAuthors.map((a) => [a.name.toLowerCase(), a]));
const takenIsbns = new Set(existingEditions.flatMap((e) => [e.isbn_13, e.isbn_10]).filter(Boolean));
const takenEditions = new Set(existingEditions.map((e) => e.open_library_id).filter(Boolean));

// Decide what each selected book needs.
const toInsert: Work[] = [];
const toRepair: { work: Work; id: string }[] = []; // imported before but interrupted before its authors were written
const toLink: { id: string; olid: string }[] = []; // added by hand; just record the Open Library id
// Imported earlier with Open Library's original title or cover. This covers every corrected candidate,
// not just the selection: an English title can make a book a duplicate that selection now drops, but
// the copy already in the catalogue should still be fixed. Each field is only changed while it still
// holds exactly what Open Library had, so anything someone edited by hand is left alone.
type Correction = { id: string; title?: string; subtitle?: null; cover_url?: string | null };
const toCorrect = corrected.flatMap((w): Correction[] => {
  const held = workByOl.get(w.olid);
  if (!held) return [];
  const fix: Correction = { id: held.id };
  if (w.title !== w.originalTitle && held.title === w.originalTitle) {
    fix.title = w.title;
    if (held.subtitle !== null && held.subtitle === w.originalSubtitle) fix.subtitle = null;
  }
  if (w.coverId !== w.originalCoverId && held.coverUrl === coverUrl(w.originalCoverId)) fix.cover_url = coverUrl(w.coverId);
  return Object.keys(fix).length > 1 ? [fix] : [];
});
let skipped = 0;
for (const w of selected) {
  const byOl = workByOl.get(w.olid);
  if (byOl) {
    if (byOl.hasAuthors) skipped++;
    else toRepair.push({ work: w, id: byOl.id });
    continue;
  }
  const candidate = { title: w.title, authors: w.authorIds.map((id) => authors.get(id)!.name) };
  const same = worksByTitle.get(titleKey(w.title))?.find((held) => sameBook(held, candidate));
  if (same) {
    if (!same.olid) toLink.push({ id: same.id, olid: w.olid });
    skipped++;
    continue;
  }
  toInsert.push(w);
}
log(`${toInsert.length.toLocaleString()} new, ${toRepair.length} to finish, ${skipped.toLocaleString()} already in the catalogue`);

for (const { id, olid } of toLink) {
  const { error } = await db.from("works").update({ open_library_id: olid }).eq("id", id);
  check("works.open_library_id", error);
}

for (const { id, ...fields } of toCorrect) {
  // A changed cover means the old tint no longer matches it.
  const { error } = await db.from("works").update("cover_url" in fields ? { ...fields, cover_color: null } : fields).eq("id", id);
  check("works", error);
  if (fields.title) {
    // The edition was stored with its English title because it differed from the work's; now it doesn't.
    const { error: editionError } = await db.from("editions").update({ title: null }).eq("work_id", id).ilike("title", fields.title.replace(/[%_\\]/g, "\\$&"));
    check("editions.title", editionError);
  }
}
const retitledCount = toCorrect.filter((c) => c.title).length;
const recoveredCount = toCorrect.filter((c) => "cover_url" in c).length;
if (toCorrect.length) log(`Fixed books imported earlier: ${retitledCount.toLocaleString()} titles, ${recoveredCount.toLocaleString()} covers`);

// Authors: reuse by Open Library id, then by exact name; create the rest.
const authorUuid = new Map<number, string>();
const newAuthors: Author[] = [];
for (const id of new Set([...toInsert, ...toRepair.map((r) => r.work)].flatMap((w) => w.authorIds))) {
  const a = authors.get(id)!;
  const existing = authorByOl.get(a.olid) ?? authorByName.get(a.name.toLowerCase())?.id;
  if (existing) authorUuid.set(id, existing);
  else newAuthors.push(a);
}
for (const batch of chunks(newAuthors, 500)) {
  const { data, error } = await db
    .from("authors")
    .insert(batch.map((a) => ({ name: a.name, bio: a.bio, photo_url: a.photoUrl, birth_date: a.birth, death_date: a.death, open_library_id: a.olid })))
    .select("id, open_library_id");
  check("authors", error);
  for (const row of data ?? []) authorUuid.set(Number(row.open_library_id!.slice(2, -1)), row.id);
}
log(`Authors: ${newAuthors.length.toLocaleString()} added, ${(authorUuid.size - newAuthors.length).toLocaleString()} already on file`);

/** Contributors, edition and tags for works that now have a Booksyde id. */
async function writeDetails(rows: { work: Work; id: string }[]) {
  const contributors = rows.flatMap(({ work, id }) =>
    [...new Map(work.authorIds.map((a, position) => [authorUuid.get(a)!, position])).entries()].map(([author_id, position]) => ({
      work_id: id,
      author_id,
      role: "author" as const,
      position,
    })),
  );
  const { error: cErr } = await db.from("work_contributors").upsert(contributors, { onConflict: "work_id,author_id,role", ignoreDuplicates: true });
  check("work_contributors", cErr);

  const editionRows = rows.flatMap(({ work, id }) => {
    const e = editions.get(work.id);
    if (!e || takenEditions.has(e.olid)) return [];
    takenEditions.add(e.olid);
    const isbn13 = e.isbn13 && !takenIsbns.has(e.isbn13) ? e.isbn13 : null;
    const isbn10 = e.isbn10 && !takenIsbns.has(e.isbn10) ? e.isbn10 : null;
    if (isbn13) takenIsbns.add(isbn13);
    if (isbn10) takenIsbns.add(isbn10);
    return [{
      work_id: id,
      title: e.title,
      isbn_13: isbn13,
      isbn_10: isbn10,
      format: e.format,
      publisher: e.publisher,
      published_date: e.publishedDate,
      page_count: e.pages,
      language: e.language,
      cover_url: e.coverUrl,
      open_library_id: e.olid,
    }];
  });
  if (editionRows.length) {
    const { error } = await db.from("editions").insert(editionRows);
    check("editions", error);
  }

  const tagRowsOut = rows.flatMap(({ work, id }) =>
    openLibraryTags(work.subjects)
      .map((slug) => tagId.get(slug))
      .filter((t): t is string => Boolean(t))
      .map((tag_id) => ({ work_id: id, tag_id, votes: 1 })),
  );
  if (tagRowsOut.length) {
    const { error } = await db.from("work_tags").upsert(tagRowsOut, { onConflict: "work_id,tag_id", ignoreDuplicates: true });
    check("work_tags", error);
  }
}

if (toRepair.length) await writeDetails(toRepair);

// Works go in 500 at a time, each batch with its details, so an interruption loses at most one batch
// (and the next run finishes it: see toRepair).
let written = 0;
for (const batch of chunks(toInsert, 500)) {
  const { data, error } = await db
    .from("works")
    .insert(
      batch.map((w) => ({
        title: w.title,
        subtitle: w.subtitle,
        description: w.description,
        first_published_year: w.year,
        cover_url: coverUrl(w.coverId),
        open_library_id: w.olid,
      })),
    )
    .select("id, open_library_id");
  check("works", error);
  const uuid = new Map((data ?? []).map((r) => [r.open_library_id!, r.id]));
  await writeDetails(batch.map((work) => ({ work, id: uuid.get(work.olid)! })));
  written += batch.length;
  log(`  works: ${written.toLocaleString()} / ${toInsert.length.toLocaleString()}`);
}

log(`Done. Added ${toInsert.length.toLocaleString()} books${toCorrect.length ? `, fixed ${retitledCount} titles and ${recoveredCount} covers` : ""}${toLink.length ? `, linked ${toLink.length} existing ones to Open Library` : ""}.`);
