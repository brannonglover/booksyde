import Link from "next/link";
import type { ReactNode } from "react";

/** "Page 212 of 480" over a thin rule that fills as you read; a gentle nudge when no page is logged. */
export function ReadingProgress({
  label,
  title,
  page,
  pages,
  more,
}: {
  label: ReactNode;
  title: ReactNode;
  page: number | null;
  pages: number | null;
  /** The reader's other books on Reading now, and where that shelf is. */
  more?: { count: number; href: string } | null;
}) {
  const percent = page != null && pages ? Math.min(100, Math.round((page / pages) * 100)) : null;
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <span className="shrink-0">{label}</span>
        {percent != null ? <span className="font-display text-lg italic text-accent">{percent}%</span> : null}
      </div>
      <p className="mt-1 flex">{title}</p>
      {percent != null ? (
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-border" role="presentation">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <p className="text-muted">
          {page != null ? (pages ? `Page ${page} of ${pages}` : `Page ${page}`) : "Pick up where you left off"}
        </p>
        {more && more.count > 0 ? (
          <Link href={more.href} className="shrink-0 font-semibold text-text underline-offset-4 hover:text-accent hover:underline">
            {more.count} more on Reading now &rarr;
          </Link>
        ) : null}
      </div>
    </>
  );
}
