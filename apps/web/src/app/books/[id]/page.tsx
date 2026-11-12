import { bookVibe, compactCount, formatRating, ratingVerdict } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { ReviewBody } from "@/components/review-body";
import { ShelfButton } from "@/components/shelf-button";
import { Ornament, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Stars } from "@/components/stars";
import { getBook, getBookCommunity, getSimilarBooks } from "@/lib/catalog";

/*
 * A book page laid out like a book: a title page, then chapters —
 * the vibe, the marginalia (reviews), the library card (details) — and an
 * epilogue of books shelved nearby.
 */

type Params = Promise<{ id: string }>;
type Book = NonNullable<Awaited<ReturnType<typeof getBook>>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return { title: "Book not found" };
  const author = authorsOf(book)[0]?.name;
  return {
    title: author ? `${book.title} by ${author}` : book.title,
    description: book.description?.split("\n")[0],
  };
}

export default function BookPage({ params }: { params: Params }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<BookSkeleton />}>
        <BookDetail params={params} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const formatLabels: Record<string, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass market",
  ebook: "Ebook",
  audiobook: "Audiobook",
  other: "Edition",
};
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function plural(n: number, word: string) {
  return `${compactCount(n)} ${word}${n === 1 ? "" : "s"}`;
}

function authorsOf(book: Book) {
  return [...book.work_contributors]
    .filter((c) => c.role === "author" && c.authors)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.authors!);
}

