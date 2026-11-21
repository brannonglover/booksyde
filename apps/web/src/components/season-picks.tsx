import type { SeasonPick } from "@booksyde/shared";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { HollySprig } from "@/components/holly";
import { getSeasonPicks } from "@/lib/season-picks";

/**
 * December on the home page: this week's bestseller beside a Christmas book
 * readers are picking up. Rendered from mid-November to mid-January, but only
 * shown while it's December on the reader's clock (the `christmas:` variant).
 */
export async function SeasonPicksSection() {
  const picks = await getSeasonPicks().catch(() => null);
  const books = [picks?.bestseller, picks?.christmas].filter((b): b is SeasonPick => Boolean(b));
  if (!books.length) return null;
  return (
    <section aria-labelledby="season-picks" className="-mt-8 hidden flex-col gap-6 christmas:flex">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            <HollySprig className="text-base text-highlight" />
            Season&rsquo;s readings
          </p>
          <h2 id="season-picks" className="mt-2 font-display text-4xl leading-none sm:text-5xl">
            Two for the <em className="text-accent">holidays</em>
          </h2>
        </div>
        <p className="hidden max-w-xs shrink-0 text-right text-sm text-muted sm:block">
          One the whole country is reading, and one to curl up with by the tree.
        </p>
      </div>
      <div className={`grid gap-4 ${books.length > 1 ? "md:grid-cols-2" : "md:max-w-xl"}`}>
        {books.map((book) => (
          <SeasonPickCard key={book.kind} book={book} />
        ))}
      </div>
    </section>
  );
}

function SeasonPickCard({ book }: { book: SeasonPick }) {
  const href = book.id ? `/books/${book.id}` : `/search?q=${encodeURIComponent(`${book.title} ${book.author}`.trim())}`;
  return (
    <Link
      href={href}
      className="group flex items-center gap-5 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-raised hover:shadow-[0_14px_30px_-22px_rgba(31,27,22,0.6)] sm:p-5"
    >
      <BookCover
        title={book.title}
        author={book.author}
        src={book.cover_url}
        color={book.cover_color}
        sizes="96px"
        className="w-20 shrink-0 sm:w-24"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{book.note}</p>
        <h3 className="mt-2 font-display text-2xl leading-tight sm:text-[1.7rem]">{book.title}</h3>
        <p className="mt-1 truncate text-sm text-muted">
          {book.author}
          {book.year ? <> &middot; {book.year}</> : null}
        </p>
      </div>
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-lg transition group-hover:border-accent group-hover:bg-accent group-hover:text-surface"
      >
        →
      </span>
    </Link>
  );
}
