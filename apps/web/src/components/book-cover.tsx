import { coverUrl } from "@booksyde/theme";
import Image from "next/image";

type BookCoverProps = {
  title: string;
  author: string;
  /** Open Library cover id; without one we draw a plain typographic cover. */
  coverId?: number | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** A book cover in a clean frame: real cover art when we have it, a simple typeset cover when we don't. */
export function BookCover({ title, author, coverId, sizes = "(min-width: 1024px) 200px, 45vw", priority, className = "" }: BookCoverProps) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[3px] bg-surface shadow-[0_1px_2px_rgba(31,27,22,0.12),0_12px_28px_-14px_rgba(31,27,22,0.45)] ring-1 ring-black/5 ${className}`}
    >
      {coverId ? (
        <Image
          src={coverUrl(coverId)}
          alt={`Cover of ${title} by ${author}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green p-4 text-center text-paper">
          <div aria-hidden className="absolute inset-2 border border-gilt/50" />
          <span className="font-display text-xl leading-tight">{title}</span>
          <span className="text-gilt">✦</span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-paper/75">{author}</span>
        </div>
      )}
    </div>
  );
}
