"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { type AuthFormState, sendSignInLink, signIn } from "../actions";
import { CheckYourInbox, Field, FormError, PasswordField, SubmitButton } from "../fields";

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const linkFailed = params.get("error") === "link";
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});
  const [linkState, linkAction, linkPending] = useActionState<AuthFormState, FormData>(sendSignInLink, {});

  if (linkState.sentTo) {
    return <CheckYourInbox email={linkState.sentTo}>Open it on this device to sign in.</CheckYourInbox>;
  }

  const errors = { ...linkState.fieldErrors, ...state.fieldErrors };
  const email = state.values?.email ?? linkState.values?.email;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError
        message={state.error ?? linkState.error ?? (linkFailed ? "That link didn’t work or has expired. Try again?" : undefined)}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={email}
        error={errors.email}
        key={`email-${email ?? ""}`}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        aside={
          <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
            Forgot it?
          </Link>
        }
      />
      <SubmitButton pendingLabel="Opening the doors…">Sign in</SubmitButton>

      <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="submit"
        formAction={linkAction}
        disabled={linkPending}
        className="w-full rounded-full border border-border bg-surface py-3.5 font-semibold transition hover:border-text/40 disabled:opacity-60"
      >
        {linkPending ? "Sending…" : "✉️  Email me a sign-in link"}
      </button>
    </form>
  );
}
