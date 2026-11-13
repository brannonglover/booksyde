import { getYearInBooks, type YearInBooks } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SectionHeading } from "@/components/site-chrome";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/*
 * Home-page section: the year as a shelf of spines. Shows the reader's own year
 * when signed in, and everyone's when signed out.
 */

export function YearInBooksSection({ numeral }: { numeral: string }) {
  return (
    <section id="year" className="flex flex-col gap-8">
      <Suspense fallback={<YearSkeleton numeral={numeral} />}>
        <YearShelf numeral={numeral} />
      </Suspense>
    </section>
  );
}

/** Reads the session cookie, so it renders per request behind Suspense. */
async function YearShelf({ numeral }: { numeral: string }) {
  await connection();
  if (!hasSupabaseEnv) return <YearView numeral={numeral} year={null} />;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const year = await getYearInBooks(supabase, { userId: data.user?.id }).catch(() => null);
  return <YearView numeral={numeral} year={year} />;
}

const numberFormat = new Intl.NumberFormat("en");

// Spines between 100 and 900 pages scale from short and slim to tall and thick.
function spineSize(pages: number | null) {
  const t = pages == null ? 0.4 : Math.min(Math.max((pages - 100) / 800, 0), 1);
  return { height: Math.round(54 + t * 44), width: Math.round(12 + t * 8) };
}

function YearView({ numeral, year }: { numeral: string; year: YearInBooks | null }) {
  const mine = year?.scope === "mine";
  const label = year?.year ?? new Date().getUTCFullYear();
  const empty = !year || year.books === 0;
  const body = mine
    ? empty
      ? `Nothing finished yet in ${label}. Mark a book as read and its spine lands here.`
      : `Every book you finished in ${label}, lined up on one shelf. A keepsake made for sharing.`
    : empty
      ? `Every book our readers finish in ${label} lines up here. Join and add yours.`
      : `Every book our readers finished in ${label}, lined up on one shelf. Join and add yours.`;

  return (
    <>
      <SectionHeading numeral={numeral}>{mine ? "Your year in books" : "Booksyde’s year in books"}</SectionHeading>
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-border sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md text-lg text-muted">{body}</p>
          <dl className="flex gap-8 text-right">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Books</dt>
              <dd className="font-display text-5xl leading-none">{year ? numberFormat.format(year.books) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pages</dt>
              <dd className="font-display text-5xl leading-none">{year ? numberFormat.format(year.pages) : "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-8">
          <div className="relative flex h-28 items-end gap-[3px] overflow-hidden px-2">
            {year?.spines.map((s, i) => {
              const { height, width } = spineSize(s.pages);
              return (
                <Link
                  key={`${s.workId}-${i}`}
                  href={`/books/${s.workId}`}
                  title={s.pages ? `${s.title} · ${numberFormat.format(s.pages)} pages` : s.title}
                  aria-label={s.title}
                  className={`relative min-w-0 rounded-t-[2px] transition-transform duration-300 hover:-translate-y-3 focus-visible:-translate-y-3 ${
                    i >= 30 ? "hidden lg:block" : i >= 18 ? "hidden sm:block" : ""
                  }`}
                  style={{ background: genreColor(s.genre ?? "default").dot, height, flex: `0 1 ${width}px` }}
                >
                  {i % 3 === 0 ? <span className="absolute inset-x-0 top-3 h-1 bg-gilt/70" /> : null}
                </Link>
              );
            })}
            {empty ? (
              <span className="mb-3 ml-2 font-display text-lg italic text-muted">
                {mine ? "Your shelf is waiting." : "The shelf is waiting."}
              </span>
            ) : null}
          </div>
          <div className="h-2.5 rounded-sm bg-[#8A6A4A] shadow-[0_6px_10px_-4px_rgba(31,27,22,0.5)] dark:bg-[#6E543B]" />
        </div>
      </div>
    </>
  );
}

function YearSkeleton({ numeral }: { numeral: string }) {
  return (
    <>
      <SectionHeading numeral={numeral}>Year in books</SectionHeading>
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-border sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="h-14 w-80 max-w-full animate-pulse rounded-lg bg-border/50" />
          <div className="h-12 w-44 animate-pulse rounded-lg bg-border/50" />
        </div>
        <div className="mt-8">
          <div className="h-28" />
          <div className="h-2.5 rounded-sm bg-[#8A6A4A] dark:bg-[#6E543B]" />
        </div>
      </div>
    </>
  );
}
