"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { seriesLabel } from "@booksyde/shared";
import { BookCover } from "@/components/book-cover";
import { SeriesLine } from "@/components/series-line";
import { ShelfBook } from "@/components/shelf-book";
import type { WiderStacksBook } from "@/lib/catalog";
import { addToCatalogue, type ImportState } from "./actions";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-70"
    >
      {pending ? (
        "Adding…"
      ) : (
        <>
          <span aria-hidden className="text-base leading-none">+</span> Add to Booksyde
        </>
      )}
    </button>
  );
}

/** Stretched over the whole slip so clicking anywhere on the book opens it, like a catalogue card does. */
function SlipCover() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      tabIndex={-1}
      aria-hidden
      className="absolute inset-0 z-0 cursor-pointer rounded-2xl disabled:cursor-wait"
    />
  );
}

/** An Open Library book we don't hold yet; clicking the slip adds it to the catalogue and opens its page. */
export function RequestSlip({ book }: { book: WiderStacksBook }) {
  const [state, action] = useActionState<ImportState, FormData>(addToCatalogue, {});
  const byline = book.authors.map((a) => a.name).join(", ") || "Unknown";

  const shell =
    "group relative flex h-full gap-5 rounded-2xl border border-dashed border-border p-4 transition duration-300 hover:-translate-y-1 hover:border-solid hover:border-text/20 hover:bg-surface sm:p-5";

  const cover = (
    <BookCover
      title={book.title}
      author={byline}
      coverId={book.coverId}
      sizes="96px"
      className="pointer-events-none w-20 shrink-0 self-start transition duration-300 group-hover:-rotate-2 group-hover:scale-[1.04] sm:w-24"
    />
  );
  const details = (
    <>
      {book.year ? <p className="text-xs font-medium tabular-nums text-muted">{book.year}</p> : null}
      <h3 className="mt-0.5 line-clamp-2 font-display text-2xl leading-[1.05] tracking-tight">{book.title}</h3>
      {book.subtitle ? <p className="mt-1 line-clamp-1 text-sm text-muted">{book.subtitle}</p> : null}
      <p className="mt-1.5 truncate text-sm">
        <span className="text-muted">by </span>
        <span className="font-medium">{byline}</span>
      </p>
      {book.series ? <SeriesLine label={seriesLabel(book.series)} /> : null}
    </>
  );

  // Already on file (someone added it earlier): just go to it, and it can go on a shelf like any other book.
  if (book.workId) {
    return (
      <ShelfBook workId={book.workId} title={book.title} className="h-full" linkClassName={shell}>
        {cover}
        <div className="flex min-w-0 flex-1 flex-col">
          {details}
          <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-sm font-semibold text-accent">
            Now on Booksyde <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </ShelfBook>
    );
  }

  return (
    <form action={action} className={shell}>
      <input type="hidden" name="olid" value={book.olid} />
      <SlipCover />
      {cover}
      <div className="flex min-w-0 flex-1 flex-col">
        {details}
        <div className="mt-auto flex flex-col items-start gap-2 pt-4">
          {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}
          <AddButton />
        </div>
      </div>
    </form>
  );
}
