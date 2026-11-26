import { describeNews, getNewsFeed, type NewsItem, newsShelfTag, newsTarget } from "@booksyde/shared";
import Link from "next/link";
import { connection } from "next/server";
import { BookCover } from "@/components/book-cover";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** How many stories the home page shows. */
const SHOWN = 6;

/**
 * "This week in books": moves on the bestseller lists, prizes, screen
 * adaptations, and news and new books from the authors on the reader's
 * shelves (theirs first). Nothing at all until the
 * daily news job has written something.
 */
export async function NewsSection() {
  // The feed depends on who's signed in, so it's worked out per request.
  await connection();
  if (!hasSupabaseEnv) return null;
  const items = await createClient()
    .then((client) => getNewsFeed(client, SHOWN))
    .catch(() => [] as NewsItem[]);
  if (!items.length) return null;
  const now = new Date();
  const personal = items.some((i) => i.for_you);
  return (
    <section aria-labelledby="news" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">In the news</p>
          <h2 id="news" className="mt-2 font-display text-4xl leading-none sm:text-5xl">
            This week in <em className="text-accent">books</em>
          </h2>
        </div>
        <p className="hidden max-w-xs shrink-0 text-right text-sm text-muted sm:block">
          {personal
            ? "The bestseller lists, prizes and screen adaptations, and what’s new from the authors you read."
            : "What’s moving on the bestseller lists, which books are winning prizes, and which are coming to the screen."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} now={now} />
        ))}
      </div>
    </section>
  );
}

function NewsCard({ item, now }: { item: NewsItem; now: Date }) {
  const { badge, title, line, coverTitle } = describeNews(item, now);
  const target = newsTarget(item);
  const shelf = newsShelfTag(item);
  const body = (
    <>
      <BookCover
        title={coverTitle}
        author={item.author_name ?? ""}
        src={item.cover_url}
        color={item.cover_color}
        sizes="80px"
        className="w-16 shrink-0 sm:w-20"
      />
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <div className="flex flex-wrap items-center gap-2">
          {badge ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{badge}</span> : null}
          {shelf ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${shelf.onShelf ? "bg-accent text-paper" : "bg-accent/10 text-accent"}`}
            >
              {shelf.text}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 line-clamp-2 font-display text-xl leading-tight">{title}</h3>
        {item.author_name ? <p className="truncate text-sm text-muted">{item.author_name}</p> : null}
        <p className="mt-auto pt-2 text-sm font-medium">{line}</p>
        {item.source ? <p className="text-xs text-muted">{item.source}</p> : null}
      </div>
    </>
  );
  const className =
    "group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-raised hover:shadow-[0_14px_30px_-22px_rgba(31,27,22,0.6)]";
  const tracking = track(AnalyticsEvent.NewsClicked, { kind: item.kind, for_you: item.for_you ? 1 : 0, on_shelf: item.shelf_status ? 1 : 0, location: "home" });

  if ("url" in target) {
    return (
      <a href={target.url} target="_blank" rel="noopener noreferrer" className={className} {...tracking}>
        {body}
      </a>
    );
  }
  const href = "workId" in target ? `/books/${target.workId}` : `/search?q=${encodeURIComponent(target.search)}`;
  return (
    <Link href={href} className={className} {...tracking}>
      {body}
    </Link>
  );
}
