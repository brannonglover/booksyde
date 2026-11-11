import type { ReadingStatus } from "@booksyde/types";

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  read: "Read",
  did_not_finish: "Did not finish",
};

/** 4.25 → "4.25", 4 → "4.0" */
export function formatRating(avg: number | null | undefined): string {
  if (!avg) return "–";
  return Number.isInteger(avg) ? avg.toFixed(1) : String(Math.round(avg * 100) / 100);
}

/** Splits a rating into full/half/empty stars for rendering. */
export function starParts(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return { full, half, empty: 5 - full - half };
}

export function compactCount(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
