import "server-only";

import { createBooksydeClient, type EditionCover, getEditionCovers } from "@booksyde/shared";
import { type CoverSource, GOOD_HEIGHT, inspectCover, pickCover } from "./covers";
import { supabaseUrl } from "./supabase/env";

/*
 * The daily cover job (/api/cron/covers): works through the catalogue looking
 * for a better cover for each book, so every book ends up with the best one
 * we can find, not just whatever it had when it was added. Most-shelved books
 * first, never-checked before longest-ago, so what readers see improves first
 * and the whole catalogue comes round again in time.
 *
 * It only ever upgrades: the publisher's art from Google Books when it checks
 * out, or, for a cover too small to look sharp, a clearly larger one from
 * another Open Library edition. It never
 * clears a cover or touches a hand-picked one (cover_source 'manual'), and a
 * pale, minimal design that the checks call "blank" is only replaced by the
 * publisher's own art.
 *
 * Google's daily quota is the limit: once Google refuses, the run stops and
 * the rest wait for tomorrow, rather than being marked checked without it.
 */

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
export const canRefreshCovers = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: only for cover updates whose images came from Google Books and Open Library. */
function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const init = { headers: { "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" }, cache: "no-store" as const };
/**
 * Another Open Library edition's cover replaces a working one only when the current one is too small
 * to look sharp (under GOOD_HEIGHT) and the other is this much taller: swapping editions can trade a
 * familiar design for a different one, which isn't worth it for size alone.
 */
const MUCH_BIGGER = 1.25;
/** Books looked at a few at a time: Open Library refuses bursts. */
const CONCURRENCY = 4;
const PAGE = 40;

type Work = {
  id: string;
  title: string;
  cover_url: string | null;
  cover_source: CoverSource | "manual" | null;
  open_library_id: string | null;
  editions: { isbn_13: string | null }[];
};

export type CoverRunResult = { checked: number; upgraded: number; found: number; kept: number; skipped: number; stoppedBy: string | null };

/** Whether an error from Google means "no more today" (quota or rate limit) rather than a one-off. */
const isQuota = (e: unknown) => /\((429|403)\)/.test(String(e));

export async function refreshCovers({
  budgetMs = 240_000,
  googleKey = process.env.GOOGLE_BOOKS_API_KEY,
  limit = Infinity,
  apply = true,
}: { budgetMs?: number; googleKey?: string; limit?: number; apply?: boolean } = {}): Promise<CoverRunResult & { changes: string[] }> {
  const db = adminClient();
  const deadline = Date.now() + budgetMs;
  const result: CoverRunResult = { checked: 0, upgraded: 0, found: 0, kept: 0, skipped: 0, stoppedBy: null };
  const changes: string[] = [];
  const stop = (why: string) => (result.stoppedBy ??= why);
  const going = () => !result.stoppedBy && Date.now() < deadline && result.checked + result.skipped < limit;

  /** One book: its best cover, and whether we could judge it today. */
  async function check(work: Work): Promise<void> {
    let googleRefused = false;
    const current = work.cover_url ? await inspectCover(work.cover_url, init) : null;
    // Open Library busy or down: we can't tell how good the current cover is, so try again another day.
    if (current && !current.ok && /^HTTP (429|5\d\d)$|^download failed$/.test(current.reason)) {
      result.skipped++;
      if (current.reason.startsWith("HTTP 429")) stop("Open Library rate limit");
      return;
    }

    const currentId = Number(work.cover_url?.match(/covers\.openlibrary\.org\/b\/id\/(\d+)-/)?.[1]) || null;
    const editions: EditionCover[] = work.open_library_id
      ? await getEditionCovers(work.open_library_id, work.title, currentId, init).catch(() => [])
      : [];
    const picked = await pickCover({
      isbns: work.editions.map((e) => e.isbn_13),
      editions,
      googleKey,
      init,
      onGoogleError: (e) => {
        if (isQuota(e)) googleRefused = true;
      },
    });
    if (googleRefused) {
      // Not checked: it gets Google's look tomorrow.
      result.skipped++;
      stop("Google Books quota");
      return;
    }

    let better = false;
    if (picked && picked.url !== work.cover_url) {
      if (!current) better = true; // No cover at all.
      else if (!current.ok) {
        // Broken, a placeholder or a blank page: anything that passes is better. A pale design ("blank") only gives way to the publisher's.
        better = current.reason !== "blank" || picked.source === "google_books";
      } else {
        better =
          (picked.source === "google_books" && work.cover_source !== "google_books") ||
          (current.height < GOOD_HEIGHT && picked.height >= current.height * MUCH_BIGGER);
      }
    }

    const now = new Date().toISOString();
    if (better && picked) {
      result[work.cover_url ? "upgraded" : "found"]++;
      const was = current ? (current.ok ? `${current.width}×${current.height}` : current.reason) : "none";
      changes.push(`${work.title.slice(0, 40)}: ${was} → ${picked.source} ${picked.width}×${picked.height} ${picked.url}`);
    } else {
      result.kept++;
    }
    result.checked++;
    if (!apply) return;
    const { error } = await db
      .from("works")
      .update(better && picked ? { cover_url: picked.url, cover_source: picked.source, cover_checked_at: now } : { cover_checked_at: now })
      .eq("id", work.id);
    if (error) throw error;
  }

  // Pages of the longest-waiting books, a few at a time, until the time, the quota or the limit runs out.
  // Checked books are marked and move to the back; skipped ones aren't, so each page starts after them.
  // A dry run marks nothing, so it reads on by page.
  for (let page = 0; going(); page++) {
    const from = apply ? result.skipped : page * PAGE;
    const { data, error } = await db
      .from("works")
      .select("id, title, cover_url, cover_source, open_library_id, editions ( isbn_13 )")
      .or("cover_source.is.null,cover_source.neq.manual")
      .order("cover_checked_at", { ascending: true, nullsFirst: true })
      .order("shelved_count", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const queue = [...((data ?? []) as Work[])];
    if (!queue.length) break;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let w = queue.shift(); w && going(); w = queue.shift()) {
          try {
            await check(w);
          } catch (e) {
            console.error(`Covers: ${w.title} failed`, e);
            result.skipped++;
          }
        }
      }),
    );
  }
  return { ...result, changes };
}
