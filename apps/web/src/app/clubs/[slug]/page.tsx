import {
  type ClubMember,
  type ClubPost,
  type ClubRead,
  formatRating,
  getClubBySlug,
  getClubPosts,
  getMembersProgress,
  type ReaderProgress,
} from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DEFAULT_INK } from "@/lib/inks";
import { createClient } from "@/lib/supabase/server";
import { DeletePostButton, PostComposer } from "./discussion-client";
import { MembershipButton } from "./membership-button";
import { ProgressForm } from "./progress-form";
import { ReadPicker, RemoveReadButton } from "./read-picker";

/*
 * A club: its name and colour, the book it's reading now, its discussion
 * (with spoilers past your page hidden), who's in it and where each of them is
 * with the book. Personal to the viewer (membership, private clubs, your
 * page), so it renders per request.
 */

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ before?: string }>;

const POSTS_PER_PAGE = 50;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const supabase = await createClient();
  const club = await getClubBySlug(supabase, decodeURIComponent(slug)).catch(() => null);
  return club ? { title: club.name, description: club.description ?? undefined } : { title: "Club" };
}

export default function ClubPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<ClubSkeleton />}>
        <ClubView params={params} searchParams={searchParams} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const postDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function dateRange(read: ClubRead) {
  const fmt = (d: string) => dateFormat.format(new Date(d));
  if (read.startsOn && read.endsOn) return `${fmt(read.startsOn)} – ${fmt(read.endsOn)}`;
  if (read.startsOn) return `From ${fmt(read.startsOn)}`;
  if (read.endsOn) return `Finish by ${fmt(read.endsOn)}`;
  return null;
}

