import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { GoodreadsImport } from "./goodreads-import";

export const metadata: Metadata = { title: "Bring your books from Goodreads" };

// Each import batch may fetch a handful of books from Open Library.
export const maxDuration = 120;

export default function ImportPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Moving in</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Bring your books from <em className="text-accent">Goodreads</em>
          </h1>
          <p className="mt-3 text-lg text-muted">
            Your shelves, dates, ratings and reviews, carried over in one go. Nothing is posted to your followers’ feeds.
          </p>
        </header>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border/40" />}>
          <SignedInImport />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function SignedInImport() {
  // Request-time only: the Supabase client reads the clock, which can't happen while prerendering.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/settings/import");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", auth.user.id).single();
  if (!profile) redirect("/");
  return <GoodreadsImport username={profile.username} />;
}
