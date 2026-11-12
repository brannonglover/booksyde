"use client";

import { useActionState } from "react";
import { BookCover } from "@/components/book-cover";
import { type AuthFormState, updatePassword } from "../actions";
import { AuthHeading, AuthShell } from "../auth-shell";
import { FormError, PasswordField, SubmitButton } from "../fields";

/** Reached from the password-reset email (via /auth/callback, which signs the reader in). */
export default function UpdatePasswordPage() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});
  return (
    <AuthShell
      aside={
        <BookCover
          title="Frankenstein"
          author="Mary Shelley"
          coverId={12356249}
          sizes="240px"
          className="w-56 rotate-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]"
        />
      }
      quote={{ text: "Beware; for I am fearless, and therefore powerful.", source: "Mary Shelley, Frankenstein" }}
      switchPrompt={{ text: "Changed your mind?", label: "Back to Booksyde", href: "/" }}
    >
      <AuthHeading kicker="A fresh start" title={<>Choose a <em className="text-accent">new password</em>.</>}>
        Make it something only you would think of.
      </AuthHeading>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormError message={state.error} />
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint="At least 8 characters."
        />
        <PasswordField label="Type it again" name="confirm" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        <SubmitButton pendingLabel="Saving…">Save and continue reading</SubmitButton>
      </form>
    </AuthShell>
  );
}
