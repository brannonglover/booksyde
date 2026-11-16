import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { BookObject } from "@/components/book-object";
import { ReadingProgress } from "@/components/reading-progress";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { type FeaturedBook, getPreviewCandidates, getFeaturedBook, getFeaturedById } from "@/lib/catalog";

/*
 * Development only: the home page hero for any book, in each of its states
 * (keep reading with and without a logged page or other books on the go, your next read), so it can be
 * judged without signing in or shelving anything. /dev/hero?id=<work id>
 */

export const metadata: Metadata = { title: "Hero", robots: { index: false } };

type SearchParams = Promise<{ id?: string }>;

export default function HeroPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-10 pb-24 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Development</p>
          <h1 className="mt-3 font-display text-5xl tracking-tight">Home hero</h1>
          <p className="mt-3 max-w-2xl text-muted">
            One book in each state of the home page&rsquo;s next-read hero. The page numbers and the reason are sample
            values.
          </p>
        </header>
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Preview searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const { id } = await searchParams;
  const [book, candidates] = await Promise.all([
    id ? getFeaturedById(id) : getFeaturedBook(),
    getPreviewCandidates(),
  ]);

  return (
    <>
      <nav aria-label="Books to try" className="flex flex-wrap gap-2">
        {candidates.map((c) => (
          <Link
            key={c.id}
            href={`/dev/hero?id=${c.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm transition hover:border-text/40 ${
              c.id === book?.id ? "border-text/60 bg-surface-raised font-semibold" : "border-border bg-surface"
            }`}
          >
            {c.title}
          </Link>
        ))}
      </nav>

      {book ? <HeroStates book={book} /> : <p className="text-muted">No such book.</p>}
    </>
  );
}

/** The hero in each state: keep reading (with and without a page logged) and your next read. */
function HeroStates({ book }: { book: FeaturedBook }) {
  const cover = (
    <BookCover
      title={book.title}
      author={book.author}
      src={book.cover_url}
      color={book.cover_color}
      sizes="240px"
      className="w-full"
    />
  );
  const label = (text: string) => (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{text}</span>
  );
  const title = (
    <span className="truncate">
      <span className="font-display text-lg italic">{book.title}</span>
      {book.author ? <span className="text-muted"> &middot; {book.author}</span> : null}
    </span>
  );
  return (
    <section className="flex flex-col gap-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-display text-3xl italic">{book.title}</h2>
        <p className="text-muted">
          {book.author}
          {book.year ? ` · ${book.year}` : ""}
        </p>
      </div>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
      <figure className="w-full max-w-sm">
        <div className="grid place-items-center pt-6 pb-14">
          <BookObject ribbon cover={cover} className="w-[58%] -rotate-2" />
        </div>
        <figcaption className="border-b border-border pb-3 text-sm">
          <ReadingProgress label={label("Keep reading")} title={title} page={212} pages={480} more={{ count: 2, href: "#" }} />
        </figcaption>
      </figure>
      <figure className="w-full max-w-sm">
        <div className="grid place-items-center pt-6 pb-14">
          <BookObject ribbon cover={cover} className="w-[58%] -rotate-2" />
        </div>
        <figcaption className="border-b border-border pb-3 text-sm">
          <ReadingProgress label={label("Keep reading")} title={title} page={null} pages={480} />
        </figcaption>
      </figure>
      <figure className="w-full max-w-sm">
        <div className="grid place-items-center pt-6 pb-14">
          <BookObject cover={cover} className="w-[58%] -rotate-2" />
        </div>
        <figcaption className="border-b border-border pb-3 text-sm">
          {label("Your next read")}
          <p className="mt-1.5 font-display text-2xl leading-snug">Because you loved The Night Circus</p>
          <p className="mt-1 flex text-muted">{title}</p>
        </figcaption>
      </figure>
      </div>
    </section>
  );
}
