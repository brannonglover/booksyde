"use client";

import { useActionState } from "react";
import { BookCover } from "@/components/book-cover";
import { type AuthFormState, requestPasswordReset } from "../actions";
import { AuthHeading, AuthShell } from "../auth-shell";
import { CheckYourInbox, Field, FormError, SubmitButton } from "../fields";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  return (
    <AuthShell
      aside={
        <BookCover
          title="Jane Eyre"
          author="Charlotte Brontë"
          coverId={8235363}
          sizes="240px"
          className="w-56 -rotate-3 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]"
        />
      }
      quote={{ text: "Reader, I married him.", source: "Charlotte Brontë, Jane Eyre" }}
      switchPrompt={{ text: "Remembered it?", label: "Sign in", href: "/sign-in" }}
    >
      {state.sentTo ? (
        <CheckYourInbox email={state.sentTo}>
          If there&rsquo;s a library card with that email, the link inside lets you choose a new password.
        </CheckYourInbox>
      ) : (
        <>
          <AuthHeading kicker="Lost your key?" title={<>It happens to <em className="text-accent">the best of us</em>.</>}>
            Tell us your email and we&rsquo;ll send a link to choose a new password.
          </AuthHeading>
          <form action={action} className="flex flex-col gap-5" noValidate>
            <FormError message={state.error} />
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={state.values?.email}
              error={state.fieldErrors?.email}
              key={`email-${state.values?.email ?? ""}`}
            />
            <SubmitButton pendingLabel="Sending…">Send me a reset link</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