async function ClubView({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  // Which book is "now" depends on today's date (and the viewer), so render per request.
  await connection();
  const [{ slug }, { before }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: auth }, club] = await Promise.all([
    supabase.auth.getUser(),
    getClubBySlug(supabase, decodeURIComponent(slug)),
  ]);
  if (!club) notFound();

  const viewerId = auth.user?.id ?? null;
  const role = club.members.find((m) => m.userId === viewerId)?.role ?? null;
  const isAdmin = role === "owner" || role === "moderator";
  const owner = club.members.find((m) => m.role === "owner");
  const ink = club.cover_color ?? DEFAULT_INK;
  const { current, upcoming, past } = club.reads;
  const isMember = role !== null;
  const [progress, posts] = await Promise.all([
    current
      ? getMembersProgress(
          supabase,
          current.work.id,
          club.members.map((m) => m.userId),
        ).catch(() => new Map<string, ReaderProgress>())
      : new Map<string, ReaderProgress>(),
    // Only members can read the discussion (RLS agrees).
    isMember ? getClubPosts(supabase, club.id, { limit: POSTS_PER_PAGE, before }).catch(() => []) : [],
  ]);
  const mine = viewerId ? progress.get(viewerId) : undefined;
  const titles = new Map([current, upcoming, ...past].flatMap((r) => (r ? [[r.id, r.work.title] as const] : [])));
  // Number only the sections that render.
  const numerals = ["I", "II", "III", "IV", "V"];
  let n = 0;
  const next = () => numerals[n++];

  return (
    <main className="flex flex-1 flex-col">
      <section
        className="border-b border-border px-4 pb-14 pt-12 sm:px-6 sm:pt-16"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklab, ${ink} 14%, var(--bk-background)), var(--bk-background))`,
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center sm:items-start sm:text-left">
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            // The club's own colour, lifted toward the text colour so it reads in dark mode too.
            style={{ color: `color-mix(in oklab, ${ink} 70%, var(--bk-text))` }}
          >
            {club.is_private ? "🔒 Private club" : "Book club"}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight sm:text-7xl">{club.name}</h1>
          <Ornament className="mt-5" />
          {club.description ? (
            <p className="mt-5 max-w-2xl whitespace-pre-line text-lg text-muted">{club.description}</p>
          ) : null}
          <p className="mt-4 text-sm text-muted">
            {club.members.length} {club.members.length === 1 ? "reader" : "readers"}
            {owner ? (
              <>
                {" · "}started by{" "}
                <Link href={`/u/${owner.username}`} className="font-semibold text-text hover:text-accent">
                  @{owner.username}
                </Link>
              </>
            ) : null}
            {" · "}since {monthYear.format(new Date(club.created_at))}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <MembershipButton clubId={club.id} role={role} signedIn={viewerId !== null} />
            {role === "owner" ? <span className="text-sm italic text-muted">You started this club.</span> : null}
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 py-14">
          <section className="flex flex-col gap-8">
            <SectionHeading numeral={next()}>Reading now</SectionHeading>
            {current ? (
              <>
                <CurrentRead read={current} members={club.members} progress={progress} isAdmin={isAdmin} />
                {isMember ? (
                  <ProgressForm workId={current.work.id} page={mine?.page ?? null} status={mine?.status ?? null} />
                ) : null}
                {isAdmin ? (
                  <div>
                    <ReadPicker clubId={club.id} label="Pick another book" />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-muted">
                  {upcoming
                    ? "Nothing on the go right now. The next book is lined up below."
                    : isAdmin
                      ? "Your club hasn’t picked a book yet. Choose the first one."
                      : "This club hasn’t picked a book yet."}
                </p>
                {isAdmin ? <ReadPicker clubId={club.id} label="Choose a book" /> : null}
              </div>
            )}
          </section>

          <section id="talk" className="flex scroll-mt-8 flex-col gap-6">
            <SectionHeading numeral={next()}>The talk</SectionHeading>
            {isMember ? (
              <>
                {before ? null : (
                  <PostComposer
                    clubId={club.id}
                    read={current ? { id: current.id, title: current.work.title } : null}
                    myPage={mine?.page ?? null}
                    finished={mine?.status === "read" && mine.page === null}
                  />
                )}
                <PostList
                  posts={posts}
                  titles={titles}
                  viewerId={viewerId}
                  isAdmin={isAdmin}
                  myPage={mine?.page ?? null}
                />
                <div className="flex justify-between gap-4 text-sm font-semibold">
                  {before ? (
                    <Link href={`/clubs/${club.slug}#talk`} className="text-accent hover:underline">
                      ← Latest posts
                    </Link>
                  ) : (
                    <span />
                  )}
                  {posts.length === POSTS_PER_PAGE ? (
                    <Link
                      href={`/clubs/${club.slug}?before=${encodeURIComponent(posts[posts.length - 1].createdAt)}#talk`}
                      className="text-accent hover:underline"
                    >
                      Older posts →
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-muted">
                {viewerId
                  ? "Join the club to read the discussion and add your own thoughts."
                  : "Sign in and join the club to read the discussion."}
              </p>
            )}
          </section>

          {upcoming ? (
            <section className="flex flex-col gap-6">
              <SectionHeading numeral={next()}>Up next</SectionHeading>
              <ReadRow read={upcoming} isAdmin={isAdmin} />
            </section>
          ) : null}

          <section className="flex flex-col gap-6">
            <SectionHeading numeral={next()}>The readers</SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-2">
              {club.members.map((m) => (
                <li key={m.userId}>
                  <MemberRow member={m} progress={current ? (progress.get(m.userId) ?? null) : undefined} />
                </li>
              ))}
            </ul>
          </section>

          {past.length ? (
            <section className="flex flex-col gap-6">
              <SectionHeading numeral={next()}>Read together</SectionHeading>
              <ul className="flex flex-col gap-3">
                {past.map((read) => (
                  <li key={read.id}>
                    <ReadRow read={read} isAdmin={isAdmin} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

const statusLabels: Record<ReadingStatus, string> = {
  reading: "Reading",
  read: "Finished",
  want_to_read: "On their list",
  did_not_finish: "Set it aside",
};

function CurrentRead({
  read,
  members,
  progress,
  isAdmin,
}: {
  read: ClubRead;
  members: ClubMember[];
  progress: Map<string, ReaderProgress>;
  isAdmin: boolean;
}) {
  const reading = members.filter((m) => progress.get(m.userId)?.status === "reading").length;
  const finished = members.filter((m) => progress.get(m.userId)?.status === "read").length;
  const range = dateRange(read);
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <Link
        href={`/books/${read.work.id}`}
        className="block w-40 shrink-0 self-center transition hover:-translate-y-1 sm:self-start"
      >
        <BookCover
          title={read.work.title}
          author={read.work.author}
          src={read.work.cover_url}
          color={read.work.cover_color}
          sizes="160px"
          priority
        />
      </Link>
      <div className="flex min-w-0 flex-col gap-3 text-center sm:text-left">
        <Link href={`/books/${read.work.id}`} className="font-display text-4xl leading-none hover:text-accent">
          {read.work.title}
        </Link>
        {read.work.author ? <p className="text-lg text-muted">{read.work.author}</p> : null}
        {read.work.avg_rating > 0 ? (
          <p className="text-sm text-muted">★ {formatRating(read.work.avg_rating)} on Booksyde</p>
        ) : null}
        {range ? <p className="text-sm font-semibold">{range}</p> : null}
        <p className="text-sm text-muted">
          {reading} reading · {finished} finished · {members.length} in the club
        </p>
        {isAdmin ? (
          <div>
            <RemoveReadButton readId={read.id} title={read.work.title} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReadRow({ read, isAdmin }: { read: ClubRead; isAdmin: boolean }) {
  const range = dateRange(read);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <Link href={`/books/${read.work.id}`} className="w-12 shrink-0">
        <BookCover
          title={read.work.title}
          author={read.work.author}
          src={read.work.cover_url}
          color={read.work.cover_color}
          sizes="48px"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/books/${read.work.id}`}
          className="block truncate font-display text-2xl leading-tight hover:text-accent"
        >
          {read.work.title}
        </Link>
        <p className="truncate text-sm text-muted">{[read.work.author, range].filter(Boolean).join(" · ")}</p>
      </div>
      {isAdmin ? <RemoveReadButton readId={read.id} title={read.work.title} /> : null}
    </div>
  );
}

/** Where a member is with the current book, as a short badge. */
function progressLabel(p: ReaderProgress | null) {
  if (!p?.status && p?.page == null) return "Not started";
  // A page from an open session wins: they're partway through (perhaps a reread).
  if (p.page != null && p.status !== "did_not_finish") return `Page ${p.page}`;
  return p.status ? statusLabels[p.status] : "Not started";
}

/** `progress` is undefined when the club has no current book, null when we can't see theirs. */
function MemberRow({ member, progress }: { member: ClubMember; progress: ReaderProgress | null | undefined }) {
  const status = progress?.status ?? null;
  const name = member.display_name || member.username;
  const ink = member.theme_color ?? DEFAULT_INK;
  return (
    <Link
      href={`/u/${member.username}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-text/30"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full font-display text-xl text-paper"
        style={{ background: ink }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className="block truncate text-sm text-muted">
          @{member.username}
          {member.role !== "member" ? ` · ${member.role}` : ""}
        </span>
      </span>
      {progress !== undefined ? (
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            status === "read" && progress?.page == null
              ? "bg-success/15 text-success"
              : status === "reading" || progress?.page != null
                ? "bg-highlight/20 text-text"
                : "bg-border/50 text-muted"
          }`}
        >
          {progressLabel(progress)}
        </span>
      ) : null}
    </Link>
  );
}

function PostList({
  posts,
  titles,
  viewerId,
  isAdmin,
  myPage,
}: {
  posts: ClubPost[];
  titles: Map<string, string>;
  viewerId: string | null;
  isAdmin: boolean;
  myPage: number | null;
}) {
  if (!posts.length) {
    return <p className="py-4 text-center text-muted">No posts yet. Start the conversation.</p>;
  }
  return (
    <ol className="flex flex-col divide-y divide-border">
      {posts.map((post) => {
        const name = post.displayName || post.username;
        const title = post.clubReadId ? titles.get(post.clubReadId) : undefined;
        const about = [title, post.spoilerPage ? `up to p. ${post.spoilerPage}` : null].filter(Boolean).join(" · ");
        return (
          <li key={post.id} className="flex gap-3 py-5">
            <Link
              href={`/u/${post.username}`}
              aria-hidden
              tabIndex={-1}
              className="grid size-9 shrink-0 place-items-center rounded-full font-display text-lg text-paper"
              style={{ background: post.themeColor ?? DEFAULT_INK }}
            >
              {name.charAt(0).toUpperCase()}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Link href={`/u/${post.username}`} className="font-semibold hover:text-accent">
                  {name}
                </Link>
                <span className="text-muted">{postDate.format(new Date(post.createdAt))}</span>
                {about ? <span className="text-xs text-muted">· {about}</span> : null}
                {post.userId === viewerId || isAdmin ? (
                  <span className="ml-auto">
                    <DeletePostButton postId={post.id} />
                  </span>
                ) : null}
              </div>
              {post.isHidden ? (
                <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
                  🔒{" "}
                  {post.workId ? (
                    <>
                      Spoilers up to page {post.spoilerPage}. {myPage ? `You’re on page ${myPage}. ` : ""}
                      <a href="#progress" className="font-semibold text-accent hover:underline">
                        Update your page
                      </a>{" "}
                      to read it.
                    </>
                  ) : (
                    "Spoilers about a book the club has since taken off its list."
                  )}
                </p>
              ) : (
                <p className="mt-1 whitespace-pre-line break-words">{post.body}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ClubSkeleton() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-border px-4 pb-14 pt-16 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div className="h-4 w-28 animate-pulse rounded bg-border/50" />
          <div className="h-16 w-2/3 animate-pulse rounded bg-border/50" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-border/40" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-4xl gap-6 px-4 py-14 sm:px-6">
        <div className="aspect-[2/3] w-40 animate-pulse rounded bg-border/50" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-10 w-2/3 animate-pulse rounded bg-border/50" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-border/40" />
        </div>
      </div>
    </main>
  );
}
