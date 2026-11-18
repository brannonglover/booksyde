import type { BooksydeClient } from "../client";

export type CatalogQuery = {
  /** Free text: a title, author, ISBN or subject. */
  q?: string;
  /** Tag slugs the book must carry (moods, genres…). */
  tags?: string[];
  limit?: number;
};

/** Strip characters that would break a PostgREST `or=(…)` filter or act as wildcards. */
function safeTerm(q: string) {
  return q.replace(/[%*,()\\"]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Books matching the query (titles, authors, ISBNs and subjects, typo-tolerant),
 * each with its authors and tags, best match first. With no text it browses
 * everything carrying the chosen tags.
 */
export async function searchCatalog(client: BooksydeClient, { q = "", tags = [], limit = 30 }: CatalogQuery) {
  const { data, error } = await client
    .rpc("search_catalog", { q: q.trim(), tag_slugs: tags, max_results: limit })
    .select(
      `id, title, subtitle, description, first_published_year, cover_url, cover_color, avg_rating, ratings_count, shelved_count,
       work_contributors ( role, position, authors ( id, name, birth_date, death_date ) ),
       work_tags ( votes, tags ( slug, name, kind ) ),
       series_works ( position, series ( id, name ) )`,
    );
  if (error) throw error;
  return data ?? [];
}

export type CatalogBook = Awaited<ReturnType<typeof searchCatalog>>[number];

/** Authors by name (typo- and accent-tolerant), with how many of their books we hold. */
export async function searchAuthors(client: BooksydeClient, query: string, limit = 6) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await client.rpc("search_authors", { q, max_results: limit });
  if (error) throw error;
  return data ?? [];
}

/** Readers whose username or name contains the query. */
export async function searchReaders(client: BooksydeClient, query: string, limit = 6) {
  const q = safeTerm(query).replace(/^@/, "");
  if (q.length < 2) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme_color, is_private, followers_count")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order("followers_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Every subject "drawer" with how many books are filed in it. */
export async function getTagDrawers(client: BooksydeClient) {
  const { data, error } = await client.rpc("tag_drawer_counts");
  if (error) throw error;
  return data ?? [];
}

/** One line on what each mood or genre feels like, for the browse cards. */
export const tagBlurbs: Record<string, string> = {
  adventurous: "Maps, quests and far-off places",
  cozy: "Small towns and warm kitchens",
  dark: "Unsettling, grim, a little haunted",
  emotional: "Keep the tissues close",
  funny: "Laugh-out-loud reads",
  hopeful: "Leaves you lighter than before",
  mysterious: "Secrets worth untangling",
  reflective: "Quiet, slow and thoughtful",
  tense: "Can’t-put-it-down pace",
  biography: "Real lives, closely told",
  classics: "The ones that stuck around",
  fantasy: "Magic, myth and other worlds",
  gothic: "Old houses, older secrets",
  "historical-fiction": "Stories set in another time",
  horror: "Read with the lights on",
  "literary-fiction": "Character-driven and beautifully written",
  mystery: "Clues, suspects and a twist",
  "non-fiction": "True stories and big ideas",
  poetry: "Small words, big feelings",
  romance: "Falling, longing, together at last",
  "science-fiction": "Futures, space and what-ifs",
  thriller: "Danger on every page",
  "young-adult": "Coming of age, with high stakes",
};

export type DrawerCover = { id: string; title: string; cover_url: string | null; cover_color: string | null };

/**
 * The mood and genre drawers with the covers of a few of their most-shelved
 * books, for browse previews. Popular books carry many tags, so each drawer
 * prefers covers no earlier drawer is already showing. A drawer whose covers
 * can't be fetched comes back without any.
 */
export async function getBrowseDrawers(client: BooksydeClient, coversPer = 3) {
  const drawers = (await getTagDrawers(client)).filter((d) => d.kind === "mood" || d.kind === "genre");
  const candidates = await Promise.all(
    drawers.map(async (d) => {
      if (d.works === 0) return [] as DrawerCover[];
      const { data } = await client
        .rpc("search_catalog", { q: "", tag_slugs: [d.slug], max_results: coversPer * 4 })
        .select("id, title, cover_url, cover_color");
      return ((data ?? []) as DrawerCover[]).filter((c) => c.cover_url);
    }),
  );
  const shown = new Set<string>();
  return drawers.map((d, i) => {
    const fresh = candidates[i].filter((c) => !shown.has(c.id));
    const covers = [...fresh, ...candidates[i].filter((c) => shown.has(c.id))].slice(0, coversPer);
    for (const c of covers) shown.add(c.id);
    return { ...d, covers };
  });
}

export type BrowseDrawer = Awaited<ReturnType<typeof getBrowseDrawers>>[number];

/** A short library-style call number for a book, e.g. "AUS · 1813". */
export function callNumber(book: { title: string; first_published_year: number | null }, author?: string | null) {
  const surname = author?.trim().split(/\s+/).pop() ?? book.title.replace(/^(the|a|an)\s+/i, "");
  const letters = surname
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return book.first_published_year ? `${letters} · ${book.first_published_year}` : letters;
}

/** "Jane Austen" → "Austen, Jane", the way a catalogue files it. */
export function catalogName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}`;
}

/** "1775–1817" from ISO dates; "1934–" for the living; "" when unknown. */
export function lifeYears(birth: string | null, death: string | null) {
  if (!birth) return "";
  return `${birth.slice(0, 4)}–${death ? death.slice(0, 4) : ""}`;
}
