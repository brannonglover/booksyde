import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Edit your bookplate" };

export default function EditProfilePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Your profile</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Edit your <em className="text-accent">bookplate</em>
          </h1>
          <p className="mt-3 text-lg text-muted">This is how other readers see you on Booksyde.</p>
        </header>
        <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-border/40" />}>
          <EditProfile />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function EditProfile() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/settings/profile");
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, theme_color, is_private")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/");
  return <ProfileForm profile={profile} />;
}
