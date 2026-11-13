import { formatRating } from "@booksyde/shared";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";

export type ShelfBook = {
  id: string;
  title: string;
  cover_url: string | null;
  cover_color: string | null;
  avg_rating: number | string | null;
  ratings_count?: number | null;
};

const PER_PLANK = 6;

/** Covers standing on wooden planks, six to a plank, with titles and ratings beneath. */
export function Bookshelf({ books }: { books: ShelfBook[] }) {
  const planks: ShelfBook[][] = [];
  for (let i = 0; i < books.length; i += PER_PLANK) planks.push(books.slice(i, i + PER_PLANK));

  return (
    <div className="flex flex-col gap-10">
      {planks.map((plank, p) => (
        <div key={p}>
          <div className="grid grid-cols-3 items-end gap-4 px-3 sm:grid-cols-6 sm:gap-6">
            {plank.map((w, i) => (
              <Link
                key={w.id}
                href={`/books/${w.id}`}
                className={`block transition duration-300 hover:-translate-y-2 ${i % 3 === 1 ? "sm:-rotate-2" : i % 3 === 2 ? "sm:rotate-1" : ""}`}
                title={w.title}
              >
                <BookCover
                  title={w.title}
                  author=""
                  src={w.cover_url}
                  color={w.cover_color}
                  sizes="(min-width: 640px) 160px, 30vw"
                />
              </Link>
            ))}
          </div>
          <div
            aria-hidden
            className="h-3 rounded-sm bg-[#8A6A4A] shadow-[0_8px_14px_-6px_rgba(31,27,22,0.6)] dark:bg-[#6E543B]"
          />
          <div className="mt-4 grid grid-cols-3 gap-4 px-3 sm:grid-cols-6 sm:gap-6">
            {plank.map((w) => (
              <Link key={w.id} href={`/books/${w.id}`} className="text-center hover:text-accent">
                <span className="block font-display text-lg leading-tight">{w.title}</span>
                {w.ratings_count === 0 ? null : (
                  <span className="text-xs text-muted">★ {formatRating(Number(w.avg_rating))}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
