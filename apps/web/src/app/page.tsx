import { compactCount, describeNextRead, formatRating, getNextRead } from "@booksyde/shared";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { coverUrl, genreColor } from "@booksyde/theme";
import { BackdropStage } from "@/components/backdrop";
import { BookCover } from "@/components/book-cover";
import { FeatureBento } from "@/components/feature-bento";
import { Stars } from "@/components/stars";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { YearInBooksSection } from "@/components/year-in-books";
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
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-4 pb-24 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-14 pt-14 sm:pt-20 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Est. 2026 &middot; A reading room for everyone
            </p>
            <h1 className="mt-5 font-display text-6xl leading-[0.95] tracking-tight sm:text-8xl">
              Settle in with your next <em className="text-accent">favorite</em> book.
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

          {/* Your next read (or today's pick when signed out), staged on a backdrop drawn from the book itself */}
          <Suspense fallback={<FeaturedSkeleton />}>
            <FeaturedPick />
          </Suspense>
        </section>

        <section id="discover" className="flex flex-col gap-6">
          <SectionHeading
            numeral="I"
            aside={
              <Link href="/discover" className="shrink-0 text-sm font-semibold text-accent hover:underline">
                Discover more →
              </Link>
            }
          >
            What are you in the mood for?
          </SectionHeading>
          <div className="flex flex-wrap gap-2.5">
            {moods.map(([slug, label]) => (
              <Link
                key={slug}
                href={`/search?tags=${slug}`}
                className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 font-medium transition hover:border-text/40 hover:bg-surface-raised"
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(slug).dot }} />
                {label}
              </Link>
            ))}
          </div>
        </section>

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
          <Suspense fallback={<NightstandSkeleton />}>
            <Nightstand />
          </Suspense>
        </section>

        <YearInBooksSection numeral="III" />

        <figure className="mx-auto max-w-2xl text-center">
          <Ornament className="justify-center" />
          <blockquote className="mt-6 font-display text-3xl italic leading-snug sm:text-4xl">
            &ldquo;I declare after all there is no enjoyment like reading!&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Jane Austen, <span className="normal-case italic tracking-normal">Pride and Prejudice</span>
          </figcaption>
        </figure>

        <section id="join" className="flex flex-col gap-8">
          <SectionHeading numeral="IV">A few things you&rsquo;ll love</SectionHeading>
          <FeatureBento />
        </section>
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

/** The signed-in reader's next read, staged like the featured book; null when signed out or nothing fits. */
async function getPersonalPick() {
  // Reads the session cookie, so it can only run at request time.
  await connection();
  if (!hasSupabaseEnv) return null;
  try {
    const pick = await getNextRead(await createClient());
    if (!pick) return null;
    const work = await getBook(pick.work.id);
    return work ? { book: toFeatured(work), caption: describeNextRead(pick) } : null;
  } catch {
    // e.g. the next_read migration hasn't run yet: show today's pick instead.
    return null;
  }
}

/** The reader's next read; for everyone else, one of the most-shelved books, a different one each day. */
async function FeaturedPick() {
  const personal = await getPersonalPick();
  const book = personal?.book ?? (await getFeaturedBook().catch(() => null)) ?? fallbackPick;
  const caption = personal?.caption ?? { label: "Today’s pick", why: null };
  const stage = (
    <BackdropStage
      work={book}
      className="transition duration-300 group-hover:-translate-y-1"
      cover={
        <BookCover
          title={book.title}
          author={book.author}
          src={book.cover_url}
          color={book.cover_color}
          sizes="200px"
          priority
          className="w-[48%] -rotate-2"
        />
      }
    />
  );
  return (
    <figure className="mx-auto w-full max-w-sm">
      {book.id ? (
        <Link href={`/books/${book.id}`} className="group block" aria-label={`${book.title} by ${book.author}`}>
          {stage}
        </Link>
      ) : (
        stage
      )}
      <figcaption className="border-b border-border py-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{caption.label}</span>
          <span className="truncate text-right">
            <span className="font-display text-lg italic">{book.title}</span>
            {book.year ? <span className="text-muted"> &middot; {book.year}</span> : null}
          </span>
        </div>
        {caption.why ? <p className="mt-1 truncate text-right text-muted">{caption.why}</p> : null}
      </figcaption>
    </figure>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="aspect-[4/5] animate-pulse rounded-[28px] bg-border/50" />
      <div className="mt-3 h-6 animate-pulse rounded bg-border/40" />
    </div>
  );
}

/** The books the most readers have open right now. */
async function Nightstand() {
  const books = await getNightstandBooks(5).catch(() => []);
  if (books.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-muted">
        The nightstands are bare for now.{" "}
        <Link href="/search" className="font-semibold text-accent hover:underline">
          Start a book
        </Link>{" "}
        and yours will be the first.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
      {books.map((book) => (
        <Link key={book.id} href={`/books/${book.id}`} className="group flex flex-col gap-4">
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
        </Link>
      ))}
    </div>
  );
}

function NightstandSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={i > 1 ? "hidden sm:block" : ""}>
          <div className="aspect-[2/3] animate-pulse rounded-[3px] bg-border/50" />
          <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-border/50" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-border/40" />
        </div>
      ))}
    </div>
  );
}
