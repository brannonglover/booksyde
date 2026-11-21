import { HollySprig } from "@/components/holly";
import { MapleLeaf } from "@/components/leaves";

/**
 * The Booksyde wordmark: the "oo" is a pair of reading glasses.
 *
 * Frames are drawn in ink on the light theme and gilt on the dark theme, and the
 * closing period is gilt. Through November a maple leaf rests on the bridge and
 * the period turns rust; through December it's a sprig of holly and a red berry. Sized in em, so set the size with font-size.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="Booksyde" className={`inline-block whitespace-nowrap font-display ${className}`}>
      <span aria-hidden>B</span>
      <span className="relative mx-[0.03em] inline-block align-[-0.02em]">
        <ReadingGlasses className="block h-[0.52em] w-[1.09em] text-text dark:text-highlight" />
        {/* December: a sprig of holly tucked over the bridge. */}
        {/* November: a maple leaf fallen onto the bridge. */}
        <MapleLeaf className="absolute top-[-0.44em] left-1/2 hidden -translate-x-1/2 rotate-[18deg] text-[0.6em] text-[#B4532A] thanksgiving:block dark:text-[#F09A62]" />
        <HollySprig className="absolute top-[-0.36em] left-1/2 hidden -translate-x-1/2 -rotate-[8deg] text-[0.46em] text-[#2F5D46] christmas:block dark:text-[#8DB88F]" />
      </span>
      <span aria-hidden>
        {/* The full stop is gilt; a holly berry through December. */}
        ksyde<span className="text-highlight thanksgiving:text-[#B4532A] christmas:text-[#A23B2C]">.</span>
      </span>
    </span>
  );
}

/** Two round lenses and an arched bridge, in the wordmark's stroke weight. */
export function ReadingGlasses({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="32 27 50 24" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <circle cx="44" cy="39" r="10.5" />
      <circle cx="70" cy="39" r="10.5" />
      <path d="M54.5 37q2.5-3.5 5 0" strokeWidth="2.5" />
    </svg>
  );
}
