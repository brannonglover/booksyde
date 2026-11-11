import type { ReadingStatus } from "@booksyde/types";
import type { BooksydeClient } from "../client";
import { reviewInputSchema, type ReviewInput } from "../schemas/review";

async function requireUserId(client: BooksydeClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

/** Put a book on one of the status shelves (or move it between them). */
export async function setReadingStatus(client: BooksydeClient, workId: string, status: ReadingStatus) {
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("user_books")
    .upsert({ user_id: userId, work_id: workId, status }, { onConflict: "user_id,work_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeFromShelves(client: BooksydeClient, workId: string) {
  const userId = await requireUserId(client);
  const { error } = await client.from("user_books").delete().match({ user_id: userId, work_id: workId });
  if (error) throw error;
}

export async function getMyBooks(client: BooksydeClient, status?: ReadingStatus) {
  const userId = await requireUserId(client);
  let query = client
    .from("user_books")
    .select("status, started_at, finished_at, works ( id, title, cover_url, cover_color, avg_rating )")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Create or update the signed-in user's review of a work. */
export async function upsertReview(client: BooksydeClient, input: ReviewInput) {
  const parsed = reviewInputSchema.parse(input);
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("reviews")
    .upsert(
      {
        user_id: userId,
        work_id: parsed.workId,
        edition_id: parsed.editionId ?? null,
        rating: parsed.rating ?? null,
        body: parsed.body ?? null,
        has_spoilers: parsed.hasSpoilers,
      },
      { onConflict: "user_id,work_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWorkReviews(client: BooksydeClient, workId: string, limit = 20) {
  const { data, error } = await client
    .from("reviews")
    .select("*, profiles ( username, display_name, avatar_url, theme_color )")
    .eq("work_id", workId)
    .not("body", "is", null)
    .order("likes_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
