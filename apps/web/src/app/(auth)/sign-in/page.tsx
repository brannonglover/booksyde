import type { Metadata } from "next";
import { Suspense } from "react";
import { BookCover } from "@/components/book-cover";
import { AuthHeading, AuthShell } from "../auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** Three paperbacks leaning in an arched library window. */
function ReadingWindow() {
  return (
    <div className="relative grid aspect-[4/5] w-full max-w-sm place-items-end overflow-hidden rounded-t-full border border-gilt/40 bg-[#24392F] px-10 pb-0">
      <div aria-hidden className="absolute inset-3 rounded-t-full border border-gilt/25" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "radial-gradient(70% 70% at 50% 100%, rgba(216,176,104,0.35), transparent)" }} />
      <div className="relative flex w-full items-end justify-center gap-0 pb-6">
        <BookCover title="Jane Eyre" author="Charlotte Brontë" coverId={8235363} sizes="120px" className="w-[30%] origin-bottom-right -rotate-6" />
        <BookCover title="Pride and Prejudice" author="Jane Austen" coverId={14348537} sizes="140px" priority className="z-10 -mx-2 w-[36%]" />
        <BookCover title="Wuthering Heights" author="Emily Brontë" coverId={12818862} sizes="120px" className="w-[30%] origin-bottom-left rotate-6" />
      </div>
      <div aria-hidden className="relative h-3 w-[calc(100%+5rem)] -translate-x-0 bg-[#8A6A4A]" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <AuthShell
      aside={<ReadingWindow />}
      quote={{ text: "A room without books is like a body without a soul.", source: "Attributed to Cicero" }}
      switchPrompt={{ text: "New here?", label: "Get a library card", href: "/sign-up" }}
    >
      <AuthHeading kicker="Welcome back" title={<>Your chair is <em className="text-accent">right where you left it</em>.</>}>
        Sign in to pick up your shelves and your notes in the margins.
      </AuthHeading>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-border/40" />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
