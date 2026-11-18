/** "Book 3 of Red Rising" on a result card, so a sequel never passes for a first book. */
export function SeriesLine({ label }: { label: string }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium text-accent">
      <span aria-hidden>❧</span>
      <span className="truncate">{label}</span>
    </p>
  );
}
