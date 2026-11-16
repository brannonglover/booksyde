import { BookCover } from "@/components/book-cover";
import { BookObject } from "@/components/book-object";

/*
 * The book you set down mid-read, waiting for you: ribbon in, tea beside it,
 * and a note a friend tucked in at the page they can't wait for you to reach.
 */
export function ReadingNook() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="relative mx-auto aspect-[5/6] w-full">
        {/* A friend's note, slipped in so it sticks out past the fore-edge. */}
        <div className="absolute top-[10%] right-[-4%] w-[42%] rotate-[6deg] rounded-[3px] bg-paper px-4 pt-3 pb-4 text-ink shadow-[2px_6px_14px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-oxblood">p. 212</p>
          <p className="mt-1 font-display text-lg italic leading-snug">
            Tell me the second you get here. I need to talk about it!
          </p>
          <p className="mt-1.5 text-right font-display text-base italic text-ink/70">&mdash; Maya</p>
        </div>

        <BookObject
          ribbon
          className="absolute top-[4%] left-[6%] w-[54%] -rotate-[4deg]"
          cover={
            <BookCover
              title="Pride and Prejudice"
              author="Jane Austen"
              coverId={14348537}
              sizes="200px"
              priority
              className="w-full"
            />
          }
        />

        <TeaCup className="absolute right-[4%] bottom-[2%] w-[34%]" />
      </div>

      {/* Who else is in it with you. */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="flex -space-x-2" aria-hidden>
          {[
            { initial: "M", className: "bg-oxblood text-paper" },
            { initial: "J", className: "bg-gilt text-ink" },
            { initial: "R", className: "bg-paper text-green" },
          ].map((f) => (
            <span
              key={f.initial}
              className={`grid size-8 place-items-center rounded-full font-display text-base ring-2 ring-green ${f.className}`}
            >
              {f.initial}
            </span>
          ))}
        </div>
        <p className="text-sm text-paper/80">Maya and 2 friends are reading this too</p>
      </div>
    </div>
  );
}

/** A cup of tea on its saucer, still warm. */
function TeaCup({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 150" aria-hidden className={`drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] ${className}`}>
      <defs>
        <linearGradient id="cup-shade" x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* Steam */}
      <g fill="none" strokeLinecap="round" strokeWidth="3" className="stroke-paper/45">
        <path d="M52 44 C40 32 62 24 50 8" />
        <path d="M72 46 C62 30 84 26 74 4" />
      </g>

      {/* Saucer */}
      <ellipse cx="64" cy="138" rx="60" ry="9" className="fill-paper" />
      <ellipse cx="64" cy="136" rx="44" ry="5" fill="#000" fillOpacity="0.12" />

      {/* Handle */}
      <path d="M104 72 c22 -2 24 34 -4 36" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-paper" />

      {/* Cup */}
      <path d="M22 56 h84 v44 a32 32 0 0 1 -32 32 h-20 a32 32 0 0 1 -32 -32 z" className="fill-paper" />
      <path d="M22 56 h84 v44 a32 32 0 0 1 -32 32 h-20 a32 32 0 0 1 -32 -32 z" fill="url(#cup-shade)" />
      <rect x="22" y="70" width="84" height="4" className="fill-gilt" />

      {/* Rim and tea */}
      <ellipse cx="64" cy="56" rx="42" ry="8" className="fill-paper" />
      <ellipse cx="64" cy="57" rx="37" ry="5.5" fill="#7A4E2E" />
      <ellipse cx="58" cy="56" rx="14" ry="1.6" fill="#fff" fillOpacity="0.18" />
    </svg>
  );
}
