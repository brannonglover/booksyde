import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { ClubForm } from "./club-form";

export const metadata: Metadata = { title: "Start a club" };

export default function NewClubPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Clubs</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Start a <em className="text-accent">club</em>
          </h1>
          <p className="mt-3 text-lg text-muted">
            Name it, give it a colour, and choose who can join. You can pick the first book next.
          </p>
        </header>
        <Suspense fallback={<div className="h-[28rem] animate-pulse rounded-2xl bg-border/40" />}>
          <SignedInForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function SignedInForm() {
  // Reads the session cookie, so it can only run at request time.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/clubs/new");
  return <ClubForm />;
}
