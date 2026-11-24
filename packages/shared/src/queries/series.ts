import type { BooksydeClient } from "../client";
import type { OpenLibrarySeries } from "./open-library";

/*
 * Series: "Morning Star is book 3 of Red Rising". Filed from Open Library,
 * which knows the series and the book's number in it for most popular books.
 */

/** What a work row carries when it embeds `series_works ( position, series ( id, name ) )`. */
type SeriesLinks = { series_works?: { position: number | null; series: { id: string; name: string } | null }[] | null };

export const SERIES_EMBED = "series_works ( position, series ( id, name ) )";

export type BookSeries = { id: string; name: string; position: number | null };

/** The series a work belongs to (a numbered entry wins if there are several), or null. */
export function bookSeries(work: SeriesLinks): BookSeries | null {
  const links = (work.series_works ?? []).filter((l) => l.series);
  const best = links.find((l) => l.position != null) ?? links[0];
  return best?.series ? { id: best.series.id, name: best.series.name, position: best.position == null ? null : Number(best.position) } : null;
}

/** "Book 3 of Red Rising", or "Part of Red Rising" when its number isn't known. */
export function seriesLabel(series: { name: string; position: number | null }) {
  return series.position != null ? `Book ${series.position} of ${series.name}` : `Part of ${series.name}`;
}

/** "Red Rising, no. 3", the way a catalogue card files it. */
export function seriesEntry(series: { name: string; position: number | null }) {
  return series.position != null ? `${series.name}, no. ${series.position}` : series.name;
}

/** The books in a series that we hold, in reading order (unnumbered ones last). */
export async function getSeriesShelf(client: BooksydeClient, seriesId: string) {
  const { data, error } = await client
    .from("series_works")
    .select(
      `position,
       works ( id, title, first_published_year, cover_url, cover_color,
               work_contributors ( role, position, authors ( name ) ) )`,
    )
    .eq("series_id", seriesId);
  if (error) throw error;
  return (data ?? [])
    .flatMap((row) => (row.works ? [{ ...row.works, position: row.position == null ? null : Number(row.position) }] : []))
    .sort(
      (a, b) =>
        (a.position ?? Infinity) - (b.position ?? Infinity) ||
        (a.first_published_year ?? 9999) - (b.first_published_year ?? 9999),
    );
}

export type SeriesShelfBook = Awaited<ReturnType<typeof getSeriesShelf>>[number];

/**
 * Files a work under a series (creating the series the first time it's seen)
 * at its number. Needs a client that may write the catalogue. A series is
 * found by its Open Library id; one only edition records name (no id) is
 * found by name, and a series first filed by name takes the Open Library id
 * when it turns up. A work already filed under that series keeps its row but
 * takes the new number.
 */
export async function fileInSeries(client: BooksydeClient, workId: string, series: OpenLibrarySeries) {
  const seriesId = await findOrCreateSeries(client, series);
  const { error } = await client
    .from("series_works")
    .upsert({ series_id: seriesId, work_id: workId, position: series.position }, { onConflict: "series_id,work_id" });
  if (error) throw error;
  return seriesId;
}

async function findOrCreateSeries(client: BooksydeClient, series: OpenLibrarySeries): Promise<string> {
  const byOlid = () => client.from("series").select("id").eq("open_library_id", series.olid!).maybeSingle();
  if (series.olid) {
    const { data } = await byOlid();
    if (data) return data.id;
  }
  // Same name (case aside): an Open Library series we hold, or one filed by name alone.
  const { data: named } = await client
    .from("series")
    .select("id, open_library_id")
    .ilike("name", series.name.replace(/[%_\\]/g, "\\$&"))
    .order("open_library_id", { nullsFirst: false })
    .limit(5);
  const match = series.olid ? named?.find((s) => s.open_library_id === null) : named?.[0];
  if (match) {
    if (series.olid) await client.from("series").update({ open_library_id: series.olid }).eq("id", match.id);
    return match.id;
  }
  const created = await client.from("series").insert({ name: series.name, open_library_id: series.olid }).select("id").single();
  if (!created.error) return created.data.id;
  // Filed a moment ago by someone else.
  const again = series.olid ? await byOlid() : null;
  if (again?.data) return again.data.id;
  throw created.error;
}
