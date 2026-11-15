import type { BooksydeClient } from "../client";
import { browseOpenLibrary, type OpenLibraryBook, openLibrarySubject } from "./open-library";
import { getTagDrawers, searchCatalog } from "./search";
import { getTrendingWorks } from "./works";

/*
 * The Discover page's data, shared by web (which caches it) and mobile.
 */

/**
 * The public half of the Discover page: the most-shelved books, and a shelf
 * for each of the fullest mood (then genre) drawers, with no book on two shelves.
 */
export async function getDiscoverShelves(client: BooksydeClient) {
  const [trending, drawers] = await Promise.all([getTrendingWorks(client, 12), getTagDrawers(client)]);
  const byFullness = (kind: string) =>
    drawers.filter((d) => d.kind === kind && d.works >= 3).sort((a, b) => b.works - a.works);
  const candidates = [...byFullness("mood"), ...byFullness("genre")].slice(0, 8);
  const filled = await Promise.all(
    candidates.map(async (drawer) => ({ drawer, books: await searchCatalog(client, { tags: [drawer.slug], limit: 18 }) })),
  );
  // Neighbouring drawers overlap a lot (fantasy / young adult), so each book appears on one shelf only.
  const seen = new Set<string>();
  const moods = [];
  for (const { drawer, books } of filled) {
    const fresh = books.filter((b) => !seen.has(b.id)).slice(0, 6);
    if (fresh.length < 3) continue;
    for (const b of fresh) seen.add(b.id);
    moods.push({ drawer, books: fresh });
    if (moods.length === 4) break;
  }
  return { trending, drawers, moods };
}

export type DiscoverShelves = Awaited<ReturnType<typeof getDiscoverShelves>>;

export type WiderStacksBook = OpenLibraryBook & { workId: string | null };

/**
 * Open Library books for a reader who has outgrown our shelves: the most-read
 * books by their favourite authors (within their genres), and the most-read
 * books in their top genres. Each comes with its Booksyde id when we hold it.
 */
export async function getWiderStacksPicks(
  client: BooksydeClient,
  authors: string[],
  genres: string[],
  init?: RequestInit,
): Promise<{ byAuthor: WiderStacksBook[]; bySubject: WiderStacksBook[] }> {
  const subjects = genres.flatMap((g) => openLibrarySubject(g) ?? []);
  // Open Library's subjects are crowd-tagged; keep adult and off-genre books out unless the reader reads them.
  const notSubjects = ["erotica", ...(genres.includes("romance") ? [] : ["romance"])];
  const [byAuthor, bySubject] = await Promise.all([
    Promise.all(
      authors.map((author) =>
        // Within their genres, so a fantasy author's contemporary romances don't come up.
        browseOpenLibrary({ author, anySubjects: subjects, notSubjects: ["erotica"] }, 10, init).catch(() => []),
      ),
    ),
    subjects.length ? browseOpenLibrary({ subjects: subjects.slice(0, 2), notSubjects }, 30, init).catch(() => []) : [],
  ]);

  const olids = [...new Set([...byAuthor.flat(), ...bySubject].map((b) => b.olid))];
  if (olids.length === 0) return { byAuthor: [], bySubject: [] };
  const { data } = await client.from("works").select("id, open_library_id").in("open_library_id", olids);
  const onFile = new Map((data ?? []).map((w) => [w.open_library_id, w.id]));
  const withId = (b: OpenLibraryBook) => ({ ...b, workId: onFile.get(b.olid) ?? null });
  return { byAuthor: byAuthor.flat().map(withId), bySubject: bySubject.map(withId) };
}
