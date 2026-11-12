import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "../auth-shell";
import { DraftLibraryCard } from "./draft-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Get your library card" };

export default function SignUpPage() {
  return (
    <AuthShell
      aside={<DraftLibraryCard />}
      quote={{ text: "I declare after all there is no enjoyment like reading!", source: "Jane Austen, Pride and Prejudice" }}
      switchPrompt={{ text: "Already a member?", label: "Sign in", href: "/sign-in" }}
    >
      <AuthHeading kicker="Join Booksyde" title={<>Get your <em className="text-accent">library card</em>.</>}>
        Track what you read, find your next favorite by mood, and swap notes with readers like you.
      </AuthHeading>
      <Suspense fallback={<div className="h-[30rem] animate-pulse rounded-2xl bg-border/40" />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
