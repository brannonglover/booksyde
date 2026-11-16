"use client";

import { addClubRead, type CatalogBook, removeClubRead, searchCatalog } from "@booksyde/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BookCover } from "@/components/book-cover";
import { createClient } from "@/lib/supabase/client";

function firstAuthor(book: CatalogBook) {
  return (
    [...book.work_contributors].filter((c) => c.role === "author").sort((a, b) => a.position - b.position)[0]?.authors
      ?.name ?? ""
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * For club owners and moderators: search the catalogue, pick a book and
 * (optionally) the dates the club will read it between.
 */
export function ReadPicker({ clubId, label }: { clubId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [chosen, setChosen] = useState<CatalogBook | null>(null);
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalog(createClient(), { q, limit: 8 })
        .then((books) => !cancelled && setResults(books))
        .catch(() => !cancelled && setResults([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const reset = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setChosen(null);
    setStartsOn(todayIso());
    setEndsOn("");
    setError(null);
  };

  const save = () => {
    if (!chosen) return;
    if (startsOn && endsOn && endsOn < startsOn) {
      setError("The finish date comes before the start.");
      return;
    }
    setError(null);
    startSaving(async () => {
      try {
        await addClubRead(createClient(), {
          clubId,
          workId: chosen.id,
          startsOn: startsOn || null,
          endsOn: endsOn || null,
        });
        reset();
        router.refresh();
      } catch {
        setError("We couldn’t add that book. Please try again.");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold hover:border-text/40"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-5">
      {chosen ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <BookCover
              title={chosen.title}
              author={firstAuthor(chosen)}
              src={chosen.cover_url}
              color={chosen.cover_color}
              sizes="56px"
              className="w-14 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-2xl leading-tight">{chosen.title}</p>
              <p className="text-sm text-muted">{firstAuthor(chosen)}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Start reading" value={startsOn} onChange={setStartsOn} />
            <DateField label="Finish by (optional)" value={endsOn} onChange={setEndsOn} min={startsOn || undefined} />
          </div>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-text hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add to the club"}
            </button>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-text"
            >
              Choose another
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="club-read-search" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Find a book
            </label>
            <button type="button" onClick={reset} className="text-sm font-semibold text-muted hover:text-text">
              Cancel
            </button>
          </div>
          <input
            id="club-read-search"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults(null);
            }}
            placeholder="Title, author or ISBN"
            className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-base text-text outline-none placeholder:text-muted/70 focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
          />
          {results === null ? null : results.length === 0 ? (
            <p className="text-sm text-muted">Nothing in the catalogue matches that yet.</p>
          ) : (
            <ul className="flex max-h-80 flex-col overflow-y-auto">
              {results.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => setChosen(book)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-raised"
                  >
                    <BookCover
                      title={book.title}
                      author={firstAuthor(book)}
                      src={book.cover_url}
                      color={book.cover_color}
                      sizes="40px"
                      className="w-10 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{book.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {[firstAuthor(book), book.first_published_year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-text outline-none focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
      />
    </label>
  );
}

/** Take a book off the club's list (owners and moderators). */
export function RemoveReadButton({ readId, title }: { readId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Take “${title}” off the club’s list?`)) return;
        startTransition(async () => {
          try {
            await removeClubRead(createClient(), readId);
            router.refresh();
          } catch {
            window.alert("We couldn’t remove that book. Please try again.");
          }
        });
      }}
      className="text-sm font-semibold text-muted hover:text-accent disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
