import { describeNews, getNewsFeed, type NewsItem, newsBook, newsShelfTag, newsStory } from "@booksyde/shared";
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

/**
 * A story about a book, with two ways in: the card opens the book (its page,
 * or a search if we don't hold it yet), and only the story line at the bottom
 * opens the story itself where it lives elsewhere (the article, the list, the
 * prize's or film's page).
 */
function NewsCard({ item, now }: { item: NewsItem; now: Date }) {
  const { badge, title, line, coverTitle } = describeNews(item, now);
  const book = newsBook(item);
  const story = newsStory(item);
  const shelf = newsShelfTag(item);
  const bookHref = book ? ("workId" in book ? `/books/${book.workId}` : `/search?q=${encodeURIComponent(book.search)}`) : null;
  const tracking = (target: "book" | "story") =>
    track(AnalyticsEvent.NewsClicked, {
      kind: item.kind,
      target,
      for_you: item.for_you ? 1 : 0,
      on_shelf: item.shelf_status ? 1 : 0,
      location: "home",
    });
  // Sits above the book link that covers the card, so it takes its own clicks.
  const storyLink = "pointer-events-auto relative z-10 block rounded-md decoration-accent/50 underline-offset-4 hover:text-accent hover:underline";

  const heading = <h3 className="mt-1.5 line-clamp-2 font-display text-xl leading-tight">{title}</h3>;
  const storyLine = (
    <>
      <span className="block text-sm font-medium">{line}</span>
      {item.source ? (
        <span className="block text-xs text-muted">
          {item.source}
          {story ? <span aria-hidden> ↗</span> : null}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-raised hover:shadow-[0_14px_30px_-22px_rgba(31,27,22,0.6)]">
      {bookHref ? (
        <Link
          href={bookHref}
          aria-label={`${coverTitle === "a book" ? "The author's book" : coverTitle}${item.author_name ? ` by ${item.author_name}` : ""}`}
          className="absolute inset-0 rounded-2xl"
          {...tracking("book")}
        />
      ) : story ? (
        // No book to open (an older headline): the whole card opens the story, so it's never a dead card.
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={title}
          className="absolute inset-0 rounded-2xl"
          {...tracking("story")}
        />
      ) : null}
      <BookCover
        title={coverTitle}
        author={item.author_name ?? ""}
        src={item.cover_url}
        color={item.cover_color}
        sizes="80px"
        className="pointer-events-none w-16 shrink-0 sm:w-20"
      />
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col self-stretch">
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
        {heading}
        {item.author_name ? <p className="truncate text-sm text-muted">{item.author_name}</p> : null}
        <div className="mt-auto pt-2">
          {story ? (
            <a href={story.url} target="_blank" rel="noopener noreferrer" className={`${storyLink} self-start`} {...tracking("story")}>
              {storyLine}
            </a>
          ) : (
            storyLine
          )}
        </div>
      </div>
    </div>
  );
}
