import {
  compactCount,
  type FollowState,
  getFollowState,
  getProfileByUsername,
  getProfileShelves,
  getProfileStats,
  getUserReviews,
  type ProfileStats,
} from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { FollowButton } from "@/components/follow-button";
import { ReviewBody } from "@/components/review-body";
import { Ornament, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Stars } from "@/components/stars";
import { createClient } from "@/lib/supabase/server";

/*
 * A reader's profile, styled as the bookplate inside the cover of their
 * books ("Ex Libris"), followed by their reading palette, their shelves and
 * their marginalia. Personal to the viewer (follow state, private libraries),
 * so it renders per request.
 */

type Params = Promise<{ username: string }>;
type Profile = NonNullable<Awaited<ReturnType<typeof getProfileByUsername>>>;
type Shelves = Awaited<ReturnType<typeof getProfileShelves>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username).replace(/^@/, "")}` };
}

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileView params={params} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function plural(n: number, word: string) {
  return `${compactCount(n)} ${word}${n === 1 ? "" : "s"}`;
}

async function ProfileView({ params }: { params: Params }) {
  const { username } = await params;
  const supabase = await createClient();
  const profile = await getProfileByUsername(supabase, decodeURIComponent(username).replace(/^@/, ""));
  if (!profile) notFound();

  const [followState, stats] = await Promise.all([getFollowState(supabase, profile.id), getProfileStats(supabase, profile.id)]);
  const canSee = !profile.is_private || followState === "self" || followState === "following";
  const [shelves, reviews] = canSee
    ? await Promise.all([getProfileShelves(supabase, profile.id), getUserReviews(supabase, profile.id, 6)])
    : [null, []];
  const ink = profile.theme_color ?? "#2D4A3E";
  const name = profile.display_name || profile.username;

  return (
    <main className="flex flex-1 flex-col">
      <section
        className="border-b border-border px-4 pb-16 pt-12 sm:px-6 sm:pt-16"
        style={{ background: `linear-gradient(to bottom, color-mix(in oklab, ${ink} 10%, var(--bk-background)), var(--bk-background))` }}
      >
        <Bookplate profile={profile} name={name} ink={ink} stats={canSee ? stats : null} followState={followState} />
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6">
        {!canSee ? (
          <PrivateLibrary name={name} pending={followState === "pending"} />
        ) : (
          <>
            {stats.moods.length > 0 ? <ReadingPalette name={name} stats={stats} /> : null}
            <ShelvesSection shelves={shelves!} isOwn={followState === "self"} />
            <section className="flex flex-col gap-8">
              <ChapterHeading kicker="In the margins" title={`${name.split(" ")[0]}’s notes`} />
              {reviews.length === 0 ? (
                <p className="text-center text-muted">No notes in the margins yet.</p>
              ) : (
                <ul className="grid gap-8 md:grid-cols-2">
                  {reviews.map((r, i) => (
                    <li
                      key={r.id}
                      className={`index-card rounded-sm px-6 pb-6 pt-5 shadow-[0_14px_30px_-18px_rgba(31,27,22,0.55)] transition duration-300 hover:rotate-0 ${
                        i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"
                      }`}
                    >
                      {r.works ? (
                        <Link href={`/books/${r.works.id}`} className="group flex items-center gap-3 border-b-2 border-oxblood/45 pb-3">
                          <BookCover
                            title={r.works.title}
                            author=""
                            src={r.works.cover_url}
                            color={r.works.cover_color}
                            sizes="48px"
                            className="w-10 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-xl leading-tight group-hover:text-accent">{r.works.title}</span>
                            <span className="block text-xs text-muted">{dateFormat.format(new Date(r.created_at))}</span>
                          </span>
                          {r.rating ? (
                            <span className="shrink-0 text-sm">
                              <Stars rating={Number(r.rating)} />
                            </span>
                          ) : null}
                        </Link>
                      ) : null}
                      <div className="ruled mt-3">
                        <ReviewBody body={r.body ?? ""} hasSpoilers={r.has_spoilers} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ChapterHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{kicker}</p>
      <h2 className="font-display text-5xl leading-none">{title}</h2>
      <Ornament className="mt-1" />
    </header>
  );
}

/** The "Ex Libris" plate pasted inside the front cover, in the reader's own ink. */
function Bookplate({
  profile,
  name,
  ink,
  stats,
  followState,
}: {
  profile: Profile;
  name: string;
  ink: string;
  stats: ProfileStats | null;
  followState: FollowState;
}) {
  const facts = [
    [compactCount(profile.followers_count), profile.followers_count === 1 ? "follower" : "followers"],
    [compactCount(profile.following_count), "following"],
    ...(stats
      ? [
          [compactCount(stats.read), stats.read === 1 ? "book read" : "books read"],
          [compactCount(stats.pages), "pages"],
        ]
      : []),
  ];
  return (
    <div className="relative mx-auto max-w-2xl rounded-sm bg-[#FBF5E8] p-2 text-ink shadow-[0_24px_50px_-28px_rgba(31,27,22,0.6)] dark:bg-[#2F2822] dark:text-paper">
      <div className="relative rounded-sm border-[3px] border-double px-6 pb-8 pt-7 text-center sm:px-12" style={{ borderColor: ink }}>
        {/* Corner flourishes */}
        {["left-2 top-1", "right-2 top-1 scale-x-[-1]", "bottom-1 left-2 scale-y-[-1]", "bottom-1 right-2 scale-[-1]"].map((pos) => (
          <span key={pos} aria-hidden className={`absolute text-xl ${pos}`} style={{ color: ink }}>
            ❧
          </span>
        ))}
        <p className="text-xs font-bold uppercase tracking-[0.5em]" style={{ color: ink }}>
          Ex Libris
        </p>
        <div
          aria-hidden
          className="mx-auto mt-5 grid size-20 place-items-center rounded-full border-4 border-double font-display text-4xl text-paper"
          style={{ background: ink, borderColor: "var(--bk-gilt)" }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-balance font-display text-5xl leading-none sm:text-6xl">{name}</h1>
        <p className="mt-2 text-sm text-muted">
          @{profile.username}
          {profile.is_private ? <span title="Private library"> · 🔒 Private</span> : null}
        </p>
        {profile.bio ? <p className="mx-auto mt-4 max-w-md font-display text-xl italic leading-snug">{profile.bio}</p> : null}
        <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted">
          A member since {monthYear.format(new Date(profile.created_at))}
        </p>

        <dl className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center divide-x divide-current/15 border-y border-current/15 py-3">
          {facts.map(([value, label]) => (
            <div key={label} className="px-4 py-1">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="font-display text-2xl leading-none">{value}</span>{" "}
                <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex justify-center">
          {followState === "self" ? (
            <Link
              href="/settings/profile"
              className="rounded-full border border-current/30 px-6 py-2.5 font-semibold transition hover:border-accent hover:text-accent"
            >
              Edit your bookplate
            </Link>
          ) : (
            <FollowButton userId={profile.id} initial={followState} isPrivate={profile.is_private} />
          )}
        </div>
      </div>
    </div>
  );
}

/** What this reader's books feel like, from the moods of everything they've read. */
function ReadingPalette({ name, stats }: { name: string; stats: ProfileStats }) {
  const total = stats.moods.reduce((sum, m) => sum + m.weight, 0) || 1;
  const top = stats.moods.slice(0, 2).map((m) => m.name.toLowerCase());
  const genres = stats.genres.map((g) => g.name);
  return (
    <section className="flex flex-col gap-8">
      <ChapterHeading kicker="Reading palette" title="What they reach for" />
      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="font-display text-3xl italic leading-snug sm:text-4xl">
          {name.split(" ")[0]} reads mostly <span className="text-accent">{top.join(" and ")}</span> books
          {genres.length > 0 ? (
            <>
              , with a soft spot for <span className="text-accent">{genres.slice(0, 2).join(" and ").toLowerCase()}</span>
            </>
          ) : null}
          .
        </p>
        <div className="mt-8 flex h-5 overflow-hidden rounded-full ring-1 ring-border" role="img" aria-label={stats.moods.map((m) => m.name).join(", ")}>
          {stats.moods.map((m) => (
            <span key={m.slug} title={m.name} style={{ width: `${(m.weight / total) * 100}%`, background: genreColor(m.slug).dot }} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          {stats.moods.map((m) => (
            <span key={m.slug} className="inline-flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: genreColor(m.slug).dot }} />
              {m.name}
            </span>
          ))}
        </div>
        {stats.ratings > 0 ? (
          <p className="mt-6 text-sm text-muted">
            Gives an average of <span className="font-semibold text-text">{stats.averageRating?.toFixed(1)}★</span> across{" "}
            {plural(stats.ratings, "rating")}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

const shelfOrder = [
  { key: "reading", title: "Reading now", empty: "Nothing on the nightstand right now." },
  { key: "want_to_read", title: "Want to read", empty: "No books waiting in the wings yet." },
  { key: "read", title: "Read", empty: "No finished books yet." },
] as const;

function ShelvesSection({ shelves, isOwn }: { shelves: Shelves; isOwn: boolean }) {
  return (
    <section className="flex flex-col gap-10">
      <ChapterHeading kicker="The bookcase" title="On their shelves" />
      {shelfOrder.map(({ key, title, empty }) => {
        const books = shelves[key];
        return (
          <div key={key} className="flex flex-col gap-4">
            <h3 className="flex items-baseline gap-3 font-display text-3xl">
              {title}
              <span className="font-sans text-sm text-muted">{books.length}</span>
            </h3>
            {books.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-muted">
                {empty}
                {isOwn ? (
                  <>
                    {" "}
                    <Link href="/discover" className="font-semibold text-accent hover:underline">
                      Find something to read
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <div>
                <div className="flex items-end gap-4 overflow-x-auto px-3 pt-3 sm:gap-6">
                  {books.map((w) => (
                    <Link
                      key={w.id}
                      href={`/books/${w.id}`}
                      title={w.title}
                      className="w-24 shrink-0 transition duration-300 hover:-translate-y-2 sm:w-28"
                    >
                      <BookCover title={w.title} author="" src={w.cover_url} color={w.cover_color} sizes="112px" />
                    </Link>
                  ))}
                </div>
                <div aria-hidden className="h-3 rounded-sm bg-[#8A6A4A] shadow-[0_8px_14px_-6px_rgba(31,27,22,0.6)] dark:bg-[#6E543B]" />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function PrivateLibrary({ name, pending }: { name: string; pending: boolean }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-border bg-surface px-8 py-12 text-center">
      <p className="text-5xl" aria-hidden>
        🔒
      </p>
      <h2 className="font-display text-4xl">A private library</h2>
      <p className="text-muted">
        {pending
          ? `Your request is with ${name.split(" ")[0]}. Once they say yes, you’ll see their shelves and notes here.`
          : `${name.split(" ")[0]} keeps their shelves to friends. Ask to follow, and once they say yes you’ll see what they’re reading.`}
      </p>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-16">
      <div className="h-96 w-full max-w-2xl animate-pulse rounded-sm bg-border/40" />
    </main>
  );
}
