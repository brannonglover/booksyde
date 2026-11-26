import "server-only";

/*
 * Prizes and screen adaptations for "This week in books", from Wikidata's
 * public SPARQL endpoint (no key; the data is CC0). Wikidata names the book
 * and its author along with their Open Library IDs, which is how we find our
 * copy of the book.
 *
 * Its query service times out on anything broad, so each lookup is two small
 * queries: one that finds the candidates by a narrow filter, and one that
 * fetches the details for just those IDs.
 */

const ENDPOINT = "https://query.wikidata.org/sparql";

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Binding[]> {
  const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ query })}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "Booksyde/1.0 (https://www.booksyde.co)" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const body = (await res.json()) as { results: { bindings: Binding[] } };
  return body.results.bindings;
}

/** "http://www.wikidata.org/entity/Q42" → "Q42". */
const qid = (b: Binding, name: string) => b[name]?.value.split("/").pop() ?? null;
const text = (b: Binding, name: string) => b[name]?.value ?? null;
/** An item with no English label comes back labelled with its own ID. */
const label = (b: Binding, name: string) => {
  const v = text(b, name);
  return v && !/^Q\d+$/.test(v) ? v : null;
};
const values = (ids: string[]) => ids.map((id) => `wd:${id}`).join(" ");
const day = (iso: string) => iso.slice(0, 10);

/** Day precision in Wikidata's time values; 9 is a year, 10 a month. */
const DAY_PRECISION = 11;

/** A book as Wikidata knows it, for matching to ours. */
export type WikidataBook = {
  title: string | null;
  openLibraryId: string | null;
  author: string | null;
  authorOpenLibraryId: string | null;
};

/* ───────────── Prizes ───────────── */

/** The prizes worth a story, by Wikidata ID. Names are Wikidata's English labels. */
export const PRIZES: Record<string, string> = {
  Q160082: "Booker Prize",
  Q2052291: "International Booker Prize",
  Q136735734: "Children's Booker Prize",
  Q833633: "Pulitzer Prize for Fiction",
  Q784589: "Pulitzer Prize for General Nonfiction",
  Q285117: "Pulitzer Prize for Biography",
  Q599254: "Pulitzer Prize for History",
  Q118372139: "Pulitzer Prize for Memoir or Autobiography",
  Q2117891: "Pulitzer Prize for Poetry",
  Q3873144: "National Book Award for Fiction",
  Q3873147: "National Book Award for Nonfiction",
  Q1505018: "National Book Critics Circle Award",
  Q18884: "Women's Prize for Fiction",
  Q116873189: "Women's Prize for Non-Fiction",
  Q898439: "Baillie Gifford Prize",
  Q21126541: "Kirkus Prize",
  Q104591576: "Andrew Carnegie Medal for Excellence in Fiction",
  Q1188661: "PEN/Faulkner Award for Fiction",
  Q1328335: "Giller Prize",
  Q18166705: "Stella Prize",
  Q3398750: "Dylan Thomas Prize",
  Q255032: "Hugo Award for Best Novel",
  Q266012: "Nebula Award for Best Novel",
  Q898527: "World Fantasy Award for Best Novel",
  Q708830: "Arthur C. Clarke Award",
  Q622813: "Newbery Medal",
  Q1026417: "Caldecott Medal",
  Q16515422: "Goodreads Choice Awards",
  Q37922: "Nobel Prize in Literature",
};

export type PrizeNews = WikidataBook & {
  /** The book's Wikidata ID, or null for a prize given to the author for their work as a whole (the Nobel). */
  bookId: string | null;
  authorId: string;
  prizeId: string;
  prize: string;
  won: boolean;
  year: number;
  /** "2026-11-09" when Wikidata has the day; usually it only has the year. */
  date: string | null;
  /** The prize's English Wikipedia article, where a reader can find out more. */
  prizeUrl: string | null;
};

/**
 * This year's (and last year's) winners and nominees of the prizes above. Wikidata
 * records some on the book and some on the author ("award received … for
 * work"); both come back as one entry per book, prize, year and outcome.
 */
