"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

/**
 * The catalogue's query slip. Results follow as you type (debounced), and it
 * still works as a plain GET form without JavaScript.
 */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const tags = params.get("tags") ?? "";

  // Follow the URL when it changes from outside (a suggestion link, back button).
  const [value, setValue] = useState(urlQ);
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ);
    setValue(urlQ);
  }

  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(q: string) {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (tags) next.set("tags", tags);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <form
      action="/search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
      className="group relative"
    >
      <label htmlFor="catalogue-q" className="sr-only">
        Search the catalogue
      </label>
      {/* A brass label holder with a typed slip inside */}
      <div className="rounded-[14px] bg-gradient-to-b from-[#D9B46A] via-[#B8893A] to-[#8E6827] p-[3px] shadow-[0_18px_40px_-22px_rgba(31,27,22,0.7)]">
        <div className="flex items-center gap-3 rounded-[11px] bg-[#FFFDF6] py-2 pl-5 pr-2 text-ink shadow-[inset_0_2px_6px_rgba(31,27,22,0.18)] dark:bg-[#F3EADB]">
          <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0 text-[#8E6827]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id="catalogue-q"
            name="q"
            type="search"
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              if (timer.current) clearTimeout(timer.current);
              const q = e.target.value;
              timer.current = setTimeout(() => go(q), 320);
            }}
            placeholder="A title, an author, an ISBN, a feeling…"
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-lg tracking-tight text-ink outline-none placeholder:text-[#8A7F72] sm:text-xl [&::-webkit-search-cancel-button]:hidden"
          />
          {tags ? <input type="hidden" name="tags" value={tags} /> : null}
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                if (timer.current) clearTimeout(timer.current);
                go("");
              }}
              aria-label="Clear search"
              className="grid size-9 shrink-0 place-items-center rounded-full text-[#8A7F72] hover:bg-black/5 hover:text-ink"
            >
              ✕
            </button>
          ) : null}
          <button className="shrink-0 rounded-[8px] bg-green px-4 py-3 text-sm font-semibold text-paper hover:opacity-90 sm:px-5">
            Look it up
          </button>
        </div>
      </div>
      <p aria-live="polite" className={`absolute -bottom-7 left-1 text-sm italic text-muted transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>
        Leafing through the drawers…
      </p>
    </form>
  );
}
