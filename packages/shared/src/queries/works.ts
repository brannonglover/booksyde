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

/**
 * Picks drawn from a whole shelf at once: every tag on the seed books gets a
 * weight (how many seeds carry it, times their votes), and each other book
 * scores the weights of the tags it shares. Books in `exclude` never come back.
 */
export async function getPicksFromShelf(
  client: BooksydeClient,
  { seeds, exclude, limit = 6 }: { seeds: string[]; exclude: Iterable<string>; limit?: number },
) {
  if (seeds.length === 0) return [];
  const { data: seedTags, error: seedError } = await client
    .from("work_tags")
    .select("tag_id, votes")
    .in("work_id", seeds)
    .gt("votes", 0);
  if (seedError) throw seedError;
  const weights = new Map<string, number>();
  for (const t of seedTags ?? []) weights.set(t.tag_id, (weights.get(t.tag_id) ?? 0) + t.votes);
  if (weights.size === 0) return [];

  const { data: overlaps, error } = await client
    .from("work_tags")
    .select("tag_id, votes, works!inner ( id, title, cover_url, cover_color, avg_rating, ratings_count )")
    .in("tag_id", [...weights.keys()])
    .gt("votes", 0);
  if (error) throw error;

  const skip = new Set(exclude);
  const scores = new Map<string, { work: NonNullable<typeof overlaps>[number]["works"]; score: number }>();
  for (const row of overlaps ?? []) {
    if (skip.has(row.works.id)) continue;
    const entry = scores.get(row.works.id) ?? { work: row.works, score: 0 };
    entry.score += (weights.get(row.tag_id) ?? 0) * row.votes;
    scores.set(row.works.id, entry);
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || Number(b.work.avg_rating) - Number(a.work.avg_rating))
    .slice(0, limit)
    .map((s) => s.work);
}

/**
 * What a reader's shelf says about them: the authors they read most, their
 * strongest genres, and a loose identity (title + author) for every book on it.
 * Only books in `focus` (default: all) count towards authors and genres.
 */
export async function getShelfProfile(client: BooksydeClient, workIds: string[], focus?: Iterable<string>) {
  if (workIds.length === 0) return { authors: [], genres: [], titles: [] };
  const [contributors, tags, works] = await Promise.all([
    client.from("work_contributors").select("work_id, position, authors ( name )").in("work_id", workIds).eq("role", "author"),
    client.from("work_tags").select("work_id, votes, tags ( slug, kind )").in("work_id", workIds).gt("votes", 0),
    client.from("works").select("id, title").in("id", workIds),
  ]);
  if (contributors.error) throw contributors.error;
  if (tags.error) throw tags.error;
  if (works.error) throw works.error;

  const counts = new Set(focus ?? workIds);
  const authorCounts = new Map<string, number>();
  const lead = new Map<string, { name: string; position: number }>();
  for (const c of contributors.data ?? []) {
    if (!c.authors) continue;
    if (counts.has(c.work_id)) authorCounts.set(c.authors.name, (authorCounts.get(c.authors.name) ?? 0) + 1);
    const current = lead.get(c.work_id);
    if (!current || c.position < current.position) lead.set(c.work_id, { name: c.authors.name, position: c.position });
  }
  const genreWeights = new Map<string, number>();
  for (const t of tags.data ?? []) {
    if (!t.tags || t.tags.kind !== "genre" || !counts.has(t.work_id)) continue;
    genreWeights.set(t.tags.slug, (genreWeights.get(t.tags.slug) ?? 0) + t.votes);
  }
  const ranked = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return {
    /** Most-read first. */
    authors: ranked(authorCounts),
    /** Genre tag slugs, strongest first. */
    genres: ranked(genreWeights),
    titles: (works.data ?? []).map((w) => ({ title: w.title, author: lead.get(w.id)?.name ?? null })),
  };
}
