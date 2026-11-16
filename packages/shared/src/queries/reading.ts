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

export type DeskBook = {
  work: { id: string; title: string; cover_url: string | null; cover_color: string | null };
  author: string | null;
  /** The page they've logged in their open read-through, or null if they're not tracking it. */
  page: number | null;
  /** Pages in the edition they're holding, else the longest edition we know of. */
  pages: number | null;
  /** When they last logged a page. */
  updatedAt: string | null;
};

/**
 * Every book on the signed-in reader's Reading now shelf, in their shelf order,
 * with their place in each. Tracking a page is optional: untracked books come
 * back with `page: null`.
 */
export async function getMyReadingDesk(client: BooksydeClient): Promise<DeskBook[]> {
  const userId = await requireUserId(client);
  const { data: books, error } = await client
    .from("user_books")
    .select(
      "work_id, editions ( page_count ), works ( id, title, cover_url, cover_color, editions ( page_count ), work_contributors ( role, position, authors ( name ) ) )",
    )
    .match({ user_id: userId, status: "reading" })
    .order("position", { ascending: true, nullsFirst: true })
    .order("shelved_at", { ascending: false });
  if (error) throw error;
  if (!books?.length) return [];

  const { data: sessions, error: sessionError } = await client
    .from("reading_sessions")
    .select("work_id, current_page, finished_at, updated_at")
    .eq("user_id", userId)
    .in(
      "work_id",
      books.map((b) => b.work_id),
    )
    .order("started_at", { ascending: false });
  if (sessionError) throw sessionError;
  // Newest first: only each book's latest read-through counts, and only while it's open.
  const latest = new Map<string, { page: number | null; updatedAt: string }>();
  for (const s of sessions ?? []) {
    if (latest.has(s.work_id)) continue;
    latest.set(s.work_id, { page: s.finished_at ? null : s.current_page, updatedAt: s.updated_at });
  }

  return books.flatMap((b) => {
    const w = b.works;
    if (!w) return [];
    const author =
      [...(w.work_contributors ?? [])]
        .filter((c) => c.role === "author" && c.authors)
        .sort((x, y) => x.position - y.position)[0]?.authors?.name ?? null;
    const longest = Math.max(0, ...(w.editions ?? []).map((e) => e.page_count ?? 0)) || null;
    const session = latest.get(b.work_id);
    return [
      {
        work: { id: w.id, title: w.title, cover_url: w.cover_url, cover_color: w.cover_color },
        author,
        page: session?.page ?? null,
        pages: b.editions?.page_count || longest,
        updatedAt: session?.page != null ? session.updatedAt : null,
      },
    ];
  });
}

/** The shelves a reader can put in their own order. Every other shelf is newest first. */
export const ARRANGEABLE_SHELVES: readonly ReadingStatus[] = ["reading", "want_to_read"];

/**
 * Save the reader's order for one of their shelves, front to back. Pass null to
 * put the shelf back in date-added order. Books on the shelf that aren't in
 * `workIds` go to the front, newest added first.
 */
export async function arrangeShelf(client: BooksydeClient, status: ReadingStatus, workIds: string[] | null) {
  const { error } = await client.rpc("arrange_shelf", { p_status: status, p_work_ids: workIds ?? [] });
  if (error) throw error;
}

export type ShelfMove = "front" | "earlier" | "later" | "end";

/** `ids` with the book at `index` moved one step or to either end. Unchanged when it can't move that way. */
export function moveOnShelf<T>(ids: readonly T[], index: number, move: ShelfMove): T[] {
  const to = move === "front" ? 0 : move === "end" ? ids.length - 1 : index + (move === "earlier" ? -1 : 1);
  return moveTo(ids, index, to);
}

/** `ids` with the item at `from` moved to `to` (clamped to the list). */
export function moveTo<T>(ids: readonly T[], from: number, to: number): T[] {
  const next = [...ids];
  const target = Math.max(0, Math.min(to, ids.length - 1));
  if (from < 0 || from >= ids.length || target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
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
    .select("*, profiles!reviews_user_id_fkey ( username, display_name, avatar_url, theme_color )")
    .eq("work_id", workId)
    .not("body", "is", null)
    .order("likes_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** How many (visible) readers are reading a work now, and how many want to. */
export async function getShelfCounts(client: BooksydeClient, workId: string) {
  const count = async (status: ReadingStatus) => {
    const { count, error } = await client
      .from("user_books")
      .select("*", { count: "exact", head: true })
      .eq("work_id", workId)
      .eq("status", status);
    if (error) throw error;
    return count ?? 0;
  };
  const [reading, wantToRead] = await Promise.all([count("reading"), count("want_to_read")]);
  return { reading, wantToRead };
}

/** The signed-in reader's shelf status for a work, or null (also when signed out). */
export async function getMyReadingStatus(client: BooksydeClient, workId: string): Promise<ReadingStatus | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client
    .from("user_books")
    .select("status")
    .eq("user_id", auth.user.id)
    .eq("work_id", workId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

/** Why a book was chosen as the reader's next read (see the next_read() SQL function). */
export type NextReadReason = "reading" | "series" | "want_to_read" | "taste";

/**
 * The signed-in reader's next read: the book they have open, the next in a
 * series they're reading, their newest Want to Read, or a close match for
 * books they loved. Null when signed out or when nothing fits.
 */
export async function getNextRead(client: BooksydeClient) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data: picks, error: pickError } = await client.rpc("next_read");
  if (pickError) throw pickError;
  const pick = picks?.[0];
  if (!pick) return null;

  const { data: work, error } = await client
    .from("works")
    .select("id, title, first_published_year, cover_url, cover_color, work_contributors ( role, position, authors ( name ) )")
    .eq("id", pick.work_id)
    .maybeSingle();
  if (error) throw error;
  if (!work) return null;

  const { work_contributors, first_published_year, ...rest } = work;
  const author =
    [...work_contributors].filter((c) => c.role === "author").sort((a, b) => a.position - b.position)[0]?.authors
      ?.name ?? "";
  return {
    reason: pick.reason as NextReadReason,
    context: pick.context as string | null,
    work: { ...rest, year: first_published_year, author },
  };
}

export type NextRead = NonNullable<Awaited<ReturnType<typeof getNextRead>>>;

/** The caption's label and a short line saying why this book, shared by web and mobile. */
export function describeNextRead(pick: Pick<NextRead, "reason" | "context">) {
  switch (pick.reason) {
    case "reading":
      return { label: "Keep reading", why: "Pick up where you left off" };
    case "series":
      return { label: "Your next read", why: pick.context ? `Next in ${pick.context}` : "Next in the series" };
    case "want_to_read":
      return { label: "Your next read", why: "From your Want to Read shelf" };
    case "taste":
      return { label: "Your next read", why: pick.context ? `Because you loved ${pick.context}` : "Picked from your reading" };
  }
}
