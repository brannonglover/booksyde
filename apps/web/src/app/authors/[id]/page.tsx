import { formatRating, lifeYears } from "@booksyde/shared";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { FollowAuthorButton } from "@/components/follow-author-button";
import { NewsCard } from "@/components/news";
import { ShelfBook } from "@/components/shelf-book";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getAuthorPage, getAuthorStories } from "@/lib/catalog";

/*
 * An author's page: who they are, a Follow button for hearing about their new
 * books and news, what's new from them, and the books of theirs we hold.
 * Cached for everyone; the follow state loads in the browser.
 */

type Params = Promise<{ id: string }>;
type Author = NonNullable<Awaited<ReturnType<typeof getAuthorPage>>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const author = await getAuthorPage(id);
  if (!author) return { title: "Author not found" };
  const description = author.bio?.split("\n")[0] ?? `Books by ${author.name} on Booksyde.`;
  return {
    title: author.name,
    description,
    alternates: { canonical: `/authors/${id}` },
    openGraph: {
      type: "profile",
      siteName: "Booksyde",
      url: `/authors/${id}`,
      title: author.name,
      description,
      images: author.photo_url ? [{ url: author.photo_url, alt: author.name }] : undefined,
    },
  };
}

export default function AuthorPage({ params }: { params: Params }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<AuthorSkeleton />}>
        <AuthorDetail params={params} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}

async function AuthorDetail({ params }: { params: Params }) {
  const { id } = await params;
  const author = await getAuthorPage(id);
  if (!author) notFound();
  const years = lifeYears(author.birth_date, author.death_date);
  const paragraphs = (author.bio ?? "").split(/\n{2,}/).filter(Boolean);
  const n = author.books.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
      <section className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
        <Portrait author={author} />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-4 sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Author</p>
            <h1 className="mt-3 text-balance font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">{author.name}</h1>
            <p className="mt-3 text-sm text-muted">
              {[years, `${n} ${n === 1 ? "book" : "books"} on Booksyde`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <FollowAuthorButton authorId={author.id} initialCount={author.followers_count} />
          <p className="max-w-md text-sm text-muted">Follow to hear about {author.name}&rsquo;s new books and news.</p>
          {paragraphs.length > 0 ? (
            <div className="mt-2 max-w-2xl space-y-4 text-left text-lg leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <Suspense fallback={null}>
        <AuthorNews id={author.id} />
      </Suspense>

      <section aria-labelledby="books" className="flex flex-col gap-6">
        <h2 id="books" className="border-b border-border pb-4 font-display text-4xl leading-none sm:text-5xl">
          Books by {author.name}
        </h2>
        {n === 0 ? (
          <p className="text-muted">None of their books are on Booksyde yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {author.books.map((b) => (
              <li key={b.id}>
                <ShelfBook workId={b.id} title={b.title} linkClassName="group block">
                  <span className="block transition duration-300 group-hover:-translate-y-1.5">
                    <BookCover
                      title={b.title}
                      author={author.name}
                      src={b.cover_url}
                      color={b.cover_color}
                      sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 45vw"
                    />
                  </span>
                  <span className="mt-3 block font-display text-lg leading-tight group-hover:text-accent">{b.title}</span>
                  <span className="block text-xs text-muted">
                    {[
                      b.first_published_year,
                      b.ratings_count > 0 ? `★ ${formatRating(Number(b.avg_rating))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </ShelfBook>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Portrait({ author }: { author: Author }) {
  const initials = author.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div
        aria-hidden
        className="relative grid size-40 place-items-center overflow-hidden rounded-full bg-green font-display text-6xl text-paper shadow-[0_18px_36px_-18px_rgba(31,27,22,0.6)] sm:size-48"
      >
        {initials}
        {/* The portrait sits over the initials, so a photo that fails to load still leaves them. */}
        {author.photo_url ? (
          <Image src={author.photo_url} alt="" fill sizes="192px" priority className="object-cover object-top" />
        ) : null}
      </div>
      {/* Commons photos must name their photographer and licence (see src/lib/author-portrait.ts). */}
      {author.photo_url && author.photo_credit && author.photo_credit_url ? (
        <a
          href={author.photo_credit_url}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-48 text-center text-[11px] leading-snug text-muted underline-offset-2 hover:text-accent hover:underline"
        >
          Photo: {author.photo_credit}
        </a>
      ) : null}
    </div>
  );
}

async function AuthorNews({ id }: { id: string }) {
  const items = await getAuthorStories(id);
  if (!items.length) return null;
  // "Coming Jan 14" turns to "Out Jan 14" on the day, so the date is today's, not the cache's.
  await connection();
  const now = new Date();
  return (
    <section aria-labelledby="author-news" className="flex flex-col gap-6">
      <h2 id="author-news" className="border-b border-border pb-4 font-display text-4xl leading-none sm:text-5xl">
        What&rsquo;s new
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} now={now} location="author" />
        ))}
      </div>
    </section>
  );
}

function AuthorSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-4 pt-12 sm:flex-row sm:items-start sm:px-6 sm:pt-16">
      <div className="size-40 shrink-0 animate-pulse rounded-full bg-border/60 sm:size-48" />
      <div className="flex w-full flex-col items-center gap-4 sm:items-start">
        <div className="h-3 w-24 animate-pulse rounded bg-border/60" />
        <div className="h-14 w-2/3 animate-pulse rounded bg-border/60" />
        <div className="h-10 w-40 animate-pulse rounded-full bg-border/60" />
      </div>
    </main>
  );
}
