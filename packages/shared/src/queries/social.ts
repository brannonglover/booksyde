import type { BooksydeClient } from "../client";

export async function getFeed(client: BooksydeClient, opts: { limit?: number; before?: string } = {}) {
  const { data, error } = await client.rpc("get_feed", {
    max_results: opts.limit ?? 30,
    ...(opts.before ? { before: opts.before } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

export async function getProfileByUsername(client: BooksydeClient, username: string) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Follow a user. Following a private profile creates a pending request. */
export async function follow(client: BooksydeClient, userId: string) {
  const { data, error } = await client.from("follows").insert({ following_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function unfollow(client: BooksydeClient, userId: string) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client.from("follows").delete().match({ follower_id: auth.user.id, following_id: userId });
  if (error) throw error;
}

export async function acceptFollowRequest(client: BooksydeClient, followerId: string) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client
    .from("follows")
    .update({ status: "accepted" })
    .match({ follower_id: followerId, following_id: auth.user.id });
  if (error) throw error;
}

export async function likeReview(client: BooksydeClient, reviewId: string) {
  const { error } = await client.from("review_likes").insert({ review_id: reviewId });
  if (error) throw error;
}

export async function unlikeReview(client: BooksydeClient, reviewId: string) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client.from("review_likes").delete().match({ review_id: reviewId, user_id: auth.user.id });
  if (error) throw error;
}
