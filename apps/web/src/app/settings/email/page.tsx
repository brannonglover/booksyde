import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { EmailForm } from "./email-form";

export const metadata: Metadata = { title: "Email settings" };

export default function EmailSettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Settings</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            What we <em className="text-accent">send you</em>
          </h1>
          <p className="mt-3 text-lg text-muted">Sign-in links and account emails always come through. The rest is up to you.</p>
        </header>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-border/40" />}>
          <EmailSettings />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function EmailSettings() {
  // Per request: Supabase's auth checks the session against the clock.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/settings/email");
  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("monthly_picks")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return <EmailForm monthlyPicks={prefs?.monthly_picks ?? true} />;
}
