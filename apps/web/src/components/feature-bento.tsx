import { getYearInBooks, type YearInBooks } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/*
 * "What you get" section: four colourful tiles, each with a tiny illustration
 * of the feature. The mood stickers open the catalogue on that mood, and the
 * year tile shows the reader's real year (or everyone's, when signed out).
 */

const moods = [
  { label: "☕ Cozy", tags: "cozy", rotate: "-rotate-3", tone: "bg-paper text-ink" },
  { label: "🌧️ Rainy day", tags: "mysterious", rotate: "rotate-2", tone: "bg-gilt text-ink" },
  { label: "🕯️ Dark academia", tags: "dark", rotate: "-rotate-1", tone: "bg-ink text-paper" },
  { label: "✨ Hopeful", tags: "hopeful", rotate: "rotate-3", tone: "bg-[#F4E0DF] text-ink" },
  { label: "🔪 Can’t sleep", tags: "tense", rotate: "-rotate-2", tone: "bg-oxblood text-paper" },
  { label: "💌 Swoony", tags: "romance", rotate: "rotate-1", tone: "bg-paper text-ink" },
];

function Tile({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(31,27,22,0.6)] sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

function TileText({ title, body, muted }: { title: string; body: string; muted: string }) {
  return (
    <div className="relative">
      <h3 className="font-display text-3xl leading-tight">{title}</h3>
      <p className={`mt-1.5 max-w-sm ${muted}`}>{body}</p>
    </div>
  );
}

export function FeatureBento() {
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      {/* Read by mood: a scatter of mood stickers */}
      <Tile className="bg-green text-paper lg:col-span-4">
        <TileText
          title="Read by mood"
          body="Tell us how tonight feels and we’ll find the book to match."
          muted="text-paper/75"
        />
        <div className="mt-auto flex flex-wrap gap-3 pt-8">
          {moods.map((m) => (
            <Link
              key={m.label}
              href={`/search?tags=${m.tags}`}
              className={`rounded-full px-4 py-2 font-semibold shadow-[0_4px_0_rgba(0,0,0,0.18)] transition duration-300 hover:rotate-0 hover:scale-110 focus-visible:rotate-0 focus-visible:scale-110 ${m.rotate} ${m.tone}`}
            >
              {m.label}
            </Link>
          ))}
        </div>
      </Tile>

      {/* Half-stars: one big, honest 3.5 */}
      <Tile className="bg-[#F2E6CC] text-ink lg:col-span-2 dark:bg-[#4A3D27] dark:text-paper">
        <div className="relative flex items-baseline gap-3">
          <span className="font-display text-8xl leading-none">3.5</span>
          <span className="text-2xl text-gilt dark:text-[#E0B872]" aria-label="3.5 out of 5 stars">
            ★★★<span className="relative inline-block">
              <span className="opacity-25">★</span>
              <span className="absolute inset-0 w-1/2 overflow-hidden">★</span>
            </span>
            <span className="opacity-25">★</span>
          </span>
        </div>
        <div className="mt-auto pt-8">
          <TileText
            title="Half-stars, finally"
            body="Because some books are a 3.5, and that’s all right."
            muted="text-ink/70 dark:text-paper/70"
          />
        </div>
      </Tile>

      {/* Buddy reads: a friendly race to the next chapter */}
      <Tile className="bg-oxblood text-paper lg:col-span-2">
        <div className="relative space-y-3">
          {[
            { name: "You", initial: "Y", page: 142, pct: 48, tone: "bg-gilt text-ink" },
            { name: "Sam", initial: "S", page: 156, pct: 53, tone: "bg-paper text-oxblood" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${r.tone}`}>
                {r.initial}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/20">
                <div className="h-full rounded-full bg-paper/85 transition-all duration-700 group-hover:w-[70%]" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="w-14 text-right text-sm tabular-nums text-paper/80">p. {r.page}</span>
            </div>
          ))}
          <p className="ml-11 inline-block rounded-2xl rounded-tl-sm bg-paper px-3 py-1.5 text-sm font-medium text-ink">
            No spoilers past p. 142! 🤐
          </p>
        </div>
        <div className="mt-auto pt-8">
          <TileText
            title="Buddy reads"
            body="Read alongside friends and chat freely. We hide anything past your page."
            muted="text-paper/75"
          />
        </div>
      </Tile>

      {/* Year in books: the year as a shelf of spines */}
      <Tile className="bg-surface ring-1 ring-border lg:col-span-4">
        <Suspense fallback={<YearSkeleton />}>
          <YearShelf />
        </Suspense>
      </Tile>
    </div>
  );
}

/* ------------------------------------------------------------ Year in books */

/** Reads the session cookie, so it renders per request behind Suspense. */
async function YearShelf() {
  await connection();
  if (!hasSupabaseEnv) return <YearView year={null} />;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const year = await getYearInBooks(supabase, { userId: data.user?.id }).catch(() => null);
  return <YearView year={year} />;
}

const numberFormat = new Intl.NumberFormat("en");

// Spines between 100 and 900 pages scale from short and slim to tall and thick.
function spineSize(pages: number | null) {
  const t = pages == null ? 0.4 : Math.min(Math.max((pages - 100) / 800, 0), 1);
  return { height: Math.round(54 + t * 44), width: Math.round(12 + t * 8) };
}

function YearView({ year }: { year: YearInBooks | null }) {
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
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <TileText title={mine ? "Your year in books" : "Booksyde’s year in books"} body={body} muted="text-muted" />
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Books</dt>
            <dd className="font-display text-4xl leading-none">{year ? numberFormat.format(year.books) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pages</dt>
            <dd className="font-display text-4xl leading-none">{year ? numberFormat.format(year.pages) : "—"}</dd>
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
                  i >= 32 ? "hidden lg:block" : i >= 20 ? "hidden sm:block" : ""
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
    </>
  );
}

function YearSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="h-20 w-72 animate-pulse rounded-lg bg-border/50" />
        <div className="h-12 w-40 animate-pulse rounded-lg bg-border/50" />
      </div>
      <div className="mt-8">
        <div className="h-28" />
        <div className="h-2.5 rounded-sm bg-[#8A6A4A] dark:bg-[#6E543B]" />
      </div>
    </>
  );
}
