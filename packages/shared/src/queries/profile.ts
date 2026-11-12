import type { ReadingStatus } from "@booksyde/types";
import type { BooksydeClient } from "../client";
import { type ProfileUpdate, profileUpdateSchema } from "../schemas/profile";

export type ProfileStats = {
  read: number;
  reading: number;
  wantToRead: number;
  pages: number;
  ratings: number;
  averageRating: number | null;
  moods: { slug: string; name: string; weight: number }[];
  genres: { slug: string; name: string; weight: number }[];
};

/** Shelf counts, pages read, ratings given, and the moods/genres of what they've read. */
export async function getProfileStats(client: BooksydeClient, userId: string): Promise<ProfileStats> {
  const { data, error } = await client.rpc("profile_stats", { p_user_id: userId });
  if (error) throw error;
  return data as unknown as ProfileStats;
}

/** Everything on the reader's status shelves, newest first, grouped by shelf. */
export async function getProfileShelves(client: BooksydeClient, userId: string, limit = 120) {
  const { data, error } = await client
    .from("user_books")
    .select("status, updated_at, works ( id, title, cover_url, cover_color, avg_rating )")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const shelves: Record<ReadingStatus, NonNullable<(typeof data)[number]["works"]>[]> = {
    reading: [],
    want_to_read: [],
    read: [],
    did_not_finish: [],
  };
  for (const row of data ?? []) if (row.works) shelves[row.status].push(row.works);
  return shelves;
}

/** The reader's written reviews, with the book each one is about. */
export async function getUserReviews(client: BooksydeClient, userId: string, limit = 10) {
  const { data, error } = await client
    .from("reviews")
    .select("id, rating, body, has_spoilers, likes_count, created_at, works ( id, title, cover_url, cover_color )")
    .eq("user_id", userId)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type FollowState = "signed-out" | "self" | "none" | "pending" | "following";

/** Where the signed-in reader stands with `targetId`. */
export async function getFollowState(client: BooksydeClient, targetId: string): Promise<FollowState> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return "signed-out";
  if (auth.user.id === targetId) return "self";
  const { data, error } = await client
    .from("follows")
    .select("status")
    .match({ follower_id: auth.user.id, following_id: targetId })
    .maybeSingle();
  if (error) throw error;
  if (!data) return "none";
  return data.status === "accepted" ? "following" : "pending";
}

/** Update the signed-in reader's own profile (only the columns readers may change). */
export async function updateMyProfile(client: BooksydeClient, input: ProfileUpdate) {
  const parsed = profileUpdateSchema.parse(input);
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { data, error } = await client.from("profiles").update(parsed).eq("id", auth.user.id).select().single();
  if (error) throw error;
  return data;
}
