/**
 * The Booksyde wordmark: the "oo" is a pair of reading glasses.
 *
 * Frames are drawn in ink on the light theme and gilt on the dark theme, and the
 * closing period is always gilt. Sized in em, so set the size with font-size.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="Booksyde" className={`inline-block whitespace-nowrap font-display ${className}`}>
      <span aria-hidden>B</span>
      <ReadingGlasses className="mx-[0.03em] inline-block h-[0.52em] w-[1.09em] align-[-0.02em] text-text dark:text-highlight" />
      <span aria-hidden>
        ksyde<span className="text-highlight">.</span>
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
