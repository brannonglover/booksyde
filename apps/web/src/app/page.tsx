import { formatRating } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import { BookCover } from "@/components/book-cover";
import { FeatureBento } from "@/components/feature-bento";
import { Stars } from "@/components/stars";
import { ThemePicker, ThemeToggleButton } from "@/components/theme-toggle";

// Placeholder shelf until the catalog is wired up. Cover ids are Open Library's.
const nightstand = [
  { title: "Pride and Prejudice", author: "Jane Austen", coverId: 14348537, rating: 4.5 },
  { title: "Wuthering Heights", author: "Emily Brontë", coverId: 12818862, rating: 4 },
  { title: "Jane Eyre", author: "Charlotte Brontë", coverId: 8235363, rating: 4.5 },
  { title: "Frankenstein", author: "Mary Shelley", coverId: 12356249, rating: 4 },
  { title: "Moby-Dick", author: "Herman Melville", coverId: 10544254, rating: 3.5 },
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

function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-3 text-highlight ${className}`}>
      <span className="h-px w-10 bg-current opacity-60" />
      <span className="text-lg leading-none">❦</span>
      <span className="h-px w-10 bg-current opacity-60" />
    </div>
  );
}

function SectionHeading({ numeral, children, aside }: { numeral: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <h2 className="font-display text-4xl leading-none sm:text-5xl">
        <span className="mr-3 text-2xl italic text-highlight sm:text-3xl">{numeral}.</span>
        {children}
      </h2>
      {aside}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-3xl leading-none">
            Booksyde<span className="text-highlight">.</span>
          </span>
          <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <a className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="#discover">
              Discover
            </a>
            <a className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="#join">
              Clubs
            </a>
            <ThemeToggleButton />
            <a className="rounded-full px-3 py-2 hover:bg-surface sm:px-4" href="#join">
              Sign in
            </a>
            <a className="rounded-full bg-primary px-4 py-2 text-primary-text hover:opacity-90" href="#join">
              Join free
            </a>
          </nav>
        </div>
      </header>

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
              action="#discover"
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
              <a href="#discover" className="underline decoration-border underline-offset-4 hover:text-text">
                Jane Austen
              </a>
              ,{" "}
              <a href="#discover" className="underline decoration-border underline-offset-4 hover:text-text">
                gothic
              </a>{" "}
              or{" "}
              <a href="#discover" className="underline decoration-border underline-offset-4 hover:text-text">
                rainy-day mysteries
              </a>
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
              <a
                key={slug}
                href="#discover"
                className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 font-medium transition hover:border-text/40 hover:bg-surface-raised"
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(slug).dot }} />
                {label}
              </a>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <SectionHeading
            numeral="II"
            aside={
              <a href="#discover" className="shrink-0 text-sm font-semibold text-accent hover:underline">
                See all →
              </a>
            }
          >
            On everyone&rsquo;s nightstand
          </SectionHeading>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {nightstand.map((book) => (
              <article key={book.title} className="group flex flex-col gap-4">
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
              </article>
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

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-1">
            <span className="font-display text-2xl text-text">
              Booksyde<span className="text-highlight">.</span>
            </span>
            <span className="italic">Set in Instrument Serif &amp; Plus Jakarta Sans. Made for readers.</span>
          </div>
          <ThemePicker />
        </div>
      </footer>
    </div>
  );
}
