"use client";

import { useSyncExternalStore } from "react";

/*
 * A tiny shared store so the sign-up form (main column) can fill in the
 * library card preview (side panel) as the reader types.
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

/** The reader's new library card, filled in live from the form. */
export function DraftLibraryCard() {
  const { displayName, username } = useDraft();
  return (
    <div className="w-full max-w-sm rotate-[-2deg] rounded-md border border-[#D8C7A3] bg-[#F6EBD3] p-7 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-baseline justify-between border-b-2 border-oxblood/40 pb-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em]">Booksyde Lending Library</p>
        <p className="font-mono text-[0.65rem] opacity-70">Member card</p>
      </div>
      <dl className="mt-5 space-y-3 font-mono text-sm">
        {[
          ["Name", displayName || "Your name here"],
          ["Card no.", username ? `@${username}` : "@your_username"],
          ["Member since", "Today"],
          ["Borrowing limit", "Unlimited"],
        ].map(([label, value], i) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="shrink-0 text-[0.65rem] uppercase tracking-widest opacity-70">{label}</dt>
            <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-current opacity-40" />
            <dd className={`truncate text-right ${i < 2 && !(i === 0 ? displayName : username) ? "opacity-40" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex items-end justify-between">
        <p className="font-display text-xl italic opacity-80">{displayName ? displayName.split(" ")[0] : "Signature"}</p>
        <div className="rotate-[-10deg] rounded-md border-[3px] border-oxblood/70 px-2.5 py-1 text-center font-mono text-[0.6rem] font-bold uppercase leading-tight tracking-widest text-oxblood/85">
          Approved
          <br />
          Free forever
        </div>
      </div>
    </div>
  );
}
