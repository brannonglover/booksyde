import type { BooksydeClient } from "../client";

export type YearSpine = {
  workId: string;
  title: string;
  pages: number | null;
  /** The book's most-voted genre, for colouring its spine. */
  genre: string | null;
};

export type YearInBooks = {
  year: number;
  /** Whose year this is: the signed-in reader's, or everyone's on Booksyde. */
  scope: "mine" | "everyone";
  books: number;
  pages: number;
  /** The most recently finished books, newest first. */
  spines: YearSpine[];
};

/** Finished books are only fetched up to this many; past it, page totals undercount. */
const ROW_LIMIT = 1000;

/**
 * Books finished this calendar year (UTC) and the pages in them, plus a spine
 * for each recent one. With a `userId`, that reader's year; without, everyone's
 * (only readers the viewer may see, per row-level security).
 */
export async function getYearInBooks(
  client: BooksydeClient,
  { userId, spines: spineCount = 60 }: { userId?: string | null; spines?: number } = {},
): Promise<YearInBooks> {
  const year = new Date().getUTCFullYear();
  let query = client
    .from("user_books")
    .select(
      "finished_at, works ( id, title, editions ( page_count ), work_tags ( votes, tags ( slug, kind ) ) )",
      { count: "exact" },
    )
    .eq("status", "read")
    .gte("finished_at", `${year}-01-01T00:00:00Z`)
    .order("finished_at", { ascending: false })
    .limit(ROW_LIMIT);
  if (userId) query = query.eq("user_id", userId);
  const { data, count, error } = await query;
  if (error) throw error;

  const finished = (data ?? []).flatMap((row) => (row.works ? [row.works] : []));
  const spines: YearSpine[] = finished.map((w) => {
    const counts = w.editions.map((e) => e.page_count).filter((n): n is number => n != null);
    const genre = w.work_tags
      .filter((t) => t.votes > 0 && t.tags.kind === "genre")
      .sort((a, b) => b.votes - a.votes)[0]?.tags.slug;
    return { workId: w.id, title: w.title, pages: counts.length ? Math.max(...counts) : null, genre: genre ?? null };
  });

  return {
    year,
    scope: userId ? "mine" : "everyone",
    books: count ?? spines.length,
    pages: spines.reduce((sum, s) => sum + (s.pages ?? 0), 0),
    spines: spines.slice(0, spineCount),
  };
}
