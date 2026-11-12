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
       work_tags ( votes, tags ( slug, name, kind ) )`,
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
    .select("id, username, display_name, bio, theme_color, is_private, followers_count")
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
