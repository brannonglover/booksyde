import { bookIdentity, getMyBooks, getPicksFromShelf, getShelfProfile } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Bookshelf, type ShelfBook } from "@/components/bookshelf";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getDiscoverShelves, getSimilarBooks, getWiderStacksPicks, type WiderStacksBook } from "@/lib/catalog";
import { RequestSlip } from "../search/request-slip";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Discover",
  description: "The most-shelved books on Booksyde, a shelf for every mood, and picks pulled from your own reading.",
};

export default function DiscoverPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-4 pb-24 sm:px-6">
        <header className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Discover</p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight sm:text-7xl">
            Wander the <em className="text-accent">stacks</em>.
          </h1>
          <Ornament className="mt-6 justify-center" />
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            What other readers keep reaching for, a shelf for every taste, and a few picks pulled from your own reading.
          </p>
        </header>

        <Suspense fallback={<ShelfSkeleton />}>
          <ForYou />
        </Suspense>

        <Suspense fallback={<ShelfSkeleton />}>
          <PublicShelves />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------- For you */

const MAX_SEED_ROWS = 2;
/** Plenty of books have no tags or embedding yet (so no "more like this"); keep trying the next one. */
const MAX_SEED_TRIES = 8;
/** A "Because you shelved…" row needs at least this many new books to be worth showing. */
const MIN_ROW = 3;
/** Below this many picks from our own shelves, look further afield on Open Library. */
const WIDER_STACKS_BELOW = 6;
const WIDER_STACKS_PICKS = 6;

/** Picks from the reader's own shelves; an invitation when signed out. */
async function ForYou() {
  // Reads the session cookie, so it can only run at request time.
  await connection();
  if (!hasSupabaseEnv) return null;
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return <SignedOutNote />;

  const mine = await getMyBooks(client).catch(() => []);
  const shelved = new Set(mine.flatMap((b) => (b.works ? [b.works.id] : [])));
  // Books they've finished or are reading say the most about their taste; fall back to their wishlist.
  const read = mine.filter((b) => b.status === "read" || b.status === "reading");
  const ranked = [...read, ...mine.filter((b) => b.status === "want_to_read")];
  const seeds = ranked.flatMap((b) => (b.works ? [b.works] : []));

  if (seeds.length === 0) {
    return (
      <ForYouSection>
        <EmptyNote>
          Shelve a few books you&rsquo;ve loved and we&rsquo;ll start pulling picks for you.{" "}
          <Link href="/search" className="font-semibold text-accent hover:underline">
            Find one in the catalogue
          </Link>
        </EmptyNote>
      </ForYouSection>
    );
  }

  // One row weighed against everything they've read, then a row or two for single favourites.
  const pooledFrom = read.length ? read : ranked;
  const pooled = await getPicksFromShelf(client, {
    seeds: pooledFrom.flatMap((b) => (b.works ? [b.works.id] : [])),
    exclude: shelved,
  }).catch(() => []);

  const seen = new Set([...shelved, ...pooled.map((w) => w.id)]);
  const rows: { seed: (typeof seeds)[number]; books: ShelfBook[] }[] = [];
  for (const seed of seeds.slice(0, MAX_SEED_TRIES)) {
    // Ask for every match, not just the top few: the best ones are often already on their shelves.
    const similar = await getSimilarBooks(seed.id, 50).catch(() => []);
    const books = similar.filter((w) => !seen.has(w.id)).slice(0, 6);
    if (books.length < MIN_ROW) continue;
    for (const w of books) seen.add(w.id);
    rows.push({ seed, books });
    if (rows.length === MAX_SEED_ROWS) break;
  }

  const localPicks = pooled.length + rows.reduce((n, r) => n + r.books.length, 0);
  const widerStacks =
    localPicks < WIDER_STACKS_BELOW ? (
      <Suspense fallback={<SlipsSkeleton />}>
        <WiderStacksPicks
          shelved={[...shelved]}
          read={pooledFrom.flatMap((b) => (b.works ? [b.works.id] : []))}
          headline={localPicks === 0}
        />
      </Suspense>
    ) : null;

  return (
    <ForYouSection>
      {pooled.length ? (
        <div className="flex flex-col gap-6">
          <h3 className="text-sm text-muted">
            From the{" "}
            <span className="font-display text-xl italic text-text">
              {pooledFrom.length} {pooledFrom.length === 1 ? "book" : "books"}
            </span>{" "}
            {read.length ? "you\u2019ve read" : "on your shelves"}
          </h3>
          <Bookshelf books={pooled} />
        </div>
      ) : null}
      {rows.map(({ seed, books }) => (
        <div key={seed.id} className="flex flex-col gap-6">
          <h3 className="text-sm text-muted">
            Because you shelved{" "}
            <Link href={`/books/${seed.id}`} className="font-display text-xl italic text-text hover:text-accent">
              {seed.title}
            </Link>
          </h3>
          <Bookshelf books={books} />
        </div>
      ))}
      {widerStacks}
    </ForYouSection>
  );
}

