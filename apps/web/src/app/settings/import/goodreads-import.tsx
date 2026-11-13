"use client";

import {
  GOODREADS_BATCH_SIZE,
  type GoodreadsBook,
  goodreadsSearchTitle,
  NotAGoodreadsExportError,
  parseGoodreadsExport,
  READING_STATUS_LABELS,
} from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import Link from "next/link";
import { useRef, useState } from "react";
import { importGoodreadsBatch, type RowOutcome } from "./actions";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const statusOrder: ReadingStatus[] = ["read", "reading", "want_to_read", "did_not_finish"];

type Phase =
  | { kind: "pick"; error?: string }
  | { kind: "review"; fileName: string; books: GoodreadsBook[] }
  | { kind: "importing"; books: GoodreadsBook[]; done: number; outcomes: RowOutcome[] }
  | { kind: "finished"; books: GoodreadsBook[]; outcomes: RowOutcome[]; stopped: string | null };

/** Upload a Goodreads export, check what's in it, then shelve it batch by batch. */
export function GoodreadsImport({ username }: { username: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [includeReviews, setIncludeReviews] = useState(true);
  const cancelled = useRef(false);

  async function readFile(file: File) {
    if (file.size > MAX_FILE_BYTES) return setPhase({ kind: "pick", error: "That file is larger than any Goodreads export we’ve seen." });
    try {
      const books = parseGoodreadsExport(await file.text());
      if (!books.length) return setPhase({ kind: "pick", error: "That export has no books in it." });
      setPhase({ kind: "review", fileName: file.name, books });
    } catch (e) {
      setPhase({
        kind: "pick",
        error: e instanceof NotAGoodreadsExportError ? `${e.message} It should be named something like goodreads_library_export.csv.` : "We couldn’t read that file.",
      });
    }
  }

  async function run(books: GoodreadsBook[]) {
    cancelled.current = false;
    const outcomes: RowOutcome[] = [];
    let stopped: string | null = null;
    setPhase({ kind: "importing", books, done: 0, outcomes });

    for (let start = 0; start < books.length; start += GOODREADS_BATCH_SIZE) {
      if (cancelled.current) {
        stopped = "You stopped the import. Everything above was shelved; run it again any time to pick up the rest.";
        break;
      }
      const batch = books.slice(start, start + GOODREADS_BATCH_SIZE);
      let result = await importGoodreadsBatch({ books: batch, includeReviews }).catch(() => null);
      if (!result || (!result.ok && result.error === "failed")) {
        result = await importGoodreadsBatch({ books: batch, includeReviews }).catch(() => null);
      }
      if (result && !result.ok && (result.error === "signed-out" || result.error === "unavailable")) {
        stopped =
          result.error === "signed-out"
            ? "You were signed out partway through. Sign in and run it again: books already shelved will be skipped."
            : "Adding books to the catalogue isn’t switched on here, so the import can’t run.";
        break;
      }
      outcomes.push(...(result?.ok ? result.rows.map((r) => r.outcome) : batch.map(() => "error" as const)));
      setPhase({ kind: "importing", books, done: outcomes.length, outcomes: [...outcomes] });
    }
    setPhase({ kind: "finished", books, outcomes, stopped });
  }

  if (phase.kind === "pick") return <Picker error={phase.error} onFile={readFile} />;

  if (phase.kind === "review") {
    const { books } = phase;
    const byStatus = statusOrder.map((s) => [s, books.filter((b) => b.status === s).length] as const).filter(([, n]) => n);
    const ratings = books.filter((b) => b.rating).length;
    const reviews = books.filter((b) => b.review).length;
    const shelves = [...new Set(books.flatMap((b) => b.shelves))];
    return (
      <section className="flex flex-col gap-8">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{phase.fileName}</p>
          <p className="mt-2 font-display text-4xl leading-tight">
            {books.length.toLocaleString()} {books.length === 1 ? "book" : "books"} ready to shelve
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {byStatus.map(([status, n]) => (
              <div key={status} className="rounded-xl bg-surface-raised p-4">
                <dt className="text-sm text-muted">{READING_STATUS_LABELS[status]}</dt>
                <dd className="mt-1 font-display text-3xl">{n.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-muted">
            {ratings.toLocaleString()} {ratings === 1 ? "rating" : "ratings"} and {reviews.toLocaleString()} {reviews === 1 ? "review" : "reviews"}
            {shelves.length ? (
              <>
                {", plus "}
                {shelves.length === 1 ? "your shelf" : `${shelves.length} shelves:`}{" "}
                <span className="text-text">{shelves.slice(0, 6).join(", ")}</span>
                {shelves.length > 6 ? "…" : ""}
              </>
            ) : null}
            .
          </p>
        </div>

        {ratings || reviews ? (
          <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-surface p-5">
            <input
              type="checkbox"
              checked={includeReviews}
              onChange={(e) => setIncludeReviews(e.target.checked)}
              className="mt-1 size-5 accent-[var(--bk-primary)]"
            />
            <span>
              <span className="block font-semibold">Bring my ratings and reviews</span>
              <span className="text-sm text-muted">
                They show on each book’s page like any other review here, unless your library is private. Books you’ve already reviewed on Booksyde keep
                your Booksyde review.
              </span>
            </span>
          </label>
        ) : null}

        <p className="text-sm text-muted">
          Books already on your Booksyde shelves stay where they are; we only fill in dates they’re missing. Books we don’t have yet are fetched from
          Open Library, so a big library takes a few minutes.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => run(books)}
            className="rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-text shadow-[0_10px_24px_-14px_rgba(31,27,22,0.7)] transition hover:opacity-90"
          >
            Shelve {books.length.toLocaleString()} {books.length === 1 ? "book" : "books"}
          </button>
          <button type="button" onClick={() => setPhase({ kind: "pick" })} className="rounded-full px-5 py-3 font-semibold text-muted hover:text-text">
            Choose a different file
          </button>
        </div>
      </section>
    );
  }

  if (phase.kind === "importing") {
    const { books, done } = phase;
    const pct = Math.round((done / books.length) * 100);
    const current = books[Math.min(done, books.length - 1)];
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8" aria-live="polite">
        <p className="font-display text-4xl leading-tight">Shelving your books…</p>
        <div
          className="mt-6 h-3 overflow-hidden rounded-full bg-border/60"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={books.length}
          aria-valuenow={done}
          aria-label="Import progress"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4 text-sm text-muted">
          <span className="min-w-0 truncate">
            Looking for <em className="text-text">{goodreadsSearchTitle(current.title)}</em>
          </span>
          <span className="shrink-0 tabular-nums">
            {done.toLocaleString()} / {books.length.toLocaleString()}
          </span>
        </div>
        <p className="mt-6 text-sm text-muted">Keep this tab open until it’s done.</p>
        <button
          type="button"
          onClick={() => (cancelled.current = true)}
          className="mt-4 rounded-full border border-border px-5 py-2 text-sm font-semibold text-muted hover:text-text"
        >
          Stop after this batch
        </button>
      </section>
    );
  }

  return <Summary {...phase} username={username} onAgain={() => setPhase({ kind: "pick" })} />;
}

function Picker({ error, onFile }: { error?: string; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="flex flex-col gap-8">
      <ol className="grid gap-4 sm:grid-cols-3">
        {[
          <>
            On Goodreads, open{" "}
            <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
              Import and export
            </a>{" "}
            (under My Books).
          </>,
          <>
            Press <strong>Export Library</strong>, wait a moment, then download the file it makes.
          </>,
          <>
            Drop that <span className="font-mono text-sm">.csv</span> file here.
          </>,
        ].map((step, i) => (
          <li key={i} className="rounded-2xl border border-border bg-surface p-5">
            <span className="font-display text-3xl text-accent">{i + 1}</span>
            <p className="mt-2 text-sm leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging ? "border-primary bg-highlight/10" : "border-border bg-surface-raised"
        }`}
      >
        <p className="font-display text-3xl">Drop your Goodreads export</p>
        <p className="mt-1 text-muted">goodreads_library_export.csv</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-primary-text transition hover:opacity-90"
        >
          Choose file
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Goodreads export file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Summary({
  books,
  outcomes,
  stopped,
  username,
  onAgain,
}: {
  books: GoodreadsBook[];
  outcomes: RowOutcome[];
  stopped: string | null;
  username: string;
  onAgain: () => void;
}) {
  const count = (...kinds: RowOutcome[]) => outcomes.filter((o) => kinds.includes(o)).length;
  const added = count("added");
  const already = count("updated", "unchanged");
  const missing = outcomes.flatMap((o, i) => (o === "not_found" || o === "error" ? [books[i]] : []));

  return (
    <section className="flex flex-col gap-8">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="font-display text-4xl leading-tight">
          {added ? `${added.toLocaleString()} ${added === 1 ? "book" : "books"} shelved` : stopped ? "Import stopped" : "All caught up"}
        </p>
        {stopped ? <p className="mt-3 text-accent">{stopped}</p> : null}
        <dl className="mt-6 grid grid-cols-3 gap-4">
          {[
            ["Newly shelved", added],
            ["Already here", already],
            ["Not found", missing.length],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl bg-surface-raised p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-display text-3xl">{n.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link href={`/u/${username}`} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-text transition hover:opacity-90">
            See your shelves
          </Link>
          <button type="button" onClick={onAgain} className="rounded-full px-5 py-3 font-semibold text-muted hover:text-text">
            Import another file
          </button>
        </div>
      </div>

      {missing.length ? (
        <div>
          <h2 className="font-display text-3xl">We couldn’t find these</h2>
          <p className="mt-1 text-muted">Search for them by hand, or add them to the catalogue from the search page.</p>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
            {missing.map((b, i) => {
              const title = goodreadsSearchTitle(b.title);
              return (
                <li key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{title}</span>
                    {b.author ? <span className="block truncate text-sm text-muted">{b.author}</span> : null}
                  </span>
                  <Link
                    href={`/search?q=${encodeURIComponent(b.author ? `${title} ${b.author}` : title)}`}
                    className="shrink-0 text-sm font-semibold text-accent hover:underline"
                  >
                    Search →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
