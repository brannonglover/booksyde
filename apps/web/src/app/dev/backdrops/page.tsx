import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { type Backdrop, BackdropStage, motifFor, motifLabels, motifs, resolveBackdrop } from "@/components/backdrop";
import { BookCover } from "@/components/book-cover";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { type FeaturedBook, getBackdropCandidates, getFeaturedBook, getFeaturedById } from "@/lib/catalog";

/*
 * Development only: one book drawn in every backdrop style side by side, to
 * judge which suits it and to try new motifs. /dev/backdrops?id=<work id>
 */

export const metadata: Metadata = { title: "Backdrops", robots: { index: false } };

type SearchParams = Promise<{ id?: string }>;

export default function BackdropsPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-10 pb-24 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Development</p>
          <h1 className="mt-3 font-display text-5xl tracking-tight">Backdrops</h1>
          <p className="mt-3 max-w-2xl text-muted">
            One book in every backdrop style. &ldquo;Auto&rdquo; is what the home page shows. Generated images and
            setting scenes aren&rsquo;t built yet.
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
    getBackdropCandidates(),
  ]);

  return (
    <>
      <nav aria-label="Books to try" className="flex flex-wrap gap-2">
        {candidates.map((c) => (
          <Link
            key={c.id}
            href={`/dev/backdrops?id=${c.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm transition hover:border-text/40 ${
              c.id === book?.id ? "border-text/60 bg-surface-raised font-semibold" : "border-border bg-surface"
            }`}
          >
            {c.title}
          </Link>
        ))}
      </nav>

      {book ? <Styles book={book} /> : <p className="text-muted">No such book.</p>}
    </>
  );
}

function Styles({ book }: { book: FeaturedBook }) {
  const auto = resolveBackdrop(book);
  const matched = motifFor(book.tags);
  const panels: { label: string; note?: string; backdrop: Backdrop }[] = [
    { label: "Auto", note: describe(auto), backdrop: auto },
    { label: "Blurred cover", backdrop: { style: "cover" } },
    ...motifs.map((motif) => ({
      label: motifLabels[motif],
      note: motif === matched ? "Matches this book's tags" : undefined,
      backdrop: { style: "motif", motif } as const,
    })),
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-3xl italic">{book.title}</h2>
          <p className="text-muted">
            {book.author}
            {book.year ? ` · ${book.year}` : ""}
          </p>
        </div>
        <dl className="text-sm text-muted">
          <div>
            <dt className="inline font-semibold text-text">Override: </dt>
            <dd className="inline">{book.backdrop_style ?? "none (auto)"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-text">Tags: </dt>
            <dd className="inline">{book.tags.map((t) => t.slug).join(", ") || "none"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {panels.map((panel) => (
          <figure key={panel.label}>
            <BackdropStage
              work={book}
              backdrop={panel.backdrop}
              cover={
                <BookCover
                  title={book.title}
                  author={book.author}
                  src={book.cover_url}
                  color={book.cover_color}
                  sizes="140px"
                  className="w-[48%] -rotate-2"
                />
              }
            />
            <figcaption className="mt-2.5 text-sm">
              <span className="font-semibold">{panel.label}</span>
              {panel.note ? <span className="block text-muted">{panel.note}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="text-sm text-muted">
        To pin a style for this book:{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-text">
          update works set backdrop_style = &apos;cover&apos; where id = &apos;{book.id}&apos;;
        </code>{" "}
        (or <code>&apos;motif&apos;</code>; <code>null</code> for auto).
      </p>
    </section>
  );
}

function describe(backdrop: Backdrop) {
  return backdrop.style === "motif" ? `${motifLabels[backdrop.motif]} motif` : "Blurred cover";
}
