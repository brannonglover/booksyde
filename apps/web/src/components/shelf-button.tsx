"use client";

import { getMyReadingStatus, READING_STATUS_LABELS, removeFromShelves, setReadingStatus } from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const statuses: ReadingStatus[] = ["want_to_read", "reading", "read", "did_not_finish"];

/** "Want to read" button with a menu for the other shelves. Personal, so it loads in the browser. */
export function ShelfButton({ workId }: { workId: string }) {
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getMyReadingStatus(createClient(), workId)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function choose(next: ReadingStatus | null) {
    setOpen(false);
    setBusy(true);
    setNote(null);
    try {
      const client = createClient();
      if (next) await setReadingStatus(client, workId, next);
      else await removeFromShelves(client, workId);
      setStatus(next);
    } catch (e) {
      setNote(e instanceof Error && /signed in/i.test(e.message) ? "Sign in to keep track of your books." : "Something went wrong. Try again?");
    } finally {
      setBusy(false);
    }
  }

  const shelved = status !== null;
  return (
    <div ref={menuRef} className="relative w-full">
      <div className="flex w-full overflow-hidden rounded-full shadow-[0_8px_20px_-12px_rgba(31,27,22,0.6)]">
        <button
          type="button"
          disabled={busy}
          onClick={() => (shelved ? setOpen((o) => !o) : choose("want_to_read"))}
          className={`flex flex-1 items-center justify-center gap-2 py-3 font-semibold transition disabled:opacity-60 ${
            shelved ? "bg-surface text-text ring-1 ring-inset ring-border" : "bg-primary text-primary-text hover:opacity-90"
          }`}
        >
          {shelved ? <span aria-hidden className="text-success">✓</span> : null}
          {shelved ? READING_STATUS_LABELS[status] : "Want to read"}
        </button>
        <button
          type="button"
          aria-label="Choose a shelf"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`grid w-12 place-items-center border-l transition ${
            shelved ? "border-border bg-surface text-text ring-1 ring-inset ring-border" : "border-primary-text/20 bg-primary text-primary-text hover:opacity-90"
          }`}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M5.2 7.6a.75.75 0 0 1 1.06-.04L10 11.1l3.74-3.54a.75.75 0 1 1 1.02 1.1l-4.25 4a.75.75 0 0 1-1.02 0l-4.25-4a.75.75 0 0 1-.04-1.06Z" />
          </svg>
        </button>
      </div>

      {open ? (
        <div role="menu" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-xl">
          {statuses.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={status === s}
              type="button"
              onClick={() => choose(s)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-surface"
            >
              {READING_STATUS_LABELS[s]}
              {status === s ? <span className="text-success">✓</span> : null}
            </button>
          ))}
          {shelved ? (
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(null)}
              className="w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-surface"
            >
              Remove from my shelves
            </button>
          ) : null}
        </div>
      ) : null}

      {note ? (
        <p role="status" className="mt-2 text-center text-sm text-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
