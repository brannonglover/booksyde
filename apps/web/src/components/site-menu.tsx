"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnalyticsEvent, track } from "@/lib/analytics";

const PLACES = [
  {
    href: "/discover",
    title: "Discover",
    blurb: "Popular books and a shelf for every mood",
    event: AnalyticsEvent.DiscoverClicked,
  },
  {
    href: "/clubs",
    title: "Clubs",
    blurb: "Pick a book together and read side by side",
    event: AnalyticsEvent.ClubsClicked,
  },
] as const;

/**
 * On phones the header has no room for Discover and Clubs, so they live behind
 * this button instead. Hidden from 640px up, where the header shows them.
 */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        title="Menu"
        className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-text aria-expanded:bg-surface aria-expanded:text-text"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl"
        >
          {PLACES.map((p) => {
            const here = pathname === p.href || pathname.startsWith(`${p.href}/`);
            return (
              <Link
                key={p.href}
                role="menuitem"
                href={p.href}
                aria-current={here ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-surface aria-[current=page]:bg-surface"
                {...track(p.event, { location: "header_menu" })}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-xs font-normal text-muted">{p.blurb}</span>
                </span>
                <span aria-hidden className="text-muted">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
