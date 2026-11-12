/**
 * Helpers that turn community data (tag votes, rating counts) into the
 * friendly, mood-first language Booksyde uses on book pages.
 */

type Tag = { slug: string; name: string; kind: string };
type VotedTag = { votes: number; tags: Tag | null };

/** Where and how a book is best read, keyed by its strongest mood. */
const bestEnjoyed: Record<string, string> = {
  cozy: "under a blanket with a pot of tea",
  funny: "somewhere you can laugh out loud",
  dark: "after midnight, with the lamps turned low",
  tense: "when nobody can interrupt you",
  emotional: "with tissues within reach",
  hopeful: "at the start of something new",
  adventurous: "on a long train journey",
  reflective: "on a slow Sunday morning",
  mysterious: "on a foggy evening by the window",
};

export type BookVibe = {
  /** Moods with their share of the strongest mood's votes (0–1), strongest first. */
  moods: { slug: string; name: string; strength: number }[];
  tropes: Tag[];
  genres: Tag[];
  /** 0 = slow, 1 = medium, 2 = fast; null when readers haven't said. */
  pace: 0 | 1 | 2 | null;
  /** "Best enjoyed …" phrase from the strongest mood, if we have one. */
  bestEnjoyed: string | null;
};

export function bookVibe(workTags: VotedTag[]): BookVibe {
  const tags = workTags
    .filter((t): t is { votes: number; tags: Tag } => t.tags !== null)
    .sort((a, b) => b.votes - a.votes);
  const ofKind = (kind: string) => tags.filter((t) => t.tags.kind === kind);

  const moodTags = ofKind("mood");
  const top = moodTags[0]?.votes ?? 1;
  const moods = moodTags.map((t) => ({ slug: t.tags.slug, name: t.tags.name, strength: t.votes / top }));

  const paceSlug = ofKind("pace")[0]?.tags.slug;
  const pace = paceSlug === "slow-paced" ? 0 : paceSlug === "medium-paced" ? 1 : paceSlug === "fast-paced" ? 2 : null;

  return {
    moods,
    tropes: ofKind("trope").map((t) => t.tags),
    genres: ofKind("genre").map((t) => t.tags),
    pace,
    bestEnjoyed: moods.map((m) => bestEnjoyed[m.slug]).find(Boolean) ?? null,
  };
}

export type Verdict = {
  total: number;
  /** Share of ratings that are 4★ or higher (0–1). */
  lovedShare: number;
  headline: string;
  /** Counts per star level, 5 → 1, for a single stacked bar. */
  segments: { stars: number; ratings: number }[];
};

/** A one-line verdict instead of a histogram: "Most readers loved it". */
export function ratingVerdict(distribution: { stars: number; ratings: number }[]): Verdict {
  const segments = [...distribution].sort((a, b) => b.stars - a.stars);
  const total = segments.reduce((sum, d) => sum + d.ratings, 0);
  const loved = segments.filter((d) => d.stars >= 4).reduce((sum, d) => sum + d.ratings, 0);
  const lovedShare = total ? loved / total : 0;
  const headline =
    total === 0
      ? "No verdict yet"
      : lovedShare >= 0.75
        ? "Readers adore it"
        : lovedShare >= 0.55
          ? "Most readers loved it"
          : lovedShare >= 0.35
            ? "Readers are divided"
            : "A tough sell for many";
  return { total, lovedShare, headline, segments };
}
