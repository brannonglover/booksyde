"use client";

import { type DeskBook, finishReading, setReadingPage } from "@booksyde/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BookCover } from "@/components/book-cover";
import { createClient } from "@/lib/supabase/client";

/** A light word for where you are in a book. */
function milestone(percent: number) {
  if (percent >= 100) return "The last page!";
  if (percent >= 90) return "Final chapters";
  if (percent >= 75) return "The home stretch";
  if (percent >= 50) return "Past the halfway mark";
  if (percent >= 25) return "Hitting your stride";
  if (percent >= 10) return "Settling in";
  return "Just cracked the spine";
}

/** The reader's Reading now books, each with an optional bookmark they can move. */
export function ReadingDesk({ books }: { books: (DeskBook & { updatedLabel: string | null })[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((b) => (
        <li key={b.work.id}>
          <DeskCard book={b} />
        </li>
      ))}
    </ul>
  );
}

function DeskCard({ book }: { book: DeskBook & { updatedLabel: string | null } }) {
  const { work, author, pages } = book;
  const [page, setPage] = useState(book.page);
  const [updated, setUpdated] = useState(book.updatedLabel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(book.page);
  const router = useRouter();

  // Fill the bar from empty on first paint, so it reads as a little flourish.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  const percent = page != null && pages ? Math.min(100, Math.round((page / pages) * 100)) : null;
  const tracking = page != null;

  const persist = (next: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await setReadingPage(createClient(), work.id, next);
        saved.current = next;
        setUpdated("Just now");
        // So the hero's bookmark keeps up.
        router.refresh();
      } catch {
        setPage(saved.current);
        setError("That didn’t save. Try again?");
      }
    });
  };

  // Quick taps add up locally and save once the reader stops tapping.
  const nudge = (by: number) => {
    const next = Math.max(0, Math.min(pages ?? Infinity, (page ?? 0) + by));
    setPage(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 600);
  };

  const openEditor = () => {
    setDraft(page?.toString() ?? "");
    setError(null);
    setEditing(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isInteger(n) || n < 0) {
      setError("Enter the page you’re on, like 142.");
      return;
    }
    if (pages && n > pages) {
      setError(`This edition has ${pages} pages.`);
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPage(n);
    setEditing(false);
    persist(n);
  };

  const finish = () => {
    setError(null);
    startTransition(async () => {
      try {
        await finishReading(createClient(), work.id);
        setFinished(true);
      } catch {
        setError("That didn’t save. Try again?");
      }
    });
  };

  if (finished) {
    return (
      <div className="flex h-full items-center gap-4 rounded-2xl border border-success/30 bg-success/10 p-4">
        <Cover book={book} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Finished</p>
          <p className="mt-1 font-display text-2xl leading-tight">
            You read <em>{work.title}</em>.
          </p>
          <Link href={`/books/${work.id}#review`} className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
            What did you think? &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4 transition hover:border-text/25">
      <div className="flex gap-4">
        <Cover book={book} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/books/${work.id}`} className="min-w-0 hover:text-accent">
              <p className="line-clamp-2 font-display text-xl italic leading-tight">{work.title}</p>
              {author ? <p className="mt-0.5 truncate text-sm text-muted">{author}</p> : null}
            </Link>
            {percent != null ? (
              <span className="shrink-0 font-display text-3xl leading-none tabular-nums text-accent">
                {percent}
                <span className="text-lg">%</span>
              </span>
            ) : null}
          </div>

          <div className="mt-auto pt-4">
            {tracking ? (
              <PageEdge percent={shown ? (percent ?? 0) : 0} known={percent != null} page={page} pages={pages} />
            ) : (
              <div aria-hidden className="h-2.5 rounded-full border border-dashed border-border" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-5 text-sm">
        {!tracking ? (
          <>
            <p className="font-semibold">Not tracking pages</p>
            <p className="text-muted">That&rsquo;s fine. Add your page whenever you like.</p>
          </>
        ) : percent === 100 ? (
          <>
            <p className="font-semibold text-accent">The last page!</p>
            <p className="text-muted">Ready to call it read?</p>
          </>
        ) : (
          <>
            <p className="font-semibold">{percent != null ? milestone(percent) : `On page ${page}`}</p>
            <p className="text-muted">
              {percent != null && pages && page != null
                ? `Page ${page} of ${pages} · ${pages - page} to go`
                : "We don’t know how long this edition is"}
            </p>
          </>
        )}
      </div>

      {editing ? (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            Page
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              max={pages ?? undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0"
              aria-label={`Page you're on in ${work.title}`}
              className="w-20 rounded-xl border border-border bg-surface-raised px-3 py-1.5 text-text outline-none focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
            />
            {pages ? <span>of {pages}</span> : null}
          </label>
          <button type="submit" className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-text hover:opacity-90">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-2 py-1.5 text-sm font-semibold text-muted hover:text-text">
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tracking && percent !== 100 ? (
            <>
              <Chip onClick={() => nudge(10)} label={`Add 10 pages to ${work.title}`}>
                +10
              </Chip>
              <Chip onClick={() => nudge(25)} label={`Add 25 pages to ${work.title}`}>
                +25
              </Chip>
              <Chip onClick={openEditor}>Set page</Chip>
            </>
          ) : null}
          {!tracking ? <Chip onClick={openEditor}>Track my page</Chip> : null}
          {percent === 100 ? (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-text hover:opacity-90 disabled:opacity-60"
            >
              Mark as read
            </button>
          ) : null}
          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {pending ? "Saving…" : tracking && updated ? updated : null}
          </span>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
    </div>
  );
}

function Cover({ book }: { book: DeskBook }) {
  return (
    <Link href={`/books/${book.work.id}`} className="w-16 shrink-0 self-start sm:w-[4.5rem]" tabIndex={-1} aria-hidden>
      <BookCover
        title={book.work.title}
        author={book.author ?? ""}
        src={book.work.cover_url}
        color={book.work.cover_color}
        sizes="72px"
        className="w-full -rotate-1"
      />
    </Link>
  );
}

/**
 * The bar drawn as a book's page edge seen from above: the pages you've read
 * are inked in, and a bookmark ribbon hangs where you stopped.
 */
function PageEdge({ percent, known, page, pages }: { percent: number; known: boolean; page: number | null; pages: number | null }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={pages ?? undefined}
      aria-valuenow={page ?? undefined}
      aria-valuetext={pages ? `Page ${page} of ${pages}` : `Page ${page}`}
      className="relative h-2.5"
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-text/10"
        style={{ background: "repeating-linear-gradient(90deg, #EFE6D2 0 2px, #D9CCB2 2px 3px)" }}
      >
        {known ? (
          <div
            className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
            style={{ width: `${percent}%` }}
          />
        ) : null}
      </div>
      {known ? (
        // The ribbon: tucked into the edge at your page, with a notched tail.
        <div
          aria-hidden
          className="absolute -top-1.5 h-6 w-2.5 -translate-x-1/2 bg-oxblood shadow-[1px_2px_3px_rgba(31,27,22,0.35)] motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out"
          style={{
            left: `clamp(5px, ${percent}%, calc(100% - 5px))`,
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
            backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(255,255,255,0.14) 45%, rgba(0,0,0,0.12))",
          }}
        />
      ) : null}
    </div>
  );
}

function Chip({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm font-semibold tabular-nums transition hover:border-text/40 active:scale-95"
    >
      {children}
    </button>
  );
}
