import { genreColors } from "@booksyde/theme";

/*
 * Placeholder "what you get" section: four colourful tiles, each with a tiny
 * illustration of the feature. Likely temporary until real product shots exist.
 */

const moods = [
  { label: "☕ Cozy", rotate: "-rotate-3", tone: "bg-paper text-ink" },
  { label: "🌧️ Rainy day", rotate: "rotate-2", tone: "bg-gilt text-ink" },
  { label: "🕯️ Dark academia", rotate: "-rotate-1", tone: "bg-ink text-paper" },
  { label: "✨ Hopeful", rotate: "rotate-3", tone: "bg-[#F4E0DF] text-ink" },
  { label: "🔪 Can’t sleep", rotate: "-rotate-2", tone: "bg-oxblood text-paper" },
  { label: "💌 Swoony", rotate: "rotate-1", tone: "bg-paper text-ink" },
];

// A year of reading as a shelf of spines (fixed so server and client render the same).
const spineColors = Object.values(genreColors).map((g) => g.dot);
const spines = Array.from({ length: 47 }, (_, i) => ({
  color: spineColors[(i * 7) % spineColors.length],
  height: 54 + ((i * 37) % 44),
  width: 12 + ((i * 5) % 9),
  band: i % 3 === 0,
}));

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
            <span
              key={m.label}
              className={`rounded-full px-4 py-2 font-semibold shadow-[0_4px_0_rgba(0,0,0,0.18)] transition duration-300 hover:rotate-0 hover:scale-110 ${m.rotate} ${m.tone}`}
            >
              {m.label}
            </span>
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

      {/* Year in books: your year as a shelf of spines */}
      <Tile className="bg-surface ring-1 ring-border lg:col-span-4">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <TileText
            title="Your year in books"
            body="Every book you finished, lined up on one shelf. A keepsake made for sharing."
            muted="text-muted"
          />
          <dl className="flex gap-6 text-right">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Books</dt>
              <dd className="font-display text-4xl leading-none">47</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pages</dt>
              <dd className="font-display text-4xl leading-none">12,840</dd>
            </div>
          </dl>
        </div>
        <div aria-hidden className="mt-8">
          <div className="flex h-28 items-end gap-[3px] px-2">
            {spines.map((s, i) => (
              <span
                key={i}
                className={`relative min-w-0 rounded-t-[2px] transition-transform duration-300 hover:-translate-y-3 ${
                  i >= 32 ? "hidden lg:block" : i >= 20 ? "hidden sm:block" : ""
                }`}
                // Grow in proportion to each spine's width so the row always fills the shelf.
                style={{ background: s.color, height: s.height, flex: `${s.width} 1 0` }}
              >
                {s.band ? <span className="absolute inset-x-0 top-3 h-1 bg-gilt/70" /> : null}
              </span>
            ))}
          </div>
          <div className="h-2.5 rounded-sm bg-[#8A6A4A] shadow-[0_6px_10px_-4px_rgba(31,27,22,0.5)] dark:bg-[#6E543B]" />
        </div>
      </Tile>
    </div>
  );
}
