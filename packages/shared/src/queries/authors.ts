import type { BooksydeClient } from "../client";
import type { NewsItem } from "./news";

/*
 * Authors: their page (bio, books, news) and following them. A follow is
 * private to the reader; everyone sees only how many readers follow.
 */

/** An author and the books they wrote that we hold, most-shelved first. Null if there's no such author. */
export async function getAuthor(client: BooksydeClient, authorId: string) {
  const { data, error } = await client
    .from("authors")
    .select(
      `id, name, bio, photo_url, photo_credit, photo_credit_url, birth_date, death_date, followers_count,
       work_contributors ( role, works ( id, title, first_published_year, cover_url, cover_color, avg_rating, ratings_count, shelved_count ) )`,
    )
    .eq("id", authorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { work_contributors, ...author } = data;
  const seen = new Set<string>();
  const books = (work_contributors ?? [])
    .filter((c) => c.role === "author" && c.works)
    .map((c) => c.works!)
    // One row per book, even if the catalogue files them twice (say, author and editor).
    .filter((w) => !seen.has(w.id) && Boolean(seen.add(w.id)))
    .sort(
      (a, b) =>
        b.shelved_count - a.shelved_count ||
        (b.first_published_year ?? 0) - (a.first_published_year ?? 0) ||
        a.title.localeCompare(b.title),
    );
  return { ...author, books };
}

export type AuthorPage = NonNullable<Awaited<ReturnType<typeof getAuthor>>>;
export type AuthorBook = AuthorPage["books"][number];

/** The author's current stories (releases, headlines, prizes, adaptations), newest first. Empty if they can't be read. */
export async function getAuthorNews(client: BooksydeClient, authorId: string, limit = 6): Promise<NewsItem[]> {
  const { data, error } = await client.rpc("author_news", { target: authorId, max_results: limit });
  if (error) {
    console.warn("Author news unavailable", error.message);
    return [];
  }
  return data ?? [];
}

/** Whether the signed-in reader follows this author; null when signed out. */
export async function getAuthorFollowState(client: BooksydeClient, authorId: string): Promise<boolean | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client
    .from("author_follows")
    .select("author_id")
    .match({ user_id: auth.user.id, author_id: authorId })
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** How many readers follow this author, fresh from the database (pages may cache the author). */
export async function getAuthorFollowersCount(client: BooksydeClient, authorId: string) {
  const { data, error } = await client.from("authors").select("followers_count").eq("id", authorId).maybeSingle();
  if (error) throw error;
  return data?.followers_count ?? 0;
}

/** Follow an author, to hear about their new books and news. Following twice is harmless. */
export async function followAuthor(client: BooksydeClient, authorId: string) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client
    .from("author_follows")
    .upsert({ user_id: auth.user.id, author_id: authorId }, { onConflict: "user_id,author_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unfollowAuthor(client: BooksydeClient, authorId: string) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client.from("author_follows").delete().match({ user_id: auth.user.id, author_id: authorId });
  if (error) throw error;
}
