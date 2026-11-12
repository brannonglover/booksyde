import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "../auth-shell";
import { DraftBookplate } from "./draft-bookplate";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Start your shelf" };

export default function SignUpPage() {
  return (
    <AuthShell
      aside={<DraftBookplate />}
      quote={{ text: "I declare after all there is no enjoyment like reading!", source: "Jane Austen, Pride and Prejudice" }}
      switchPrompt={{ text: "Already a member?", label: "Sign in", href: "/sign-in" }}
    >
      <AuthHeading kicker="Join Booksyde" title={<>Start your <em className="text-accent">shelf</em>.</>}>
        Track what you read, find your next favorite by mood, and swap notes with readers like you.
      </AuthHeading>
      <Suspense fallback={<div className="h-[30rem] animate-pulse rounded-2xl bg-border/40" />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
