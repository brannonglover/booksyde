import { getMyClubs, getPublicClubs } from "@booksyde/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { ClubCard } from "@/components/club-card";
import { Ornament, SectionHeading, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clubs",
  description: "Book clubs and buddy reads on Booksyde: pick a book together and read it side by side.",
};

export default function ClubsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pb-24 sm:px-6">
        <header className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Clubs</p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight sm:text-7xl">
            Read it <em className="text-accent">together</em>.
          </h1>
          <Ornament className="mt-6 justify-center" />
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Join a club to read alongside other readers, or start your own: a big open circle or a quiet buddy read for
            two.
          </p>
          <Link
            href="/clubs/new"
            className="mt-8 inline-block rounded-full bg-primary px-7 py-3 font-semibold text-primary-text shadow-[0_10px_24px_-14px_rgba(31,27,22,0.7)] hover:opacity-90"
          >
            Start a club
          </Link>
        </header>

        <Suspense fallback={<CardsSkeleton />}>
          <MyClubs />
        </Suspense>

        <Suspense fallback={<CardsSkeleton />}>
          <PublicClubs />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

/** The viewer's clubs (empty when signed out), fetched once per request for both sections. */
const loadMyClubs = cache(async () => {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  return auth.user ? getMyClubs(client).catch(() => []) : [];
});

async function MyClubs() {
  // Reads the session cookie, so it can only run at request time.
  await connection();
  if (!hasSupabaseEnv) return null;
  const mine = await loadMyClubs();
  if (!mine.length) return null;

  return (
    <section className="flex flex-col gap-8">
      <SectionHeading numeral="I">Your clubs</SectionHeading>
      <ClubGrid>
        {mine.map((club) => (
          <li key={club.id}>
            <ClubCard club={club} role={club.role} />
          </li>
        ))}
      </ClubGrid>
    </section>
  );
}

async function PublicClubs() {
  await connection();
  if (!hasSupabaseEnv) return null;
  const client = await createClient();
  const [clubs, mine] = await Promise.all([getPublicClubs(client).catch(() => []), loadMyClubs()]);
  // Clubs you're already in are listed above.
  const mineIds = new Set(mine.map((c) => c.id));
  const open = clubs.filter((c) => !mineIds.has(c.id));

  return (
    <section className="flex flex-col gap-8">
      <SectionHeading numeral={mineIds.size ? "II" : "I"}>Open clubs</SectionHeading>
      {open.length ? (
        <ClubGrid>
          {open.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} />
            </li>
          ))}
        </ClubGrid>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-muted">
          {mineIds.size ? "No other open clubs right now. " : "No open clubs yet. "}
          <Link href="/clubs/new" className="font-semibold text-accent hover:underline">
            Start one
          </Link>{" "}
          and others can join.
        </p>
      )}
    </section>
  );
}

function ClubGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-12 w-64 animate-pulse rounded bg-border/50" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    </div>
  );
}
