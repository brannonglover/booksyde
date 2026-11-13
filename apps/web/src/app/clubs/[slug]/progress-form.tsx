"use client";

import { finishReading, setReadingPage } from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "You're on page __": the member's place in the club's book. It decides which
 * spoiler-tagged posts they can read, so saving refreshes the discussion.
 */
export function ProgressForm({
  workId,
  page,
  status,
}: {
  workId: string;
  page: number | null;
  status: ReadingStatus | null;
}) {
  const finished = status === "read" && page === null;
  const [editing, setEditing] = useState(!finished);
  const [value, setValue] = useState(page?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Follow the server after a save: show the finished note, or the new page.
  const [syncedFrom, setSyncedFrom] = useState({ page, finished });
  if (syncedFrom.page !== page || syncedFrom.finished !== finished) {
    setSyncedFrom({ page, finished });
    setEditing(!finished);
    setValue(page?.toString() ?? "");
  }

  const run = (work: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch {
        setError("That didn’t save. Try again?");
      }
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || !Number.isInteger(n) || n < 0) {
      setError("Enter the page you’re on, like 142.");
      return;
    }
    run(() => setReadingPage(createClient(), workId, n));
  };

  if (finished && !editing) {
    return (
      <div id="progress" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-success/10 px-5 py-4">
        <p className="text-sm">
          <span className="font-semibold">You&rsquo;ve finished it.</span> Every post is open to you.
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm font-semibold text-muted hover:text-text"
        >
          Reading it again?
        </button>
      </div>
    );
  }

  return (
    <form
      id="progress"
      onSubmit={save}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center"
    >
      <label htmlFor="progress-page" className="text-sm">
        <span className="font-semibold">Where are you?</span>{" "}
        <span className="text-muted">We hide posts about pages you haven&rsquo;t reached.</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="text-sm text-muted">Page</span>
        <input
          id="progress-page"
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-24 rounded-xl border border-border bg-surface-raised px-3 py-2 text-text outline-none focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-text hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => finishReading(createClient(), workId))}
          className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-text disabled:opacity-60"
        >
          I&rsquo;ve finished
        </button>
      </div>
      {error ? <p className="text-sm text-accent sm:basis-full">{error}</p> : null}
    </form>
  );
}
