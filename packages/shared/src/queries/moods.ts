import type { BooksydeClient } from "../client";

/** How many moods one reader can pick for a book: enough to be nuanced, few enough to mean something. */
export const MAX_MOOD_VOTES = 3;

export type MoodTag = { id: string; slug: string; name: string };

/** Every mood readers can vote for, in name order. */
export async function getMoodTags(client: BooksydeClient): Promise<MoodTag[]> {
  const { data, error } = await client.from("tags").select("id, slug, name").eq("kind", "mood").order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * Readers' mood votes on a book: how many each mood has, and which ones the
 * signed-in reader picked (none when signed out).
 */
export async function getMoodVotes(client: BooksydeClient, workId: string, moods: MoodTag[]) {
  const ids = moods.map((m) => m.id);
  const [{ data: auth }, { data, error }] = await Promise.all([
    client.auth.getUser(),
    client.from("tag_votes").select("user_id, tag_id").eq("work_id", workId).in("tag_id", ids),
  ]);
  if (error) throw error;
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const v of data ?? []) {
    counts[v.tag_id] = (counts[v.tag_id] ?? 0) + 1;
    if (auth.user && v.user_id === auth.user.id) mine.push(v.tag_id);
  }
  return { counts, mine, signedIn: Boolean(auth.user) };
}

/** Add or take back the signed-in reader's vote for one mood on a book. */
export async function setMoodVote(client: BooksydeClient, workId: string, tagId: string, on: boolean) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = on
    ? await client.from("tag_votes").insert({ user_id: auth.user.id, work_id: workId, tag_id: tagId })
    : await client.from("tag_votes").delete().eq("user_id", auth.user.id).eq("work_id", workId).eq("tag_id", tagId);
  // Voting twice (a double tap, two tabs) is still a vote.
  if (error && error.code !== "23505") throw error;
}
