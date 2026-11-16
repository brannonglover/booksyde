"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * A row of books that scrolls sideways, with a chevron at each end for readers
 * who have no trackpad or touch screen to scroll it. A chevron fades out once
 * the row has reached that end, and neither shows when everything already fits.
 * The chevrons are positioned absolutely so the shelf keeps its full width: they
 * hang just outside the shelf on wide screens, where the page has margin to
 * spare, and float over its edges on narrower ones. `below` sits under the row
 * (the plank).
 */
export function ShelfScroller({ label, className, children, below }: { label: string; className?: string; children: ReactNode; below?: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflows: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    // A pixel of slack absorbs sub-pixel rounding at high zoom levels.
    const max = row.scrollWidth - row.clientWidth;
    setEdges({ overflows: max > 1, atStart: row.scrollLeft <= 1, atEnd: row.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const child of Array.from(row.children)) observer.observe(child);
    return () => {
      row.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const scrollBy = (direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div>
      <div className="relative">
        <div ref={rowRef} className={className}>
          {children}
        </div>
        {edges.overflows ? (
          <>
            <Chevron direction="left" label={`Scroll ${label} left`} disabled={edges.atStart} onClick={() => scrollBy(-1)} />
            <Chevron direction="right" label={`Scroll ${label} right`} disabled={edges.atEnd} onClick={() => scrollBy(1)} />
          </>
        ) : null}
      </div>
      {below}
    </div>
  );
}

function Chevron({ direction, label, disabled, onClick }: { direction: "left" | "right"; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 text-text shadow-md backdrop-blur-sm transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30 disabled:shadow-none ${
        direction === "left" ? "left-1 min-[1280px]:-left-14" : "right-1 min-[1280px]:-right-14"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
