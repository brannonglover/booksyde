import { type EditionCover, getGoogleBooksCovers } from "@booksyde/shared";
import sharp from "sharp";

/*
 * Choosing a work's cover. Open Library's covers are uploaded by anyone, so
 * some are blank, sideways, photos of a book on a table, or postage-stamp
 * sized. Every candidate is downloaded and checked before it's used; when
 * none passes, the work keeps no cover and the UI sets a typeset one instead.
 *
 * Sources, best first: Google Books (publisher art, when GOOGLE_BOOKS_API_KEY
 * is set), then each English Open Library edition's cover.
 *
 * No "server-only" import here so the backfill script can use it too.
 */

export type CoverSource = "google_books" | "open_library";
export type PickedCover = { url: string; source: CoverSource; width: number; height: number };
export type CoverCheck = { ok: true; width: number; height: number } | { ok: false; reason: string };

/** Front covers run from about 0.6 (mass market) to 0.75 (picture books) wide per unit of height. */
const MIN_ASPECT = 0.55;
const MAX_ASPECT = 0.78;
/** Shelves draw covers up to ~200 CSS px wide; anything shorter than this looks smeared. */
const MIN_HEIGHT = 250;
/** Tall enough to stay sharp on a 2× screen: stop looking once a source gives us this. */
const GOOD_HEIGHT = 400;
/** Average colour spread per channel; real covers score 15+, a blank or black frame ~1. */
const MIN_CONTRAST = 8;
/** Downloads per work, so one book can't stall an import. */
const MAX_CHECKS = 6;

export const openLibraryCoverUrl = (coverId: number) => `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;

/** Downloads an image and says whether it looks like a usable front cover. */
export async function inspectCover(url: string, init?: RequestInit): Promise<CoverCheck> {
  let bytes: Buffer;
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    if (!res.headers.get("content-type")?.startsWith("image/")) return { ok: false, reason: "not an image" };
    bytes = Buffer.from(await res.arrayBuffer());
  } catch {
    return { ok: false, reason: "download failed" };
  }
  // Open Library and Google both answer some misses with a tiny placeholder.
  if (bytes.length < 2_000) return { ok: false, reason: "placeholder" };

  try {
    const image = sharp(bytes);
    const { width = 0, height = 0 } = await image.metadata();
    if (!width || !height) return { ok: false, reason: "unreadable" };
    const aspect = width / height;
    if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return { ok: false, reason: `wrong shape (${aspect.toFixed(2)})` };
    if (height < MIN_HEIGHT) return { ok: false, reason: `too small (${width}×${height})` };
    const { channels } = await image.stats();
    const colour = channels.slice(0, 3);
    const contrast = colour.reduce((sum, c) => sum + c.stdev, 0) / colour.length;
    if (contrast < MIN_CONTRAST) return { ok: false, reason: "blank" };
    return { ok: true, width, height };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/**
 * The best cover we can find, or null when every candidate fails the checks.
 * `isbns` feed Google Books; `editions` are Open Library's English editions,
 * best first (see `getEditionCovers`), and their ISBNs are tried too.
 */
export async function pickCover({
  isbns = [],
  editions = [],
  googleKey = process.env.GOOGLE_BOOKS_API_KEY,
  init,
  onCheck,
}: {
  isbns?: (string | null | undefined)[];
  editions?: EditionCover[];
  googleKey?: string;
  init?: RequestInit;
  /** Called with every candidate's verdict (the backfill prints them). */
  onCheck?: (url: string, source: CoverSource, check: CoverCheck) => void;
}): Promise<PickedCover | null> {
  let checks = 0;
  let best: PickedCover | null = null;

  const consider = async (url: string, source: CoverSource) => {
    if (checks >= MAX_CHECKS) return false;
    checks++;
    const check = await inspectCover(url, init);
    onCheck?.(url, source, check);
    if (check.ok && (!best || check.height > best.height)) best = { url, source, width: check.width, height: check.height };
    return check.ok && check.height >= GOOD_HEIGHT;
  };

  if (googleKey) {
    const tried = new Set<string>();
    for (const isbn of [...isbns, ...editions.map((e) => e.isbn13)]) {
      if (!isbn || tried.has(isbn) || tried.size >= 2) continue;
      tried.add(isbn);
      // A failed lookup (quota, network) just means we fall through to Open Library.
      const urls = await getGoogleBooksCovers(isbn, googleKey, init).catch(() => []);
      // The largest size can 404 on some volumes; the next one down is still fine.
      for (const url of urls.slice(0, 2)) if (await consider(url, "google_books")) return best;
    }
  }

  for (const { coverId } of editions) {
    if (await consider(openLibraryCoverUrl(coverId), "open_library")) return best;
  }
  return best;
}
