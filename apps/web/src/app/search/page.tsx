import { bookIdentity, type CatalogBook, callNumber, catalogName, compactCount, lifeYears } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Stars } from "@/components/stars";
import { getDrawers, parseSearch, searchEverything, searchWiderStacks } from "@/lib/catalog";
import { RequestSlip } from "./request-slip";
import { SearchBox } from "./search-box";

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { q } = parseSearch(await searchParams);
  return { title: q ? `“${q}” in the catalogue` : "The card catalogue" };
}

export default function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6">
        <section className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">The card catalogue</p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight sm:text-7xl">
            What are you <em className="text-accent">looking for</em>?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Ask for a title, an author, an ISBN off the back cover, or just a feeling. We forgive typos.
          </p>
          <div className="mt-8 text-left">
            <Suspense fallback={<SearchBoxFallback />}>
              <SearchBox autoFocus />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

function SearchBoxFallback() {
  return (
    <div className="rounded-[14px] bg-gradient-to-b from-[#D9B46A] via-[#B8893A] to-[#8E6827] p-[3px]">
      <div className="h-[3.75rem] rounded-[11px] bg-[#FFFDF6] dark:bg-[#F3EADB] sm:h-16" />
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-16 grid gap-5 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-sm bg-border/40" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Results */

function hrefFor(q: string, tags: string[]) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (tags.length) p.set("tags", tags.join(","));
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const { q, tags } = parseSearch(await searchParams);
  const drawers = await getDrawers();

  if (!q && tags.length === 0) return <Browse drawers={drawers} />;

  const { books, authors, readers } = await searchEverything(q, tags);
  const tagName = (slug: string) => drawers.find((d) => d.slug === slug)?.name ?? slug;
  const filedUnder = [q ? `“${q}”` : null, ...tags.map(tagName)].filter(Boolean).join(" + ");
  const nothing = books.length === 0 && authors.length === 0 && readers.length === 0;

  return (
    <div className="mt-16">
      {/* Summary + the narrowing chips */}
      <div className="flex flex-col gap-5 border-b border-border pb-6">
        <p className="font-mono text-sm uppercase tracking-[0.12em] text-muted">
          {books.length === 0 ? "No cards" : `${books.length} ${books.length === 1 ? "card" : "cards"}`} filed under{" "}
          <span className="text-text">{filedUnder}</span>
        </p>
        <Narrow q={q} tags={tags} drawers={drawers} />
      </div>

      {nothing ? (
        <NoCards q={q} tags={tags} />
      ) : (
        <div className={`mt-10 grid gap-12 ${authors.length || readers.length ? "lg:grid-cols-[1fr_18rem]" : ""}`}>
          <section aria-label="Books">
            {books.length ? (
              <ol className={`grid gap-6 md:grid-cols-2 ${authors.length || readers.length ? "" : "xl:grid-cols-3"}`}>
                {books.map((book, i) => (
                  <li key={book.id}>
                    <CatalogueCard book={book} tilt={i % 3 === 1 ? 0.5 : i % 3 === 2 ? -0.4 : 0} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-sm border border-dashed border-border p-8 text-center text-muted">
                No books under that — but there are people and authors by that name.
              </p>
            )}
          </section>
          {authors.length || readers.length ? (
            <aside className="flex flex-col gap-10">
              {authors.length ? <AuthorList authors={authors} /> : null}
              {readers.length ? <ReaderList readers={readers} /> : null}
            </aside>
          ) : null}
        </div>
      )}

      {q && tags.length === 0 ? (
        <Suspense fallback={<StacksSkeleton />}>
          <WiderStacks
            q={q}
            onFile={books.map((b) => bookIdentity(b.title, leadAuthor(b)?.name))}
            headline={books.length === 0}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function leadAuthor(book: CatalogBook) {
  return [...book.work_contributors].filter((c) => c.role === "author").sort((a, b) => a.position - b.position)[0]?.authors;
}

function StacksSkeleton() {
  return (
    <div className="mt-20 grid gap-5 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-44 animate-pulse rounded-sm bg-border/40" />
      ))}
    </div>
  );
}

/** Open Library results we don't hold yet, as request slips that add them to the catalogue. */
async function WiderStacks({ q, onFile, headline }: { q: string; onFile: string[]; headline: boolean }) {
  const found = await searchWiderStacks(q);
  const held = new Set(onFile);
  const books = (found ?? []).filter((b) => !held.has(bookIdentity(b.title, b.authors[0]?.name))).slice(0, 6);
  if (found && books.length === 0) return null;

  return (
    <section aria-labelledby="wider-stacks" className={headline ? "mt-14" : "mt-20 border-t border-border pt-12"}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Not on file yet</p>
          <h2 id="wider-stacks" className="mt-2 font-display text-4xl leading-none sm:text-5xl">
            From the <em className="text-accent">wider stacks</em>
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            {headline ? "We don’t have it on our shelves yet, but these are out there. " : ""}
            Fill in a request slip and we’ll add the book to the catalogue, ready to shelve and review.
          </p>
        </div>
        <a
          href={`https://openlibrary.org/search?q=${encodeURIComponent(q)}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted underline decoration-border underline-offset-4 hover:text-text"
        >
          Courtesy of Open Library ↗
        </a>
      </div>
      {found === null ? (
        <p className="mt-8 rounded-sm border border-dashed border-border p-6 text-center text-muted">
          The wider stacks aren’t answering right now. Try again in a moment.
        </p>
      ) : (
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book, i) => (
            <li key={book.olid}>
              <RequestSlip book={book} tilt={i % 3 === 1 ? -0.5 : i % 3 === 2 ? 0.4 : 0} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type Drawer = Awaited<ReturnType<typeof getDrawers>>[number];

/** Mood and genre chips that add to (or remove from) the current search. */
function Narrow({ q, tags, drawers }: { q: string; tags: string[]; drawers: Drawer[] }) {
  const options = drawers.filter((d) => (d.kind === "mood" || d.kind === "genre") && (d.works > 0 || tags.includes(d.slug)));
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Narrow by</span>
      {options.map((d) => {
        const on = tags.includes(d.slug);
        const ink = genreColor(d.slug);
        const next = on ? tags.filter((t) => t !== d.slug) : [...tags, d.slug];
        return (
          <Link
            key={d.slug}
            href={hrefFor(q, next)}
            scroll={false}
            aria-pressed={on}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition ${
              on ? "border-transparent font-semibold" : "border-border text-muted hover:border-text/30 hover:text-text"
            }`}
            style={on ? { background: ink.bg, color: ink.fg } : undefined}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: ink.dot }} />
            {d.name}
            {on ? <span aria-hidden>✕</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

function NoCards({ q, tags }: { q: string; tags: string[] }) {
  return (
    <div className="mx-auto mt-14 max-w-lg">
      <div className="index-card relative rotate-[-0.6deg] rounded-sm px-8 pb-12 pt-7 shadow-[0_18px_40px_-24px_rgba(31,27,22,0.55)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Not on file</p>
        <p className="mt-3 font-display text-3xl leading-tight">This drawer is empty.</p>
        <p className="ruled mt-3 font-mono text-sm">
          {q ? <>Nothing in our drawers answers to “{q}” yet. </> : null}
          {tags.length
            ? "Try lifting a filter or two — or browse the drawers instead."
            : "If it’s in print, it’s probably in the wider stacks below."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          {tags.length && q ? (
            <Link href={hrefFor(q, [])} className="rounded-full bg-primary px-4 py-2 text-primary-text hover:opacity-90">
              Search “{q}” everywhere
            </Link>
          ) : null}
          <Link href="/search" className="rounded-full border border-border px-4 py-2 hover:bg-surface">
            Browse the drawers
          </Link>
        </div>
        <Hole />
      </div>
    </div>
  );
}

/** The punched hole at the foot of every catalogue card. */
function Hole() {
  return (
    <span
      aria-hidden
      className="absolute bottom-3 left-1/2 size-4 -translate-x-1/2 rounded-full bg-background shadow-[inset_0_1px_3px_rgba(31,27,22,0.45)]"
    />
  );
}

/** One book as a typed library catalogue card. */
function CatalogueCard({ book, tilt }: { book: CatalogBook; tilt: number }) {
  const authors = [...book.work_contributors]
    .filter((c) => c.role === "author")
    .sort((a, b) => a.position - b.position)
    .map((c) => c.authors);
  const lead = authors[0];
  const byline = authors.map((a) => a.name).join(" & ") || "Unknown";
  const subjects = [...book.work_tags]
    .filter((t) => t.votes > 0 && (t.tags.kind === "genre" || t.tags.kind === "mood"))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4)
    .map((t) => t.tags);

  return (
    <Link
      href={`/books/${book.id}`}
      className="index-card group relative block h-full rounded-sm px-5 pb-10 pt-4 shadow-[0_1px_2px_rgba(31,27,22,0.1),0_16px_32px_-22px_rgba(31,27,22,0.55)] transition duration-300 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_1px_2px_rgba(31,27,22,0.1),0_26px_40px_-24px_rgba(31,27,22,0.6)] sm:px-6"
      style={{ rotate: `${tilt}deg` }}
    >
      {/* Call number in the margin, heading on the red rule */}
      <div className="flex items-baseline gap-3 border-b border-oxblood/50 pb-1.5 font-mono text-[0.8rem] dark:border-[#C97B6B]/50">
        <span className="shrink-0 text-xs font-semibold text-accent">{callNumber(book, lead?.name)}</span>
        <span className="truncate text-muted">
          {lead ? catalogName(lead.name) : "Anonymous"}
          {lead && lifeYears(lead.birth_date, lead.death_date) ? `, ${lifeYears(lead.birth_date, lead.death_date)}` : ""}.
        </span>
      </div>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 font-mono text-[0.8rem] leading-[1.55]">
          <p className="mt-3 font-display text-[1.65rem] leading-[1.05] tracking-tight group-hover:text-accent">{book.title}</p>
          {book.subtitle ? <p className="mt-1 text-muted">{book.subtitle}</p> : null}
          <p className="mt-2">
            / by {byline}.{book.first_published_year ? ` — First published ${book.first_published_year}.` : ""}
          </p>
          {book.ratings_count > 0 ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 font-sans text-sm">
              <Stars rating={Number(book.avg_rating)} />
              <span className="text-muted">
                {Number(book.avg_rating).toFixed(1)} · {compactCount(book.ratings_count)} ratings
              </span>
            </p>
          ) : null}
          {subjects.length ? (
            <p className="mt-3 text-muted">
              {subjects.map((t, i) => (
                <span key={t.slug}>
                  {i + 1}. {t.name}
                  {t.kind === "genre" ? " — Fiction" : ""}.{" "}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <BookCover
          title={book.title}
          author={byline}
          src={book.cover_url}
          color={book.cover_color}
          sizes="80px"
          className="mt-4 w-16 shrink-0 self-start sm:w-20"
        />
      </div>
      <Hole />
    </Link>
  );
}

type Author = Awaited<ReturnType<typeof searchEverything>>["authors"][number];
type Reader = Awaited<ReturnType<typeof searchEverything>>["readers"][number];

function AsideHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted">
      {children}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h2>
  );
}

function AuthorList({ authors }: { authors: Author[] }) {
  return (
    <section>
      <AsideHeading>Authors</AsideHeading>
      <ul className="flex flex-col gap-3">
        {authors.map((a) => {
          const n = a.works;
          return (
            <li key={a.id}>
              <Link href={hrefFor(a.name, [])} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
                <span
                  aria-hidden
                  className="grid size-12 shrink-0 place-items-center rounded-full border border-gilt/60 bg-surface font-display text-xl"
                >
                  {a.name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-xl leading-tight">{a.name}</span>
                  <span className="text-sm text-muted">
                    {[lifeYears(a.birth_date, a.death_date), `${n} ${n === 1 ? "book" : "books"} on file`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReaderList({ readers }: { readers: Reader[] }) {
  return (
    <section>
      <AsideHeading>Readers</AsideHeading>
      <ul className="flex flex-col gap-3">
        {readers.map((r) => {
          const ink = r.theme_color ?? "var(--bk-green)";
          const name = r.display_name || r.username;
          return (
            <li key={r.id}>
              <Link
                href={`/u/${r.username}`}
                className="flex items-center gap-3 rounded-sm border-[3px] border-double bg-[#FBF5E8] p-3 text-ink hover:-translate-y-0.5 transition dark:bg-[#2F2822] dark:text-paper"
                style={{ borderColor: ink }}
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-gilt font-display text-xl text-paper"
                  style={{ background: ink }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg leading-tight">{name}</span>
                  <span className="block truncate text-xs text-muted">
                    @{r.username}
                    {r.is_private ? " · 🔒" : ""} · {compactCount(r.followers_count)}{" "}
                    {r.followers_count === 1 ? "follower" : "followers"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- Browse */

const suggestions = [
  { label: "Jane Austen", href: hrefFor("Jane Austen", []) },
  { label: "frankenstien", note: "typo and all", href: hrefFor("frankenstien", []) },
  { label: "978-0-14-143951-8", note: "an ISBN", href: hrefFor("978-0-14-143951-8", []) },
  { label: "gothic", href: hrefFor("gothic", []) },
];

/** No query yet: a few things to ask the desk, and the cabinet of subject drawers. */
function Browse({ drawers }: { drawers: Drawer[] }) {
  const moods = drawers.filter((d) => d.kind === "mood");
  const genres = drawers.filter((d) => d.kind === "genre");
  return (
    <div className="mt-14">
      <p className="text-center text-sm text-muted">
        <span className="mr-1">Try asking for</span>
        {suggestions.map((s, i) => (
          <span key={s.label}>
            <Link href={s.href} className="font-mono text-text underline decoration-border underline-offset-4 hover:decoration-accent">
              {s.label}
            </Link>
            {s.note ? <span className="italic"> ({s.note})</span> : null}
            {i < suggestions.length - 2 ? ", " : i === suggestions.length - 2 ? " or " : ""}
          </span>
        ))}
      </p>

      <div className="mt-16 grid gap-14 lg:grid-cols-2">
        <Cabinet title="By feeling" blurb="Pull out a drawer for the mood you’re in." drawers={moods} />
        <Cabinet title="By shelf" blurb="The old-fashioned way: genre by genre." drawers={genres} />
      </div>
    </div>
  );
}

function Cabinet({ title, blurb, drawers }: { title: string; blurb: string; drawers: Drawer[] }) {
  return (
    <section>
      <h2 className="font-display text-4xl leading-none">{title}</h2>
      <p className="mt-2 text-muted">{blurb}</p>
      {/* Walnut cabinet */}
      <div className="mt-6 rounded-md bg-[#4A3426] p-2.5 shadow-[0_24px_50px_-28px_rgba(31,27,22,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] dark:bg-[#3A2A1F]">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {drawers.map((d) => (
            <li key={d.slug}>
              <DrawerFront drawer={d} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DrawerFront({ drawer }: { drawer: Drawer }) {
  const ink = genreColor(drawer.slug);
  const empty = drawer.works === 0;
  const face = (
    <>
      {/* Brass label holder */}
      <span className="block rounded-[3px] bg-gradient-to-b from-[#D9B46A] to-[#8E6827] p-[2px] shadow-sm">
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-[2px] bg-[#FFFDF6] px-2 py-1 text-center font-mono text-[0.75rem] leading-tight text-ink">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: ink.dot }} />
          <span>{drawer.name}</span>
        </span>
      </span>
      <span aria-hidden className="block h-3 shrink-0" />
      {/* Pull */}
      <span
        aria-hidden
        className="mx-auto mt-auto block h-3 w-10 rounded-b-full border-2 border-t-0 border-[#C9A35A] transition-transform group-hover:translate-y-0.5"
      />
      <span className="mt-2 block text-center text-[0.7rem] uppercase tracking-[0.15em] text-[#E8D9BF]/70">
        {empty ? "empty" : `${drawer.works} ${drawer.works === 1 ? "card" : "cards"}`}
      </span>
    </>
  );
  const shell =
    "group flex h-full flex-col rounded-[4px] bg-gradient-to-b from-[#7A5534] to-[#5E4026] px-3 pb-2.5 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.25)]";
  if (empty) return <div className={`${shell} opacity-55`}>{face}</div>;
  return (
    <Link
      href={hrefFor("", [drawer.slug])}
      className={`${shell} transition hover:-translate-y-0.5 hover:from-[#86603C] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_18px_-10px_rgba(0,0,0,0.6)]`}
    >
      {face}
    </Link>
  );
}
