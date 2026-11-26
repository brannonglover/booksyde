import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { UnsubscribeForm } from "./unsubscribe-form";

/*
 * Where the monthly letter's unsubscribe link lands. It asks before doing
 * anything, so a mail scanner opening the link can't unsubscribe anyone; the
 * mail app's own one-click button posts to /api/email/unsubscribe instead.
 */

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

type SearchParams = Promise<{ token?: string }>;

export default function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">The monthly letter</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Stop the <em className="text-accent">next-read</em> emails?
          </h1>
          <p className="mt-3 text-lg text-muted">
            Near the end of each month we send a few ideas for your next book. You can stop them here, no sign-in needed.
          </p>
        </header>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-border/40" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  if (!token) {
    return <p className="text-muted">This link is missing its token. Open the unsubscribe link from the email again.</p>;
  }
  return <UnsubscribeForm token={token} />;
}
