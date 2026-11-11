import { formatRating } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import { Stars } from "@/components/stars";

// Placeholder shelf until the catalog is wired up (matches supabase/seed.sql).
const trending = [
  { title: "Pride and Prejudice", author: "Jane Austen", color: "#C2416B", rating: 4.5 },
  { title: "Frankenstein", author: "Mary Shelley", color: "#2F6B5E", rating: 4 },
  { title: "Dracula", author: "Bram Stoker", color: "#7A1F2B", rating: 4 },
  { title: "Moby-Dick", author: "Herman Melville", color: "#2457A6", rating: 3.5 },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", color: "#C9A227", rating: 4 },
];

const genres = [
  ["fantasy", "Fantasy"],
  ["romance", "Romance"],
  ["thriller", "Thriller"],
  ["science-fiction", "Sci-fi"],
  ["horror", "Horror"],
  ["literary-fiction", "Literary"],
  ["young-adult", "Young adult"],
  ["non-fiction", "Non-fiction"],
  ["poetry", "Poetry"],
] as const;

const features = [
  { emoji: "🌈", title: "Shop by mood", body: "Cozy, dark, hopeful, tense — find books that match how you want to feel.", tint: "bg-grape/15" },
  { emoji: "⭐", title: "Half-stars, finally", body: "Because some books are a 3.5 and that's okay.", tint: "bg-sunshine/25" },
  { emoji: "👯", title: "Buddy reads", body: "Read with friends and chat without spoilers past your page.", tint: "bg-coral/15" },
  { emoji: "🎉", title: "Your year in books", body: "A shareable recap of everything you read, built for bragging.", tint: "bg-mint/20" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          booksyde<span className="text-coral">.</span>
        </span>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <a className="rounded-full px-4 py-2 hover:bg-surface" href="#discover">Discover</a>
          <a className="rounded-full bg-primary px-4 py-2 text-primary-text shadow-sm hover:opacity-90" href="#join">
            Join free
          </a>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pb-24 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-grape px-6 py-16 text-white sm:px-12 sm:py-24">
          <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-coral/70 blur-2xl" />
          <div aria-hidden className="absolute -bottom-24 right-40 size-72 rounded-full bg-sunshine/60 blur-3xl" />
          <div aria-hidden className="absolute bottom-6 left-1/2 size-40 rounded-full bg-sky/50 blur-2xl" />
          <div className="relative max-w-2xl">
            <p className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur">
              📚 Your reading life, but fun
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
              Find your next <span className="text-sunshine">obsession.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/85">
              Track what you read, discover books by mood and trope, and see what your friends can&rsquo;t put down.
            </p>
            <form className="mt-8 flex max-w-lg gap-2 rounded-full bg-white p-1.5 shadow-xl" action="#discover">
              <input
                name="q"
                placeholder="Search titles, authors, ISBNs…"
                className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-ink outline-none placeholder:text-zinc-400"
                style={{ color: "#1A1033" }}
              />
              <button className="rounded-full bg-coral px-5 py-3 font-semibold text-white hover:opacity-90">Search</button>
            </form>
          </div>
        </section>

        <section id="discover" className="flex flex-col gap-6">
          <h2 className="font-display text-3xl font-bold tracking-tight">Pick a vibe</h2>
          <div className="flex flex-wrap gap-3">
            {genres.map(([slug, label]) => {
              const c = genreColor(slug);
              return (
                <span
                  key={slug}
                  className="rounded-full px-5 py-2.5 font-semibold transition hover:-translate-y-0.5"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="font-display text-3xl font-bold tracking-tight">Trending this week</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {trending.map((book) => (
              <article key={book.title} className="group flex flex-col gap-3">
                <div
                  className="flex aspect-[2/3] items-end rounded-2xl p-4 shadow-md transition group-hover:-translate-y-1 group-hover:rotate-[-1deg] group-hover:shadow-xl"
                  style={{ background: `linear-gradient(160deg, ${book.color}, ${book.color}cc 60%, #1A1033)` }}
                >
                  <span className="font-display text-lg font-bold leading-tight text-white">{book.title}</span>
                </div>
                <div>
                  <p className="font-semibold leading-tight">{book.title}</p>
                  <p className="text-sm text-muted">{book.author}</p>
                  <p className="mt-1 text-sm">
                    <Stars rating={book.rating} /> <span className="text-muted">{formatRating(book.rating)}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="join" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className={`rounded-3xl border border-border p-6 ${f.tint}`}>
              <div className="text-3xl">{f.emoji}</div>
              <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