/** "Austen, Jane": how a card catalogue files an author. */
function catalogueName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}`;
}

function ChapterHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{kicker}</p>
      <h2 className="font-display text-5xl leading-none sm:text-6xl">{title}</h2>
      <Ornament className="mt-1" />
    </header>
  );
}

async function BookDetail({ params }: { params: Params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  const authors = authorsOf(book);
  const authorNames = authors.map((a) => a.name).join(" & ") || "Unknown author";
  const vibe = bookVibe(book.work_tags);
  const editions = [...book.editions].sort((a, b) => (b.page_count ?? 0) - (a.page_count ?? 0));
  const main = editions.find((e) => e.isbn_13) ?? editions[0];
  const paragraphs = (book.description ?? "").split(/\n{2,}/).filter(Boolean);
  const tint = book.cover_color ?? "var(--bk-green)";
  const avg = Number(book.avg_rating);

  return (
    <main className="flex flex-1 flex-col">
      {/* Title page */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{
          background: `radial-gradient(60% 55% at 50% 22%, color-mix(in oklab, ${tint} 22%, transparent), transparent 70%), linear-gradient(to bottom, color-mix(in oklab, ${tint} 9%, var(--bk-background)), var(--bk-background))`,
        }}
      >
        {/* Wide screens: the title page sits between two notes in the margins. */}
        <div className="mx-auto grid w-full max-w-[96rem] items-center gap-8 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 xl:grid-cols-[1fr_minmax(0,44rem)_1fr] 2xl:grid-cols-[1fr_minmax(0,50rem)_1fr]">
          <aside className="hidden justify-end xl:flex">
            <Suspense fallback={null}>
              <MarginNote id={book.id} />
            </Suspense>
          </aside>

          <div className="@container flex flex-col items-center text-center">
            <BookCover
              title={book.title}
              author={authorNames}
              src={book.cover_url}
              color={book.cover_color}
              sizes="240px"
              priority
              className="w-48 -rotate-[1.5deg] sm:w-60"
            />

            {vibe.genres.length > 0 ? (
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                {vibe.genres.map((g) => g.name).join(" · ")}
              </p>
            ) : null}
            <h1 className="mt-4 text-balance font-display text-6xl leading-[0.95] tracking-tight sm:text-8xl xl:text-[clamp(3.75rem,13.5cqi,6rem)]">
              {book.title}
            </h1>
            {book.subtitle ? <p className="mt-3 font-display text-2xl italic text-muted">{book.subtitle}</p> : null}
            <Ornament className="mt-7" />
            <p className="mt-5 font-display text-3xl italic">by {authorNames}</p>
            {book.first_published_year ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                First printed in {book.first_published_year}
              </p>
            ) : null}

            <Suspense fallback={<div className="mt-7 h-7 w-72 animate-pulse rounded bg-border/60" />}>
              <TitlePageStats id={book.id} avg={avg} />
            </Suspense>

            <div className="mt-7 w-full max-w-xs">
              <ShelfButton workId={book.id} />
            </div>
          </div>

          <aside className="hidden justify-start drop-shadow-[0_18px_22px_rgba(31,27,22,0.35)] xl:flex">
            <ReadingForecast vibe={vibe} />
          </aside>
        </div>
      </section>

      {/* The blurb */}
      {paragraphs.length > 0 ? (
        <section className="mx-auto w-full max-w-2xl space-y-5 px-4 py-16 text-lg leading-relaxed sm:px-6 sm:text-xl">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? "first-letter:float-left first-letter:mr-3 first-letter:mt-1.5 first-letter:font-display first-letter:text-[5rem] first-letter:leading-[0.75] first-letter:text-accent"
                  : ""
              }
            >
              {p}
            </p>
          ))}
        </section>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-28 px-4 pb-24 sm:px-6">
        {/* Chapter one: the vibe */}
        {vibe.moods.length > 0 || vibe.pace !== null || vibe.tropes.length > 0 ? (
          <section id="vibe" className="flex scroll-mt-8 flex-col gap-10">
            <ChapterHeading kicker="Chapter one" title="The vibe" />
            {vibe.bestEnjoyed ? (
              <div className="relative overflow-hidden rounded-3xl bg-green px-6 py-10 text-center text-paper sm:px-12">
                <div aria-hidden className="absolute inset-3 rounded-[1.25rem] border border-gilt/40" />
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gilt">Best enjoyed</p>
                <p className="mx-auto mt-3 max-w-2xl text-balance font-display text-3xl italic leading-snug sm:text-5xl">
                  {vibe.bestEnjoyed}.
                </p>
              </div>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2">
              {vibe.moods.length > 0 ? (
                <div className="rounded-3xl border border-border bg-surface p-7">
                  <h3 className="font-display text-3xl">How it feels</h3>
                  <p className="mt-1 text-sm text-muted">From readers&rsquo; mood votes</p>
                  <ul className="mt-6 space-y-4">
                    {vibe.moods.map((m) => (
                      <li key={m.slug} className="grid grid-cols-[6.5rem_1fr] items-center gap-4">
                        <Link href={`/search?tags=${m.slug}`} className="font-medium hover:text-accent">
                          {m.name}
                        </Link>
                        <span className="h-3 overflow-hidden rounded-full bg-border/60">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(8, m.strength * 100)}%`,
                              background: genreColor(m.slug).dot,
                            }}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-5">
                {vibe.pace !== null ? (
                  <div className="rounded-3xl border border-border bg-surface p-7">
                    <h3 className="font-display text-3xl">Pace</h3>
                    <div className="relative mx-4 mt-6 h-2 rounded-full bg-border/70">
                      <span
                        aria-hidden
                        className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-sm text-paper shadow-md"
                        style={{ left: `${vibe.pace * 50}%` }}
                      >
                        ✦
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 text-sm text-muted">
                      {["A slow simmer", "Steady", "A page-turner"].map((label, i) => (
                        <span
                          key={label}
                          className={`${i === 1 ? "text-center" : i === 2 ? "text-right" : ""} ${i === vibe.pace ? "font-semibold text-text" : ""}`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {vibe.tropes.length > 0 ? (
                  <div className="flex-1 rounded-3xl border border-border bg-surface p-7">
                    <h3 className="font-display text-3xl">You&rsquo;ll find</h3>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {vibe.tropes.map((t, i) => (
                        <Link
                          key={t.slug}
                          href={`/search?tags=${t.slug}`}
                          className={`rounded-full px-4 py-2 font-semibold shadow-[0_3px_0_rgba(31,27,22,0.15)] transition hover:rotate-0 ${
                            [
                              "-rotate-2 bg-oxblood text-paper",
                              "rotate-1 bg-gilt text-ink",
                              "-rotate-1 bg-[#5B3A5E] text-paper",
                              "rotate-2 bg-paper text-ink ring-1 ring-border",
                            ][i % 4]
                          }`}
                        >
                          {t.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Chapter two: marginalia */}
        <section id="marginalia" className="flex scroll-mt-8 flex-col gap-10">
          <ChapterHeading kicker="Chapter two" title="Marginalia" />
          <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-border/40" />}>
            <Marginalia id={book.id} avg={avg} />
          </Suspense>
        </section>

        {/* Chapter three: the library card */}
        <section className="flex flex-col gap-10">
          <ChapterHeading kicker="Chapter three" title="The library card" />
          <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr]">
            <LibraryCard book={book} authorNames={authorNames} main={main} editions={editions} />
            {authors.map((a) => (
              <figure
                key={a.id}
                className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center"
              >
                <div
                  aria-hidden
                  className="grid h-36 w-28 place-items-center rounded-[50%] border-4 border-double border-gilt bg-green font-display text-5xl text-paper shadow-inner"
                >
                  {a.name.charAt(0)}
                </div>
                <figcaption>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">About the author</p>
                  <p className="mt-2 font-display text-3xl">{a.name}</p>
                  {a.birth_date || a.death_date ? (
                    <p className="text-sm text-muted">
                      {a.birth_date?.slice(0, 4) ?? "?"}–{a.death_date?.slice(0, 4) ?? ""}
                    </p>
                  ) : null}
                  {a.bio ? <p className="mt-3 leading-relaxed text-muted">{a.bio}</p> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <Suspense fallback={null}>
          <ShelvedNearby id={book.id} />
        </Suspense>
      </div>
    </main>
  );
}

const paceNames = ["A slow simmer", "Steady", "A page-turner"];

/** Right margin: a library-slip "forecast" of how the book feels. */
function ReadingForecast({ vibe }: { vibe: ReturnType<typeof bookVibe> }) {
  if (!vibe.bestEnjoyed && vibe.moods.length === 0) return null;
  return (
    <a
      href="#vibe"
      className="ticket group relative block w-56 rotate-2 rounded-xl min-[1440px]:w-64 bg-green px-6 pb-6 pt-7 text-left text-paper transition duration-300 hover:rotate-0 2xl:w-72"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-gilt">Reading forecast</p>
      {vibe.bestEnjoyed ? (
        <p className="mt-3 font-display text-2xl italic leading-snug">Best enjoyed {vibe.bestEnjoyed}.</p>
      ) : null}
      {vibe.moods.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {vibe.moods.slice(0, 3).map((m) => (
            <li
              key={m.slug}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-2.5 py-1 text-xs font-semibold"
            >
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: genreColor(m.slug).dot }} />
              {m.name}
            </li>
          ))}
        </ul>
      ) : null}
      {vibe.pace !== null ? (
        <p className="mt-4 border-t border-dashed border-paper/25 pt-3 text-sm text-paper/80">
          Pace: <span className="font-semibold text-paper">{paceNames[vibe.pace]}</span>
        </p>
      ) : null}
      <p className="mt-3 text-xs font-semibold text-gilt group-hover:underline">See the full vibe ↓</p>
    </a>
  );
}

/** Trim to a whole word near `max` characters. */
function excerpt(text: string, max = 170) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,.;:!?]$/, "")}…`;
}

/** Left margin: the most-liked spoiler-free review, pinned like a note. */
async function MarginNote({ id }: { id: string }) {
  const { reviews } = await getBookCommunity(id);
  const note = reviews.find((r) => r.body && !r.has_spoilers);
  if (!note) return null;
  const name = note.profiles?.display_name || note.profiles?.username || "A reader";
  return (
    <a
      href="#marginalia"
      className="index-card group relative block w-56 -rotate-3 rounded-sm min-[1440px]:w-64 px-6 pb-5 pt-7 text-left shadow-[0_18px_36px_-18px_rgba(31,27,22,0.6)] transition duration-300 hover:rotate-0 2xl:w-72"
    >
      {/* A strip of tape holding the note down */}
      <span
        aria-hidden
        className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[-4deg] bg-gilt/35 backdrop-blur-[1px]"
      />
      <p className="border-b-2 border-oxblood/45 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-oxblood">
        From the margins
      </p>
      <p className="ruled mt-3 font-display text-xl italic">&ldquo;{excerpt(note.body!)}&rdquo;</p>
      <p className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">— {name}</span>
        {note.rating ? (
          <span className="text-xs">
            <Stars rating={Number(note.rating)} />
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-xs font-semibold text-accent group-hover:underline">Read all the notes ↓</p>
    </a>
  );
}

function LibraryCard({
  book,
  authorNames,
  main,
  editions,
}: {
  book: Book;
  authorNames: string;
  main: Book["editions"][number] | undefined;
  editions: Book["editions"];
}) {
  const rows: [string, string | null | undefined][] = [
    ["Author", catalogueName(authorNames)],
    ["Title", book.title],
    ["First printed", book.first_published_year?.toString()],
    ["Language", book.original_language ? languageNames.of(book.original_language) : null],
    ["Pages", main?.page_count ? String(main.page_count) : null],
    ["ISBN", main?.isbn_13],
  ];
  return (
    <div className="relative overflow-hidden rounded-md border border-[#D8C7A3] bg-[#F6EBD3] p-6 text-ink shadow-[0_18px_40px_-24px_rgba(31,27,22,0.6)] sm:p-8 dark:border-[#5A4C35] dark:bg-[#3A3124] dark:text-paper">
      <div className="flex items-baseline justify-between border-b-2 border-oxblood/40 pb-3 dark:border-[#E6957C]/40">
        <p className="text-xs font-bold uppercase tracking-[0.3em]">Booksyde Lending Library</p>
        <p className="font-mono text-xs opacity-70">No. {book.id.slice(-4).toUpperCase()}</p>
      </div>

      <div className="mt-4 grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <dl className="space-y-2.5 font-mono text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className="shrink-0 text-xs uppercase tracking-widest opacity-70">{label}</dt>
                <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-current opacity-40" />
                <dd className="text-right">{value}</dd>
              </div>
            ))}
        </dl>
        {/* Ink stamp */}
        <div
          aria-hidden
          className="mx-auto w-fit rotate-[-10deg] rounded-md border-[3px] border-oxblood/70 px-3 py-2 text-center font-mono text-xs font-bold uppercase leading-tight tracking-widest text-oxblood/85 dark:border-[#E6957C]/70 dark:text-[#E6957C]/85"
        >
          In circulation
          <br />
          {plural(book.shelved_count, "reader")}
        </div>
      </div>

      {editions.length > 0 ? (
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.3em]">On the shelves</p>
          <ul className="mt-3 divide-y divide-current/15 border-y border-current/15 font-mono text-xs">
            {editions.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span>
                  {formatLabels[e.format]}
                  {e.publisher ? ` · ${e.publisher}` : ""}
                  {e.published_date ? ` · ${e.published_date.slice(0, 4)}` : ""}
                </span>
                <span className="opacity-70">
                  {[e.page_count ? `${e.page_count} pp` : null, e.isbn_13].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streamed pieces

async function TitlePageStats({ id, avg }: { id: string; avg: number }) {
  const { distribution, shelves } = await getBookCommunity(id);
  const verdict = ratingVerdict(distribution);
  return (
    <div className="mt-7 flex flex-col items-center gap-3">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="text-xl">
          <Stars rating={Math.round(avg * 2) / 2} />
        </span>
        <span className="font-display text-2xl leading-none">{formatRating(avg)}</span>
        {verdict.total > 0 ? (
          <span className="text-sm text-muted">
            · loved by {Math.round(verdict.lovedShare * 100)}% of {plural(verdict.total, "reader")}
          </span>
        ) : null}
      </p>
      {shelves.reading + shelves.wantToRead > 0 ? (
        <p className="text-sm text-muted">
          {shelves.reading > 0 ? <>📖 {shelves.reading} reading it now</> : null}
          {shelves.reading > 0 && shelves.wantToRead > 0 ? <span className="mx-2">·</span> : null}
          {shelves.wantToRead > 0 ? <>🔖 {shelves.wantToRead} saving it for later</> : null}
        </p>
      ) : null}
    </div>
  );
}

const segmentShades = ["#B8893A", "#CFA75E", "#C9B79A", "#B9A58C", "#A08E7A"];

async function Marginalia({ id, avg }: { id: string; avg: number }) {
  const { distribution, reviews } = await getBookCommunity(id);
  const verdict = ratingVerdict(distribution);
  return (
    <div className="flex flex-col gap-12">
      {/* The verdict, in a sentence and a single bar */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-display text-4xl italic sm:text-5xl">{verdict.headline}.</p>
        {verdict.total > 0 ? (
          <>
            <p className="text-muted">
              {Math.round(verdict.lovedShare * 100)}% of {plural(verdict.total, "reader")} gave it four stars or more ·
              average {formatRating(avg)}
            </p>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-border/60"
              role="img"
              aria-label={verdict.segments.map((s) => `${s.ratings} gave ${s.stars} stars`).join(", ")}
            >
              {verdict.segments.map((s, i) =>
                s.ratings > 0 ? (
                  <span
                    key={s.stars}
                    style={{
                      width: `${(s.ratings / verdict.total) * 100}%`,
                      background: segmentShades[i],
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
              {verdict.segments.map((s, i) => (
                <span key={s.stars} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: segmentShades[i] }} />
                  {s.stars}★ {s.ratings}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Reviews as ruled index cards */}
      {reviews.length === 0 ? (
        <p className="text-center text-muted">No notes in the margins yet. Be the first to leave one.</p>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2">
          {reviews.map((r, i) => {
            const name = r.profiles?.display_name || r.profiles?.username || "A reader";
            return (
              <li
                key={r.id}
                className={`index-card relative rounded-sm px-6 pb-7 pt-5 shadow-[0_14px_30px_-18px_rgba(31,27,22,0.55)] transition duration-300 hover:rotate-0 ${
                  i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"
                }`}
              >
                <div className="flex items-center gap-3 border-b-2 border-oxblood/45 pb-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full font-display text-lg text-paper"
                    style={{
                      background: r.profiles?.theme_color ?? "var(--bk-green)",
                    }}
                  >
                    {name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {r.profiles?.username ? (
                      <Link href={`/u/${r.profiles.username}`} className="block truncate font-display text-xl leading-tight hover:text-accent">
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate font-display text-xl leading-tight">{name}</span>
                    )}
                    <span className="block text-xs text-muted">
                      {r.profiles?.username ? `@${r.profiles.username} · ` : ""}
                      {dateFormat.format(new Date(r.created_at))}
                    </span>
                  </span>
                  {r.rating ? (
                    <span className="shrink-0 text-sm">
                      <Stars rating={Number(r.rating)} />
                    </span>
                  ) : null}
                </div>
                <div className="ruled mt-3">
                  <ReviewBody body={r.body ?? ""} hasSpoilers={r.has_spoilers} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function ShelvedNearby({ id }: { id: string }) {
  const similar = await getSimilarBooks(id);
  if (similar.length === 0) return null;
  return (
    <section className="flex flex-col gap-10">
      <ChapterHeading kicker="Epilogue" title="Shelved nearby" />
      <div>
        <div className="grid grid-cols-3 items-end gap-4 px-3 sm:grid-cols-6 sm:gap-6">
          {similar.map((w, i) => (
            <Link
              key={w.id}
              href={`/books/${w.id}`}
              className={`block transition duration-300 hover:-translate-y-2 ${i % 3 === 1 ? "sm:-rotate-2" : i % 3 === 2 ? "sm:rotate-1" : ""}`}
              title={w.title}
            >
              <BookCover
                title={w.title}
                author=""
                src={w.cover_url}
                color={w.cover_color}
                sizes="(min-width: 640px) 160px, 30vw"
              />
            </Link>
          ))}
        </div>
        <div
          aria-hidden
          className="h-3 rounded-sm bg-[#8A6A4A] shadow-[0_8px_14px_-6px_rgba(31,27,22,0.6)] dark:bg-[#6E543B]"
        />
        <div className="mt-4 grid grid-cols-3 gap-4 px-3 sm:grid-cols-6 sm:gap-6">
          {similar.map((w) => (
            <Link key={w.id} href={`/books/${w.id}`} className="text-center hover:text-accent">
              <span className="block font-display text-lg leading-tight">{w.title}</span>
              <span className="text-xs text-muted">★ {formatRating(Number(w.avg_rating))}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-4 pb-16 pt-12 sm:pt-16">
      <div className="aspect-[2/3] w-48 animate-pulse rounded bg-border/60 sm:w-60" />
      <div className="h-3 w-40 animate-pulse rounded bg-border/60" />
      <div className="h-16 w-3/4 animate-pulse rounded bg-border/60" />
      <div className="h-6 w-56 animate-pulse rounded bg-border/60" />
    </main>
  );
}
