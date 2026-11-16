import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "../auth-shell";
import { ReadingNook } from "./reading-nook";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell
      aside={<ReadingNook />}
      quote={{ text: "A room without books is like a body without a soul.", source: "Attributed to Cicero" }}
      switchPrompt={{ text: "New here?", label: "Start your shelf", href: "/sign-up" }}
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