export async function getPrizeNews(sinceYear: number): Promise<PrizeNews[]> {
  const rows = await sparql(`
    SELECT ?subject ?subjectLabel ?human ?prop ?award ?awardWiki ?t ?prec ?work ?workLabel ?workOl ?subjectOl ?author ?authorLabel ?authorOl WHERE {
      VALUES ?award { ${values(Object.keys(PRIZES))} }
      VALUES (?prop ?ps) { (p:P166 ps:P166) (p:P1411 ps:P1411) }
      ?subject ?prop ?st . ?st ?ps ?award ; pq:P585 ?t .
      FILTER(?t >= "${sinceYear}-01-01T00:00:00Z"^^xsd:dateTime)
      ?st pqv:P585 [ wikibase:timePrecision ?prec ] .
      OPTIONAL { ?subject wdt:P31 wd:Q5 . BIND(true AS ?human) }
      OPTIONAL { ?awardWiki schema:about ?award ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?subject wdt:P648 ?subjectOl }
      OPTIONAL { ?st pq:P1686 ?work . OPTIONAL { ?work wdt:P648 ?workOl } }
      OPTIONAL { ?subject wdt:P50 ?author . OPTIONAL { ?author wdt:P648 ?authorOl } }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`);

  const byKey = new Map<string, PrizeNews>();
  for (const r of rows) {
    const subject = qid(r, "subject")!;
    const human = Boolean(text(r, "human"));
    const prizeId = qid(r, "award")!;
    const t = text(r, "t")!;
    const entry: PrizeNews = human
      ? {
          bookId: qid(r, "work"),
          title: label(r, "workLabel"),
          openLibraryId: text(r, "workOl"),
          authorId: subject,
          author: label(r, "subjectLabel"),
          authorOpenLibraryId: text(r, "subjectOl"),
          prizeId,
          prize: PRIZES[prizeId],
          won: text(r, "prop")!.endsWith("P166"),
          year: Number(t.slice(0, 4)),
          date: Number(text(r, "prec")) >= DAY_PRECISION ? day(t) : null,
          prizeUrl: text(r, "awardWiki"),
        }
      : {
          bookId: subject,
          title: label(r, "subjectLabel"),
          openLibraryId: text(r, "subjectOl"),
          authorId: qid(r, "author") ?? "",
          author: label(r, "authorLabel"),
          authorOpenLibraryId: text(r, "authorOl"),
          prizeId,
          prize: PRIZES[prizeId],
          won: text(r, "prop")!.endsWith("P166"),
          year: Number(t.slice(0, 4)),
          date: Number(text(r, "prec")) >= DAY_PRECISION ? day(t) : null,
          prizeUrl: text(r, "awardWiki"),
        };
    // A book with no author on record, or a person with neither a book nor a name, isn't a story we can tell.
    if (!entry.authorId || !entry.author || (entry.bookId && !entry.title)) continue;

    // The same award is often on both the book and its author: merge them, keeping whatever either knows.
    const key = `${entry.bookId ?? entry.authorId}:${prizeId}:${entry.year}:${entry.won}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, entry);
      continue;
    }
    seen.date ??= entry.date;
    seen.openLibraryId ??= entry.openLibraryId;
    seen.authorOpenLibraryId ??= entry.authorOpenLibraryId;
  }

  const all = [...byKey.values()];
  // A book that won doesn't also need a story saying it was nominated.
  const won = new Set(all.filter((p) => p.won).map((p) => `${p.bookId ?? p.authorId}:${p.prizeId}:${p.year}`));
  // And a prize recorded on the book doesn't need the copy recorded on its author without the book.
  const forBook = new Set(all.filter((p) => p.bookId).map((p) => `${p.authorId}:${p.prizeId}:${p.year}:${p.won}`));
  return all.filter(
    (p) =>
      (p.won || !won.has(`${p.bookId ?? p.authorId}:${p.prizeId}:${p.year}`)) &&
      (p.bookId || !forBook.has(`${p.authorId}:${p.prizeId}:${p.year}:${p.won}`)),
  );
}

/* ───────────── Screen adaptations ───────────── */

const FILM_TYPES = new Set([
  "Q11424", // film
  "Q24869", // feature film
  "Q202866", // animated film
  "Q29168811", // animated feature film
  "Q506240", // television film
  "Q18011172", // film project
]);
const SERIES_TYPES = new Set([
  "Q5398426", // television series
  "Q1259759", // miniseries
  "Q581714", // animated series
  "Q117467246", // animated television series
  "Q63952888", // anime television series
  "Q526877", // web series
]);

/** Fewer Wikipedias than this have an article on it, and it's too small to be news. */
const MIN_SITELINKS = 5;
const UNITED_STATES = "Q30";

export type Adaptation = WikidataBook & {
  screenId: string;
  screenTitle: string | null;
  format: "film" | "series";
  /** When it's out: the US release if Wikidata has one, else its first. */
  date: string;
  bookId: string;
  /** The film's or series' English Wikipedia article, if it has one. */
  screenUrl: string | null;
};

/** Films and series based on a book, out (or starting) between `from` and `to`. */
export async function getAdaptations(from: Date, to: Date): Promise<Adaptation[]> {
  // Whole days: Wikidata's dates are midnight UTC.
  const fromDay = day(from.toISOString());
  const toDay = day(to.toISOString());
  const window = `FILTER(?d >= "${fromDay}T00:00:00Z"^^xsd:dateTime && ?d < "${toDay}T00:00:00Z"^^xsd:dateTime)`;
  // Films have a publication date; series often only a start time.
  const found = await Promise.all(
    ["P577", "P580"].map((p) =>
      sparql(`SELECT DISTINCT ?film WHERE { ?film wdt:P144 ?book ; wdt:${p} ?d . ${window} ?book wdt:P50 ?author . }`),
    ),
  );
  const ids = [...new Set(found.flat().map((r) => qid(r, "film")!))];
  if (!ids.length) return [];

  const [details, dates] = await Promise.all([
    sparql(`
      SELECT ?film ?filmLabel ?filmWiki ?links ?type ?book ?bookLabel ?bookOl ?author ?authorLabel ?authorOl WHERE {
        VALUES ?film { ${values(ids)} }
        ?film wdt:P144 ?book ; wikibase:sitelinks ?links ; wdt:P31 ?type .
        ?book wdt:P50 ?author .
        OPTIONAL { ?book wdt:P648 ?bookOl }
        OPTIONAL { ?author wdt:P648 ?authorOl }
        OPTIONAL { ?filmWiki schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`),
    sparql(`
      SELECT ?film ?date ?prec ?place WHERE {
        VALUES ?film { ${values(ids)} }
        VALUES (?prop ?psv) { (p:P577 psv:P577) (p:P580 psv:P580) }
        ?film ?prop ?st . ?st ?psv [ wikibase:timeValue ?date ; wikibase:timePrecision ?prec ] .
        OPTIONAL { ?st pq:P291 ?place }
      }`),
  ]);

  // The date that matters to most of our readers: the US release, else the first anywhere (a festival premiere is earlier than either).
  const releases = new Map<string, { us: string | null; first: string | null }>();
  for (const r of dates) {
    if (Number(text(r, "prec")) < DAY_PRECISION) continue;
    const film = qid(r, "film")!;
    const d = day(text(r, "date")!);
    const seen = releases.get(film) ?? { us: null, first: null };
    if (qid(r, "place") === UNITED_STATES && (!seen.us || d < seen.us)) seen.us = d;
    if (!seen.first || d < seen.first) seen.first = d;
    releases.set(film, seen);
  }

  const out = new Map<string, Adaptation & { types: Set<string> }>();
  for (const r of details) {
    const screenId = qid(r, "film")!;
    const bookId = qid(r, "book")!;
    const key = `${screenId}:${bookId}`;
    const seen = out.get(key);
    if (seen) {
      seen.types.add(qid(r, "type")!);
      continue;
    }
    const release = releases.get(screenId);
    const date = release?.us ?? release?.first;
    if (!date || Number(text(r, "links")) < MIN_SITELINKS) continue;
    out.set(key, {
      screenId,
      screenTitle: label(r, "filmLabel"),
      screenUrl: text(r, "filmWiki"),
      format: "film",
      date,
      bookId,
      title: label(r, "bookLabel"),
      openLibraryId: text(r, "bookOl"),
      author: label(r, "authorLabel"),
      authorOpenLibraryId: text(r, "authorOl"),
      types: new Set([qid(r, "type")!]),
    });
  }

  return [...out.values()].flatMap(({ types, ...a }) => {
    const format = [...types].some((t) => SERIES_TYPES.has(t)) ? "series" : [...types].some((t) => FILM_TYPES.has(t)) ? "film" : null;
    // Video games, plays, papers that are "based on" a book, and anything whose real release is outside the window.
    if (!format || !a.title || !a.author || a.date < fromDay || a.date >= toDay) return [];
    return [{ ...a, format }];
  });
}
