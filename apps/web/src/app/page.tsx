import { compactCount, describeNextRead, formatRating, getMyReadingDesk, getNextRead } from "@booksyde/shared";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { christmas, coverUrl, genreColor, thanksgiving } from "@booksyde/theme";
import { BookCover } from "@/components/book-cover";
import { BookObject } from "@/components/book-object";
import { FeatureBento } from "@/components/feature-bento";
import { HollySprig } from "@/components/holly";
import { Stars } from "@/components/stars";
import { ReadingDesk } from "@/components/reading-desk";
import { ReadingProgress } from "@/components/reading-progress";
import { SeasonPicksSection } from "@/components/season-picks";
import { ShelfBook } from "@/components/shelf-book";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { YearInBooksSection } from "@/components/year-in-books";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { type FeaturedBook, getBook, getFeaturedBook, getNightstandBooks, toFeatured } from "@/lib/catalog";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const moods = [
  ["fantasy", "Fantasy"],
  ["romance", "Romance"],
  ["mystery", "Mystery"],
  ["thriller", "Thriller"],
  ["science-fiction", "Science fiction"],
  ["horror", "Gothic & horror"],
  ["literary-fiction", "Literary"],
  ["historical-fiction", "Historical"],
  ["non-fiction", "Non-fiction"],
  ["poetry", "Poetry"],
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader showSearch={false} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-4 pb-24 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-14 pt-14 thanksgiving:pt-10 christmas:pt-6 sm:pt-20 sm:thanksgiving:pt-14 sm:christmas:pt-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              <span className="christmas:hidden thanksgiving:hidden">Est. 2026 &middot; A reading room for everyone</span>
              <span className="hidden thanksgiving:inline">{thanksgiving.kicker}</span>
              <span className="hidden christmas:inline">{christmas.kicker}</span>
            </p>
            <h1 className="mt-5 font-display text-6xl leading-[0.95] tracking-tight sm:text-8xl">
              <span className="christmas:hidden thanksgiving:hidden">
                Settle in with your next <em className="text-accent">favorite</em> book.
              </span>
              <span className="hidden thanksgiving:inline">
                {thanksgiving.headline.before} <em className="text-accent">{thanksgiving.headline.accent}</em>{" "}
                {thanksgiving.headline.after}
              </span>
              <span className="hidden christmas:inline">
                {christmas.headline.before} <em className="text-accent">{christmas.headline.accent}</em>{" "}
                {christmas.headline.after}
              </span>
            </h1>
            <Ornament className="mt-7" />
            <p className="mt-6 max-w-md text-lg text-muted">
              Keep track of what you read, find books that suit your mood, and trade recommendations with friends who
              read like you do.
            </p>
            <form
              action="/search"
              className="mt-8 flex max-w-lg items-center gap-2 rounded-full border border-text/20 bg-surface-raised p-1.5 pl-5 shadow-[0_10px_30px_-18px_rgba(31,27,22,0.5)] focus-within:border-text/40"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                name="q"
                aria-label="Search books"
                placeholder="Search titles, authors, ISBNs…"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-text outline-none placeholder:text-muted"
              />
              <button className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-text hover:opacity-90">
                Search
              </button>
            </form>
            <p className="mt-4 text-sm text-muted">
              Try{" "}
              <Link href="/search?q=Jane+Austen" className="underline decoration-border underline-offset-4 hover:text-text">
                Jane Austen
              </Link>
              ,{" "}
              <Link href="/search?tags=gothic" className="underline decoration-border underline-offset-4 hover:text-text">
                gothic
              </Link>{" "}
              or{" "}
              <Link href="/search?tags=mysterious" className="underline decoration-border underline-offset-4 hover:text-text">
                rainy-day mysteries
              </Link>
            </p>
          </div>

          {/* Your next read (or today's pick when signed out), drawn as a book; with a bookmark if you've started it */}
          <Suspense fallback={<FeaturedSkeleton />}>
            <FeaturedPick />
          </Suspense>
        </section>

        {/* Signed-in readers' books in progress, each with a bookmark they can move. */}
        <Suspense fallback={null}>
          <WhereYouLeftOff />
        </Suspense>

        {/* December: a bestseller and a Christmas book, side by side. */}
        <Suspense fallback={null}>
          <SeasonPicksSection />
        </Suspense>

        <section id="discover" className="flex flex-col gap-6">
          <SectionHeading
            numeral="I"
            aside={
              <Link
                href="/discover"
                className="shrink-0 text-sm font-semibold text-accent hover:underline"
                {...track(AnalyticsEvent.DiscoverClicked, { location: "home_moods" })}
              >
                Discover more →
              </Link>
            }
          >
            What are you in the mood for?
          </SectionHeading>
          <div className="flex flex-wrap gap-2.5">
            {/* December: Christmas books first. */}
            <Link
              href="/search?q=christmas"
              className="hidden items-center gap-2 rounded-full border border-accent/40 bg-surface px-4 py-2 font-medium transition hover:border-accent hover:bg-surface-raised christmas:inline-flex"
              {...track(AnalyticsEvent.MoodChipClicked, { tag: "christmas", label: "Christmas", location: "home" })}
            >
              <HollySprig className="text-sm text-highlight" />
              Christmas
            </Link>
            {moods.map(([slug, label]) => (
              <Link
                key={slug}
                href={`/search?tags=${slug}`}
                className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 font-medium transition hover:border-text/40 hover:bg-surface-raised"
                {...track(AnalyticsEvent.MoodChipClicked, { tag: slug, label, location: "home" })}
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(slug).dot }} />
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* The nightstand only shows once enough different readers have books open, and the numbering follows. */}
        <Suspense fallback={<LaterSections nightstand={null} />}>
          <LaterSectionsWithNightstand />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Shown when the catalogue is empty (or unreachable), so the hero is never bare. */
const fallbackPick: FeaturedBook = {
  id: "",
  title: "Pride and Prejudice",
  author: "Jane Austen",
  year: 1813,
  cover_url: coverUrl(14348537),
  cover_color: null,
  backdrop_style: null,
  tags: [],
};

/** The signed-in reader's Reading now books with their places in them, once per request; null when signed out. */
const loadReadingDesk = cache(async () => {
  await connection();
  if (!hasSupabaseEnv) return null;
  try {
    const client = await createClient();
    const { data } = await client.auth.getUser();
    return data.user ? await getMyReadingDesk(client) : null;
  } catch {
    return null;
  }
});

/** "Updated 3 days ago", to the day. */
function sinceLabel(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  if (days < 60) return `Updated ${Math.floor(days / 7)} weeks ago`;
  return `Updated ${Math.floor(days / 30)} months ago`;
}

/** The reader's desk: every book they're partway through. Nothing at all when signed out or between books. */
async function WhereYouLeftOff() {
  const desk = await loadReadingDesk();
  if (!desk?.length) return null;
  const tracked = desk.filter((b) => b.page != null).length;
  return (
    <section id="where-you-left-off" className="-mt-8 flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Your reading desk</p>
          <h2 className="mt-2 font-display text-4xl leading-none sm:text-5xl">Where you left off</h2>
        </div>
        <p className="hidden shrink-0 text-sm text-muted sm:block">
          {desk.length === 1 ? "1 book open" : `${desk.length} books open`}
          {tracked < desk.length ? " · tracking pages is optional" : null}
        </p>
      </div>
      <ReadingDesk books={desk.map((b) => ({ ...b, updatedLabel: sinceLabel(b.updatedAt) }))} />
    </section>
  );
}

/** The signed-in reader's next read, with their place in it if they've started; null when signed out or nothing fits. */
async function getPersonalPick() {
  // Reads the session cookie, so it can only run at request time.
  await connection();
  if (!hasSupabaseEnv) return null;
  try {
    const client = await createClient();
    const pick = await getNextRead(client);
    if (!pick) return null;
    const reading = pick.reason === "reading";
    const [work, desk] = await Promise.all([getBook(pick.work.id), reading ? loadReadingDesk() : null]);
    if (!work) return null;
    const onDesk = desk?.find((b) => b.work.id === pick.work.id);
    return {
      book: toFeatured(work),
      reason: pick.reason,
      caption: describeNextRead(pick),
      page: onDesk?.page ?? null,
      // The longest edition's count unless we know which edition they're holding.
      pages: onDesk?.pages ?? (Math.max(0, ...work.editions.map((e) => e.page_count ?? 0)) || null),
      // The hero shows the front book; the rest are on the desk just below.
      more: desk && desk.length > 1 ? { count: desk.length - 1, href: "#where-you-left-off" } : null,
    };
  } catch {
    // e.g. the next_read migration hasn't run yet: show today's pick instead.
    return null;
  }
}

/** The reader's next read; for everyone else, one of the most-shelved books, a different one each day. */
async function FeaturedPick() {
  const personal = await getPersonalPick();
  const book = personal?.book ?? (await getFeaturedBook().catch(() => null)) ?? fallbackPick;
  const reading = personal?.reason === "reading";
  const art = (
    <div className="grid place-items-center pt-6 pb-14">
      <BookObject
        ribbon={reading}
        gift={!reading}
        className="w-[58%] -rotate-2 transition duration-300 group-hover:-translate-y-1 group-hover:-rotate-1"
        cover={
          <BookCover
            title={book.title}
            author={book.author}
            src={book.cover_url}
            color={book.cover_color}
            sizes="240px"
            priority
            className="w-full"
          />
        }
      />
    </div>
  );
  const titleLine = (
    <span className="truncate">
      <span className="font-display text-lg italic">{book.title}</span>
      {book.author ? <span className="text-muted"> &middot; {book.author}</span> : null}
    </span>
  );
  const label = (text: string) => (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{text}</span>
  );

  return (
    <figure className="mx-auto w-full max-w-sm">
      {/* A pick that isn't in the catalogue yet goes to search, where it can be found and added. */}
      <Link
        href={book.id ? `/books/${book.id}` : `/search?q=${encodeURIComponent(`${book.title} ${book.author}`.trim())}`}
        className="group block"
        aria-label={`${book.title} by ${book.author}`}
      >
        {art}
      </Link>
      <figcaption className="border-b border-border pb-3 text-sm">
        {reading && personal ? (
          <ReadingProgress
            label={label(personal.caption.label)}
            title={titleLine}
            page={personal.page}
            pages={personal.pages}
            more={personal.more}
          />
        ) : personal ? (
          // A book they haven't started: why it's next is the news.
          <>
            {label(personal.caption.label)}
            <p className="mt-1.5 font-display text-2xl leading-snug">{personal.caption.why}</p>
            <p className="mt-1 flex text-muted">{titleLine}</p>
          </>
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <span className="shrink-0">{label("Today’s pick")}</span>
            <span className="truncate text-right">
              <span className="font-display text-lg italic">{book.title}</span>
              {book.year ? <span className="text-muted"> &middot; {book.year}</span> : null}
            </span>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mx-auto mt-6 mb-14 aspect-[2/3] w-[58%] animate-pulse rounded-[3px] bg-border/50" />
      <div className="mt-3 h-6 animate-pulse rounded bg-border/40" />
    </div>
  );
}

type NightstandBooks = Awaited<ReturnType<typeof getNightstandBooks>>;

/**
 * "On everyone's nightstand": the books the most readers have open right now.
 * Without enough readers, nightstand_works sends catalogue books with no
 * reader counts, and the section stays hidden.
 */
async function LaterSectionsWithNightstand() {
  const books = await getNightstandBooks(5).catch(() => []);
  return <LaterSections nightstand={books.some((b) => b.readers > 0) ? books : null} />;
}

/** Everything after the mood chips, numbered on from I. */
function LaterSections({ nightstand }: { nightstand: NightstandBooks | null }) {
  const [year, features] = nightstand ? ["III", "IV"] : ["II", "III"];
  return (
    <>
      {nightstand ? (
        <section className="flex flex-col gap-8">
          <SectionHeading
            numeral="II"
            aside={
              <Link href="/search" className="shrink-0 text-sm font-semibold text-accent hover:underline">
                See all →
              </Link>
            }
          >
            On everyone&rsquo;s nightstand
          </SectionHeading>
          <NightstandShelf books={nightstand} />
        </section>
      ) : null}

      <YearInBooksSection numeral={year} />

      <figure className="mx-auto max-w-2xl text-center">
        <Ornament className="justify-center" />
        {/* Austen most of the year; Brontë's falling leaves through November; Dickens through December. */}
        <div className="christmas:hidden thanksgiving:hidden">
          <blockquote className="mt-6 font-display text-3xl italic leading-snug sm:text-4xl">
            &ldquo;I declare after all there is no enjoyment like reading!&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Jane Austen, <span className="normal-case italic tracking-normal">Pride and Prejudice</span>
          </figcaption>
        </div>
        <div className="hidden thanksgiving:block">
          <blockquote className="mt-6 font-display text-3xl italic leading-snug sm:text-4xl">
            &ldquo;{thanksgiving.quote.text}&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {thanksgiving.quote.author}, <span className="normal-case italic tracking-normal">{thanksgiving.quote.work}</span>
          </figcaption>
        </div>
        <div className="hidden christmas:block">
          <blockquote className="mt-6 font-display text-3xl italic leading-snug sm:text-4xl">
            &ldquo;{christmas.quote.text}&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {christmas.quote.author}, <span className="normal-case italic tracking-normal">{christmas.quote.work}</span>
          </figcaption>
        </div>
      </figure>

      <section id="join" className="flex flex-col gap-8">
        <SectionHeading numeral={features}>A few things you&rsquo;ll love</SectionHeading>
        <FeatureBento />
      </section>
    </>
  );
}

function NightstandShelf({ books }: { books: NightstandBooks }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
      {books.map((book) => (
        <ShelfBook key={book.id} workId={book.id} title={book.title} linkClassName="group flex flex-col gap-4">
          <BookCover
            title={book.title}
            author={book.author}
            src={book.cover_url}
            color={book.cover_color}
            className="transition duration-300 group-hover:-translate-y-1"
          />
          <div>
            <h3 className="font-display text-xl leading-tight">{book.title}</h3>
            <p className="text-sm text-muted">{book.author}</p>
            <p className="mt-1.5 text-sm">
              {book.ratings_count > 0 ? (
                <>
                  <Stars rating={book.avg_rating} /> <span className="text-muted">{formatRating(book.avg_rating)}</span>
                </>
              ) : (
                <span className="text-muted">No ratings yet</span>
              )}
            </p>
            {book.readers > 0 ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {compactCount(book.readers)} reading now
              </p>
            ) : null}
          </div>
        </ShelfBook>
      ))}
    </div>
  );
}

