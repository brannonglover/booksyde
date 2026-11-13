import Link from "next/link";

/*
 * "What you get" section: three colourful tiles, each with a tiny illustration
 * of the feature. The mood stickers open the catalogue on that mood. (The year
 * in books has its own home-page section; see year-in-books.tsx.)
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
      <Tile className="bg-green text-paper lg:col-span-6">
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
      <Tile className="bg-[#F2E6CC] text-ink lg:col-span-3 dark:bg-[#4A3D27] dark:text-paper">
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
      <Tile className="bg-oxblood text-paper lg:col-span-3">
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
    </div>
  );
}
