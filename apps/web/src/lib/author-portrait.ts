/*
 * A portrait for an author Open Library has no photo of, from Wikimedia
 * Commons by way of Wikidata (no key needed).
 *
 * Wikidata's item for the author is found by their Open Library ID when it
 * records one, and otherwise by exact name, but only when exactly one person
 * of that name is a writer, so a namesake's photo never ends up on the page.
 * Commons photos are freely licensed but most need crediting (CC BY, CC BY-SA),
 * so each comes with the photographer, the licence and the file's Commons page.
 *
 * Uses Wikidata's search and entity APIs rather than its query service, which
 * times out on a lookup by name.
 */

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" }, cache: "no-store" as const };
/** Wide enough for the author page's 192px circle on a 2x screen; a size Commons keeps ready. */
const WIDTH = 500;

/** Occupations that make someone the author we mean (Wikidata IDs). */
const WRITERS = new Set([
  "Q36180", // writer
  "Q6625963", // novelist
  "Q482980", // author
  "Q4853732", // children's writer
  "Q49757", // poet
  "Q18844224", // science fiction writer
  "Q1930187", // journalist
  "Q28389", // screenwriter
  "Q11774202", // essayist
  "Q15949613", // short story writer
  "Q214917", // playwright
  "Q12144794", // prose writer
]);
const HUMAN = "Q5";
/** Licences that let us show the photo: public domain, CC0, CC BY and CC BY-SA (by Commons' licence codes). */
const FREE_LICENCE = /^(pd\b|cc0|cc-by-(sa-)?\d)/i;
/** Commons serves its images from these hosts only. */
const COMMONS_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

export type Portrait = { url: string; credit: string; creditUrl: string };

type Claim = { mainsnak: { datavalue?: { value: unknown } } };
type Entity = { id: string; labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]>; claims?: Record<string, Claim[]> };

async function get<T>(base: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${base}?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${new URL(base).hostname} HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** "J.K. Rowling" and "J. K. Rowling" are the same person. */
const nameKey = (name: string) => name.normalize("NFD").toLowerCase().replace(/[^\p{L}]/gu, "");

const values = (e: Entity, property: string) =>
  (e.claims?.[property] ?? []).map((c) => c.mainsnak.datavalue?.value).filter((v) => v !== undefined);
const itemIds = (e: Entity, property: string) => values(e, property).map((v) => (v as { id?: string }).id).filter(Boolean);

async function entities(ids: string[]) {
  if (!ids.length) return [];
  const body = await get<{ entities: Record<string, Entity> }>(WIKIDATA, {
    action: "wbgetentities",
    ids: ids.slice(0, 50).join("|"),
    props: "labels|aliases|claims",
    languages: "en",
  });
  return Object.values(body.entities);
}

/** The Wikidata item for an author, or null if there's none we can be sure of. */
async function findAuthor(name: string, openLibraryId: string | null): Promise<Entity | null> {
  if (openLibraryId) {
    const byOl = await get<{ query: { search: { title: string }[] } }>(WIKIDATA, {
      action: "query",
      list: "search",
      srsearch: `haswbstatement:P648=${openLibraryId}`,
      srlimit: "2",
    });
    const hits = byOl.query.search.map((s) => s.title);
    // Two items claiming one Open Library author is a mess we stay out of.
    if (hits.length === 1) return (await entities(hits))[0] ?? null;
  }

  const found = await get<{ search: { id: string }[] }>(WIKIDATA, {
    action: "wbsearchentities",
    search: name,
    language: "en",
    type: "item",
    limit: "10",
  });
  const key = nameKey(name);
  const writers = (await entities(found.search.map((s) => s.id))).filter((e) => {
    const names = [e.labels?.en?.value, ...(e.aliases?.en ?? []).map((a) => a.value)].filter(Boolean) as string[];
    if (!names.some((n) => nameKey(n) === key)) return false;
    if (!itemIds(e, "P31").includes(HUMAN) || !itemIds(e, "P106").some((o) => WRITERS.has(o!))) return false;
    // Wikidata ties them to a different Open Library author: a namesake.
    const theirOl = values(e, "P648") as string[];
    return !(openLibraryId && theirOl.length && !theirOl.includes(openLibraryId));
  });
  return writers.length === 1 ? writers[0] : null;
}

/** Commons' credit fields are HTML ("<a href=…>DavidPMaynard</a>"); just the words. */
function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ImageInfo = {
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string } | undefined>;
};

/** A Commons file as a portrait we may show, or null if it isn't freely licensed. */
async function commonsPortrait(file: string): Promise<Portrait | null> {
  const body = await get<{ query?: { pages?: { imageinfo?: ImageInfo[] }[] } }>(COMMONS, {
    action: "query",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(WIDTH),
  });
  const info = body.query?.pages?.[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const licence = meta.License?.value ?? "";
  if (!info?.thumburl || !info.descriptionurl || !FREE_LICENCE.test(licence)) return null;
  const url = new URL(info.thumburl);
  if (url.protocol !== "https:" || !COMMONS_HOSTS.has(url.hostname)) return null;
  url.search = "";
  const artist = plain(meta.Artist?.value ?? "").slice(0, 80) || "Wikimedia Commons";
  const shortName = plain(meta.LicenseShortName?.value ?? "") || licence.toUpperCase();
  return { url: url.toString(), credit: `${artist}, ${shortName}`, creditUrl: info.descriptionurl };
}

/** A freely licensed portrait of the author from Wikimedia Commons, or null if there's none we can be sure is them. */
export async function findAuthorPortrait(name: string, openLibraryId: string | null): Promise<Portrait | null> {
  const author = await findAuthor(name, openLibraryId);
  const file = author ? (values(author, "P18")[0] as string | undefined) : undefined;
  return file ? commonsPortrait(file) : null;
}
