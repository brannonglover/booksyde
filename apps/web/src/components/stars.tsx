import { starParts } from "@booksyde/shared";

export function Stars({ rating }: { rating: number }) {
  const { full, half, empty } = starParts(rating);
  return (
    <span className="inline-flex text-sunshine" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(full)}
      {half ? <span className="relative">☆<span className="absolute inset-0 w-1/2 overflow-hidden">★</span></span> : null}
      <span className="text-border">{"★".repeat(empty)}</span>
    </span>
  );
}
