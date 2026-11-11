import type { BooksydeClient } from "../client";

/** Typo-tolerant title search (Postgres full-text + trigram similarity). */
export async function searchWorks(client: BooksydeClient, query: string, limit = 20) {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await client.rpc("search_works", { q, max_results: limit });
  if (error) throw error;
  return data ?? [];
}

/** A work with its authors, editions and top community tags. */
export async function getWork(client: BooksydeClient, workId: string) {
  const { data, error } = await client
    .from("works")
    .select(
      `*,
       work_contributors ( role, position, authors ( id, name, photo_url ) ),
       editions ( id, isbn_13, format, publisher, published_date, page_count, cover_url ),
       work_tags ( votes, tags ( slug, name, kind ) )`,
    )
    .eq("id", workId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSimilarWorks(client: BooksydeClient, workId: string, limit = 12) {
  const { data, error } = await client.rpc("similar_works", { p_work_id: workId, max_results: limit });
  if (error) throw error;
  return data ?? [];
}

export async function getTrendingWorks(client: BooksydeClient, limit = 20) {
  const { data, error } = await client
    .from("works")
    .select("id, title, cover_url, cover_color, avg_rating, ratings_count")
    .order("shelved_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