/**
 * When our own shelves run dry: Open Library books by the reader's favourite
 * authors and in their top genres, as request slips that add them here.
 */
async function WiderStacksPicks({ shelved, read, headline }: { shelved: string[]; read: string[]; headline: boolean }) {
  const client = await createClient();
  const profile = await getShelfProfile(client, shelved, read).catch(() => null);
  const found =
    profile && (profile.authors.length || profile.genres.length)
      ? await getWiderStacksPicks(profile.authors.slice(0, 3), profile.genres.slice(0, 3))
      : { byAuthor: [], bySubject: [] };
  const onShelf = new Set(shelved);
  const owned = new Set((profile?.titles ?? []).map((t) => bookIdentity(t.title, t.author)));
  const isNew = (b: WiderStacksBook) =>
    !(b.workId && onShelf.has(b.workId)) && !owned.has(bookIdentity(b.title, b.authors[0]?.name));

  // A mix: up to four by favourite authors (two each at most), the rest from their genres,
  // topped up with more by those authors if the genres come up short.
  const picks: WiderStacksBook[] = [];
  const taken = new Set<string>();
  const perAuthor = new Map<string, number>();
  const take = (books: WiderStacksBook[], cap: number, perAuthorCap: number) => {
    for (const b of books) {
      if (picks.length >= cap) return;
      const author = b.authors[0]?.name ?? "";
      if (taken.has(b.olid) || !isNew(b) || (perAuthor.get(author) ?? 0) >= perAuthorCap) continue;
      taken.add(b.olid);
      perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
      picks.push(b);
    }
  };
  take(found.byAuthor, 4, 2);
  take(found.bySubject, WIDER_STACKS_PICKS, 1);
  take(found.byAuthor, WIDER_STACKS_PICKS, 3);
  if (picks.length === 0) {
    return headline ? (
      <EmptyNote>
        You&rsquo;ve already shelved everything we know of that&rsquo;s like the books you read.{" "}
        <Link href="/search" className="font-semibold text-accent hover:underline">
          Search the catalogue
        </Link>{" "}
        for something new.
      </EmptyNote>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm text-muted">
          From the <span className="font-display text-xl italic text-text">wider stacks</span>
        </h3>
        <p className="mt-1 max-w-xl text-sm text-muted">
          {headline ? "You\u2019ve shelved nearly everything we hold that suits you, so we looked further afield. " : ""}
          Not on Booksyde yet: add one to the catalogue and it&rsquo;s ready to shelve.
        </p>
      </div>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((book, i) => (
          <li key={book.olid}>
            <RequestSlip book={book} tilt={i % 3 === 1 ? -0.5 : i % 3 === 2 ? 0.4 : 0} />
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        Courtesy of{" "}
        <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-text">
          Open Library
        </a>
      </p>
    </div>
  );
}

function SlipsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-sm bg-border/40" />
      ))}
    </div>
  );
}

