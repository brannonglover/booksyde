import { getMyProfile } from "@booksyde/shared";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ThemePicker, ThemeToggleButton } from "@/components/theme-toggle";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Reads the session cookie, so it streams in behind a Suspense boundary. */
async function AccountArea() {
  // Request-time only: the Supabase client reads the clock, which can't happen while prerendering.
  await connection();
  const profile = hasSupabaseEnv ? await getMyProfile(await createClient()).catch(() => null) : null;
  if (profile) return <AccountMenu profile={profile} />;
  return (
    <>
      <Link className="whitespace-nowrap rounded-full px-2.5 py-2 hover:bg-surface sm:px-4" href="/sign-in">
        Sign in
      </Link>
      <Link className="whitespace-nowrap rounded-full bg-primary px-3.5 py-2 text-primary-text hover:opacity-90 sm:px-4" href="/sign-up">
        Join free
      </Link>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-[1.7rem] leading-none sm:text-3xl">
          Booksyde<span className="text-highlight">.</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm font-semibold sm:gap-2">
          <Link className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="/#discover">
            Discover
          </Link>
          <Link className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="/#join">
            Clubs
          </Link>
          <Link
            href="/search"
            aria-label="Search the catalogue"
            title="Search the catalogue"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-text"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>
          <ThemeToggleButton />
          <Suspense fallback={<span aria-hidden className="ml-1 h-9 w-24 animate-pulse rounded-full bg-border/50" />}>
            <AccountArea />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl text-text">
            Booksyde<span className="text-highlight">.</span>
          </span>
          <span className="italic">Set in Instrument Serif &amp; Plus Jakarta Sans. Made for readers.</span>
        </div>
        <ThemePicker />
      </div>
    </footer>
  );
}

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-3 text-highlight ${className}`}>
      <span className="h-px w-10 bg-current opacity-60" />
      <span className="text-lg leading-none">❦</span>
      <span className="h-px w-10 bg-current opacity-60" />
    </div>
  );
}

export function SectionHeading({
  numeral,
  children,
  aside,
  as: Tag = "h2",
}: {
  numeral: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <Tag className="font-display text-4xl leading-none sm:text-5xl">
        <span className="mr-3 text-2xl italic text-highlight sm:text-3xl">{numeral}.</span>
        {children}
      </Tag>
      {aside}
    </div>
  );
}
