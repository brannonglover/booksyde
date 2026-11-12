"use client";

import { useSyncExternalStore } from "react";

/*
 * A tiny shared store so the sign-up form (main column) can fill in the
 * bookplate preview (side panel) as the reader types.
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

/** The reader's Ex Libris bookplate, filled in live from the form, as their profile will show it. */
export function DraftBookplate() {
  const { displayName, username } = useDraft();
  const ink = "#2D4A3E";
  return (
    <div className="w-full max-w-sm rotate-[-2deg] rounded-sm bg-[#FBF5E8] p-2 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
      <div className="relative rounded-sm border-[3px] border-double px-6 pb-7 pt-6 text-center" style={{ borderColor: ink }}>
        {["left-2 top-1", "right-2 top-1 scale-x-[-1]", "bottom-1 left-2 scale-y-[-1]", "bottom-1 right-2 scale-[-1]"].map((pos) => (
          <span key={pos} aria-hidden className={`absolute text-lg ${pos}`} style={{ color: ink }}>
            ❧
          </span>
        ))}
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.5em]" style={{ color: ink }}>
          Ex Libris
        </p>
        <div
          aria-hidden
          className="mx-auto mt-4 grid size-16 place-items-center rounded-full border-4 border-double font-display text-3xl text-paper"
          style={{ background: ink, borderColor: "var(--bk-gilt)" }}
        >
          {(displayName.trim() || "?").charAt(0).toUpperCase()}
        </div>
        <p className={`mt-3 truncate font-display text-4xl leading-none ${displayName ? "" : "opacity-40"}`}>
          {displayName || "Your name here"}
        </p>
        <p className={`mt-2 truncate text-sm ${username ? "opacity-70" : "opacity-40"}`}>@{username || "your_username"}</p>
        <p className="mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.25em] opacity-60">A member since today</p>
        <p className="mt-4 border-y border-current/15 py-2.5 font-display text-lg italic opacity-80">Your shelf starts here</p>
      </div>
    </div>
  );
}