function ForYouSection({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="for-you" className="flex flex-col gap-8">
      <div className="border-b border-border pb-4">
        <h2 id="for-you" className="font-display text-4xl leading-none sm:text-5xl">
          Picked <em className="text-accent">for you</em>
        </h2>
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-muted">{children}</p>;
}

function SignedOutNote() {
  return (
    <aside className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-7 text-center sm:flex-row sm:text-left">
      <p className="flex-1 text-muted">
        <span className="font-display text-2xl text-text">Want picks of your own?</span>
        <br />
        Sign in and we&rsquo;ll pull suggestions from the books on your shelves.
      </p>
      <div className="flex shrink-0 gap-2 text-sm font-semibold">
        <Link href="/sign-in" className="rounded-full px-4 py-2 hover:bg-surface-raised">
          Sign in
        </Link>
        <Link href="/sign-up" className="rounded-full bg-primary px-4 py-2 text-primary-text hover:opacity-90">
          Join free
        </Link>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------- Public shelves */

async function PublicShelves() {
  const { trending, drawers, moods } = await getDiscoverShelves();
  const chips = (kind: string) => drawers.filter((d) => d.kind === kind && d.works > 0);
  const tropes = chips("trope");
  const paces = chips("pace");
  // Number only the sections that actually render.
  const numerals = ["I", "II", "III"];
  let n = 0;
  const next = () => numerals[n++];

  return (
    <>
      {trending.length ? (
        <section className="flex flex-col gap-8">
          <SectionHeading
            numeral={next()}
            aside={
              <Link href="/search" className="shrink-0 text-sm font-semibold text-accent hover:underline">
                Browse all →
              </Link>
            }
          >
            Most shelved
          </SectionHeading>
          <Bookshelf books={trending} />
        </section>
      ) : null}

      {moods.length ? (
        <section className="flex flex-col gap-12">
          <SectionHeading numeral={next()}>Shelf by shelf</SectionHeading>
          {moods.map(({ drawer, books }) => {
            const ink = genreColor(drawer.slug);
            return (
              <div key={drawer.slug} className="flex flex-col gap-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="inline-flex items-center gap-2.5 font-display text-3xl">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: ink.dot }} />
                    {drawer.name}
                  </h3>
                  <Link
                    href={`/search?tags=${drawer.slug}`}
                    className="shrink-0 text-sm font-semibold text-accent hover:underline"
                  >
                    All {drawer.works} →
                  </Link>
                </div>
                <Bookshelf books={books} />
              </div>
            );
          })}
        </section>
      ) : null}

      {tropes.length || paces.length ? (
        <section className="flex flex-col gap-8">
          <SectionHeading numeral={next()}>Or go by feel</SectionHeading>
          <div className="grid gap-10 md:grid-cols-2">
            {tropes.length ? <ChipGroup title="Tropes" blurb="The stories you can’t resist." drawers={tropes} /> : null}
            {paces.length ? <ChipGroup title="Pace" blurb="A page-turner, or something to savour." drawers={paces} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

type Drawer = Awaited<ReturnType<typeof getDiscoverShelves>>["drawers"][number];

function ChipGroup({ title, blurb, drawers }: { title: string; blurb: string; drawers: Drawer[] }) {
  return (
    <div>
      <h3 className="font-display text-3xl leading-none">{title}</h3>
      <p className="mt-2 text-muted">{blurb}</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {drawers.map((d) => (
          <Link
            key={d.slug}
            href={`/search?tags=${d.slug}`}
            className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 font-medium transition hover:border-text/40 hover:bg-surface-raised"
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(d.slug).dot }} />
            {d.name}
            <span className="text-sm text-muted">{d.works}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ShelfSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-12 w-72 animate-pulse rounded bg-border/50" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 sm:gap-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`aspect-[2/3] animate-pulse rounded bg-border/50 ${i > 2 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
    </div>
  );
}
