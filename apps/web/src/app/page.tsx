import { formatRating } from "@booksyde/shared";
import Link from "next/link";
import { genreColor } from "@booksyde/theme";
import { BookCover } from "@/components/book-cover";
import { FeatureBento } from "@/components/feature-bento";
import { Stars } from "@/components/stars";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";

// Placeholder shelf until the catalog is wired up. Ids match supabase/seed.sql; cover ids are Open Library's.
const nightstand = [
  { id: "00000000-0000-4000-b000-000000000001", title: "Pride and Prejudice", author: "Jane Austen", coverId: 14348537, rating: 4.5 },
  { id: "00000000-0000-4000-b000-000000000007", title: "Wuthering Heights", author: "Emily Brontë", coverId: 12818862, rating: 4 },
  { id: "00000000-0000-4000-b000-000000000006", title: "Jane Eyre", author: "Charlotte Brontë", coverId: 8235363, rating: 4.5 },
  { id: "00000000-0000-4000-b000-000000000002", title: "Frankenstein", author: "Mary Shelley", coverId: 12356249, rating: 4 },
  { id: "00000000-0000-4000-b000-000000000003", title: "Moby-Dick", author: "Herman Melville", coverId: 10544254, rating: 3.5 },
];

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

          {/* Tonight's pick, framed in a library-window arch */}
          <figure className="mx-auto w-full max-w-sm">
            <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-t-full bg-green">
              <div aria-hidden className="absolute inset-3 rounded-t-full border border-gilt/45" />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/2"
                style={{ background: "radial-gradient(60% 60% at 50% 100%, rgba(216,176,104,0.28), transparent)" }}
              />
              <BookCover
                title="Pride and Prejudice"
                author="Jane Austen"
                coverId={14348537}
                sizes="200px"
                priority
                className="mt-10 w-[48%] -rotate-2"
              />
            </div>
            <figcaption className="flex items-baseline justify-between gap-4 border-b border-border py-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Tonight&rsquo;s pick</span>
              <span>
                <span className="font-display text-lg italic">Pride and Prejudice</span>
                <span className="text-muted"> &middot; 1813</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section id="discover" className="flex flex-col gap-6">
          <SectionHeading numeral="I">What are you in the mood for?</SectionHeading>
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {nightstand.map((book) => (
              <Link key={book.title} href={`/books/${book.id}`} className="group flex flex-col gap-4">
                <BookCover
                  title={book.title}
                  author={book.author}
                  coverId={book.coverId}
                  className="transition duration-300 group-hover:-translate-y-1"
                />
                <div>
                  <h3 className="font-display text-xl leading-tight">{book.title}</h3>
                  <p className="text-sm text-muted">{book.author}</p>
                  <p className="mt-1.5 text-sm">
                    <Stars rating={book.rating} /> <span className="text-muted">{formatRating(book.rating)}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

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
          <SectionHeading numeral="III">A few things you&rsquo;ll love</SectionHeading>
          <FeatureBento />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
