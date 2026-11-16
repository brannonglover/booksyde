import type { ReactNode } from "react";

/*
 * A cover drawn as a physical book lying on the page: a crease down the
 * spine, a sliver of page edges along the fore-edge and foot, and a soft
 * shadow underneath. With `ribbon`, a bookmark ribbon hangs out of the
 * bottom: the book you're partway through.
 */
export function BookObject({
  cover,
  ribbon = false,
  className = "",
}: {
  /** A BookCover sized to fill its parent (w-full). */
  cover: ReactNode;
  ribbon?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Shadow on the table, wider than the book and offset toward the page edges. */}
      <div aria-hidden className="absolute -bottom-4 left-[4%] right-[-6%] h-10 rounded-[50%] bg-ink/45 blur-xl" />

      {/* Page edges, peeking out past the cover along the fore-edge and the foot. */}
      <div
        aria-hidden
        className="absolute top-[5px] right-[-7px] bottom-[2px] w-[9px] rounded-r-[2px] shadow-[0_0_0_0.5px_rgba(31,27,22,0.28)]"
        style={{ background: "repeating-linear-gradient(90deg, #EFE6D2 0 1px, #D9CCB2 1px 2px)" }}
      />
      <div
        aria-hidden
        className="absolute right-[-5px] bottom-[-6px] left-[5px] h-[8px] rounded-b-[2px] shadow-[0_0_0_0.5px_rgba(31,27,22,0.28)]"
        style={{ background: "repeating-linear-gradient(180deg, #EFE6D2 0 1px, #D9CCB2 1px 2px)" }}
      />

      {ribbon ? (
        // Tucked under the cover, so it seems to come from between the pages.
        <div
          aria-hidden
          className="absolute top-[calc(100%-10px)] left-[66%] h-[22%] w-[7%] min-w-3 origin-top rotate-[5deg] bg-oxblood shadow-[1px_2px_3px_rgba(31,27,22,0.35)]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)",
            backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.12))",
          }}
        />
      ) : null}

      <div className="relative">
        {cover}
        {/* The hinge: a crease a little way in from the spine. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[9%] rounded-l-[3px]"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.14) 30%, rgba(0,0,0,0.22) 55%, rgba(255,255,255,0.06) 75%, transparent)",
          }}
        />
      </div>
    </div>
  );
}
