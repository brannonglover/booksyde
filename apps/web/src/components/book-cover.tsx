import { coverUrl, mixHex, palette } from "@booksyde/theme";
import Image from "next/image";

type BookCoverProps = {
  title: string;
  author: string;
  /** Full cover image URL (e.g. works.cover_url). */
  src?: string | null;
  /** Or an Open Library cover id. */
  coverId?: number | null;
  /** Cloth colour for the typeset fallback cover (e.g. works.cover_color). */
  color?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** A book cover in a clean frame: real cover art when we have it, a simple typeset cover when we don't. */
export function BookCover({
  title,
  author,
  src,
  coverId,
  color,
  sizes = "(min-width: 1024px) 200px, 45vw",
  priority,
  className = "",
}: BookCoverProps) {
  const url = src ?? (coverId ? coverUrl(coverId) : null);
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[3px] bg-surface shadow-[0_1px_2px_rgba(31,27,22,0.12),0_12px_28px_-14px_rgba(31,27,22,0.45)] ring-1 ring-black/5 ${className}`}
    >
      {url ? (
        <Image src={url} alt={`Cover of ${title} by ${author}`} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-paper @container"
          // Deepen the cloth colour so cream lettering always reads.
          style={{ background: color ? mixHex(color, palette.ink, 0.35) : palette.green }}
          role="img"
          aria-label={`${title} by ${author}`}
        >
          <div aria-hidden className="absolute inset-2 border border-gilt/60" />
          <span className="font-display text-[clamp(1rem,14cqw,2.5rem)] leading-tight">{title}</span>
          <span aria-hidden className="text-gilt">✦</span>
          <span className="text-[clamp(0.6rem,6cqw,0.85rem)] font-semibold uppercase tracking-[0.18em] text-paper/80">
            {author}
          </span>
        </div>
      )}
    </div>
  );
}
