"use server";

import { goodreadsBatchSchema } from "@booksyde/shared";
import type { Json } from "@booksyde/types";
import { revalidateTag } from "next/cache";
import { resolveGoodreadsBook } from "@/lib/goodreads-import";
import { canImportBooks } from "@/lib/open-library-import";
import { createClient } from "@/lib/supabase/server";

export type RowOutcome = "added" | "updated" | "unchanged" | "not_found" | "error";
export type BatchResult =
  | { ok: true; rows: { outcome: RowOutcome; workId: string | null }[] }
  | { ok: false; error: "signed-out" | "invalid" | "unavailable" | "failed" };

/** Run async work over items, a few at a time (Open Library asks for gentle traffic). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const noon = (date: string | null) => (date ? `${date}T12:00:00Z` : undefined);

/** Match a batch of Goodreads rows to catalogue works and put them on the reader's shelves. */
export async function importGoodreadsBatch(input: unknown): Promise<BatchResult> {
  const parsed = goodreadsBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { books, includeReviews } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "signed-out" };
  if (!canImportBooks) return { ok: false, error: "unavailable" };

  const workIds = await mapLimit(books, 3, (book) =>
    resolveGoodreadsBook(book).catch((e) => {
      console.error("Goodreads match failed", book.title, e);
      return undefined;
    }),
  );

  const matched = books.flatMap((book, i) => {
    const workId = workIds[i];
    if (!workId) return [];
    const item = {
      work_id: workId,
      status: book.status,
      finished_at: noon(book.finishedOn),
      added_at: noon(book.addedOn),
      shelves: book.shelves,
      ...(includeReviews && (book.rating || book.review)
        ? { rating: book.rating ?? undefined, review: book.review ?? undefined, has_spoilers: book.hasSpoilers }
        : {}),
    };
    return [{ index: i, item }];
  });

  const rows: { outcome: RowOutcome; workId: string | null }[] = workIds.map((id) => ({
    outcome: id === undefined ? "error" : "not_found",
    workId: id ?? null,
  }));

  if (matched.length) {
    const { data, error } = await supabase.rpc("import_reading_history", {
      p_items: matched.map((m) => m.item) as unknown as Json,
    });
    if (error) {
      console.error("Goodreads import failed", error);
      return { ok: false, error: "failed" };
    }
    data.forEach((row, n) => {
      rows[matched[n].index] = { outcome: row.outcome as RowOutcome, workId: row.work_id };
    });
  }

  // New books in the catalogue, and new ratings on book pages.
  revalidateTag("catalog-search", "max");
  revalidateTag("catalog-drawers", "max");
  revalidateTag("nightstand", "max");
  for (const m of matched) if (m.item.rating || m.item.review) revalidateTag(`work:${m.item.work_id}`, "max");

  return { ok: true, rows };
}
