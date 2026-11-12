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
       work_contributors ( role, position, authors ( id, name, photo_url, bio, birth_date, death_date ) ),
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

/** How many ratings a work has at each star level, 5 → 1 (half stars round down). */
export async function getRatingDistribution(client: BooksydeClient, workId: string) {
  const { data, error } = await client.rpc("work_rating_distribution", { p_work_id: workId });
  if (error) throw error;
  return data ?? [];
}

/**
 * "More like this": embedding similarity when embeddings exist, otherwise the
 * works that share the most community tags (weighted by votes).
 */
export async function getMoreLikeThis(client: BooksydeClient, workId: string, limit = 6) {
  const similar = await getSimilarWorks(client, workId, limit);
  if (similar.length > 0) return similar;

  const { data: own, error: ownError } = await client.from("work_tags").select("tag_id").eq("work_id", workId);
  if (ownError) throw ownError;
  const tagIds = (own ?? []).map((t) => t.tag_id);
  if (tagIds.length === 0) return [];

  const { data: overlaps, error } = await client
    .from("work_tags")
    .select("votes, works!inner ( * )")
    .in("tag_id", tagIds)
    .neq("work_id", workId);
  if (error) throw error;

  const scores = new Map<string, { work: (typeof overlaps)[number]["works"]; score: number }>();
  for (const row of overlaps ?? []) {
    const entry = scores.get(row.works.id) ?? { work: row.works, score: 0 };
    entry.score += row.votes;
    scores.set(row.works.id, entry);
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.work);
}
