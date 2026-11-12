"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BookCover } from "@/components/book-cover";
import type { WiderStacksBook } from "@/lib/catalog";
import { addToCatalogue, type ImportState } from "./actions";

function SlipButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-auto inline-flex items-center gap-2 self-start rounded-full bg-green px-4 py-2 font-sans text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-70"
    >
      {pending ? "Fetching it from the stacks…" : "Add to the catalogue →"}
    </button>
  );
}

/** An Open Library book as a library request slip; submitting it shelves the book here. */
export function RequestSlip({ book, tilt }: { book: WiderStacksBook; tilt: number }) {
  const [state, action] = useActionState<ImportState, FormData>(addToCatalogue, {});
  const byline = book.authors.map((a) => a.name).join(", ") || "Unknown";
  const fields: [string, string | number | null][] = [
    ["Title", book.subtitle ? `${book.title}: ${book.subtitle}` : book.title],
    ["Author", byline],
    ["Year", book.year],
  ];

  const body = (
    <>
      <div className="flex items-center justify-between border-b border-dashed border-[#7E9A6E]/60 pb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[#4A6040] dark:text-[#A9C29A]">
        <span>Request slip</span>
        <span>No. {book.olid.replace(/\D/g, "").slice(-5)}</span>
      </div>
      <div className="mt-3 flex flex-1 gap-4">
        <dl className="flex min-w-0 flex-1 flex-col gap-1.5 font-mono text-[0.8rem] leading-snug">
          {fields.map(([label, value]) =>
            value ? (
              <div key={label} className="grid grid-cols-[3.75rem_1fr] gap-2">
                <dt className="text-[#4A6040]/80 dark:text-[#A9C29A]/80">{label}:</dt>
                <dd className={`border-b border-[#7E9A6E]/35 pb-0.5 ${label === "Title" ? "font-display text-lg leading-tight" : ""}`}>{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <BookCover
          title={book.title}
          author={byline}
          coverId={book.coverId}
          sizes="64px"
          className="w-14 shrink-0 self-start sm:w-16"
        />
      </div>
    </>
  );

  const shell =
    "flex h-full flex-col gap-4 rounded-[3px] bg-[#EEF3E8] p-4 text-ink shadow-[0_1px_2px_rgba(31,27,22,0.1),0_14px_28px_-20px_rgba(31,27,22,0.5)] transition duration-300 hover:-translate-y-0.5 hover:rotate-0 dark:bg-[#2C3529] dark:text-paper";

  // Already on file (someone added it earlier): just go to it.
  if (book.workId) {
    return (
      <Link href={`/books/${book.workId}`} className={shell} style={{ rotate: `${tilt}deg` }}>
        {body}
        <span className="mt-auto self-start rounded-full border border-[#7E9A6E] px-4 py-2 font-sans text-sm font-semibold">
          Now on file — open its card →
        </span>
      </Link>
    );
  }

  return (
    <form action={action} className={shell} style={{ rotate: `${tilt}deg` }}>
      <input type="hidden" name="olid" value={book.olid} />
      {body}
      {state.error ? <p className="font-sans text-sm text-accent">{state.error}</p> : null}
      <SlipButton />
    </form>
  );
}
