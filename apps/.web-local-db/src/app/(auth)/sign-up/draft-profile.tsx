"use client";

import { genreColor } from "@booksyde/theme";
import { useSyncExternalStore } from "react";
import { Avatar } from "@/components/avatar";

/*
 * A tiny shared store so the sign-up form (main column) can fill in the
 * profile preview (side panel) as the reader types.
 */
type Draft = { displayName: string; username: string };
let draft: Draft = { displayName: "", username: "" };
const listeners = new Set<() => void>();
const empty: Draft = { displayName: "", username: "" };

export function setDraft(next: Partial<Draft>) {
  draft = { ...draft, ...next };
  listeners.forEach((l) => l());
}

function useDraft() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
    () => empty,
  );
}

/** Moods a first palette might hold, shown faint until the reader's own fill in. */
const samplePalette = [
  { slug: "cozy", weight: 3 },
  { slug: "hopeful", weight: 2 },
  { slug: "mysterious", weight: 2 },
  { slug: "emotional", weight: 1.5 },
  { slug: "tense", weight: 1 },
];

/** The reader's profile as it'll look on day one, filled in live from the form, with a hello from another reader. */
export function DraftProfile() {
  const { displayName, username } = useDraft();
  const total = samplePalette.reduce((sum, m) => sum + m.weight, 0);
  return (
    <div className="relative w-full max-w-sm pt-10">
      {/* Someone already saying hello. */}
      <div className="absolute top-0 right-[-6%] z-10 flex max-w-[70%] rotate-[3deg] items-end gap-2">
        <Avatar name="June" ink="var(--bk-oxblood)" className="size-8 rounded-full text-base ring-2 ring-green" />
        <p className="rounded-2xl rounded-bl-sm bg-gilt px-4 py-2.5 font-display text-lg italic leading-snug text-ink shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]">
          Welcome in! What are you reading first?
        </p>
      </div>

      <div className="-rotate-2 rounded-2xl bg-paper p-6 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-4">
          <Avatar name={displayName || "?"} className="size-16 rounded-full text-3xl ring-4 ring-gilt/40" />
          <div className="min-w-0">
            <p className={`truncate font-display text-3xl leading-none ${displayName ? "" : "opacity-40"}`}>
              {displayName || "Your name here"}
            </p>
            <p className={`mt-1.5 truncate text-sm ${username ? "opacity-70" : "opacity-40"}`}>@{username || "your_username"}</p>
          </div>
        </div>
        <p className="mt-3 text-[0.6rem] font-semibold uppercase tracking-[0.25em] opacity-60">A member since today</p>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-oxblood">Reading now</p>
          <div className="mt-3 flex items-center gap-4">
            <div
              aria-hidden
              className="grid aspect-[2/3] w-12 shrink-0 place-items-center rounded-[3px] border-2 border-dashed border-ink/25 font-display text-2xl text-ink/35"
            >
              +
            </div>
            <div>
              <p className="font-display text-xl italic leading-tight">Your first book goes here</p>
              <p className="mt-0.5 text-sm opacity-60">Pick it by mood, or ask a friend</p>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-oxblood">Reading palette</p>
            <p className="text-xs opacity-50">Fills in as you read</p>
          </div>
          <div aria-hidden className="mt-3 flex h-3 overflow-hidden rounded-full opacity-35">
            {samplePalette.map((m) => (
              <span key={m.slug} style={{ width: `${(m.weight / total) * 100}%`, background: genreColor(m.slug).dot }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
