"use client";

import { isUsernameAvailable, usernameSchema } from "@booksyde/shared";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type AuthFormState, signUp } from "../actions";
import { CheckYourInbox, Field, FormError, PasswordField, SubmitButton } from "../fields";
import { setDraft } from "./draft-bookplate";

/** "Margot Okafor" → "margot_okafor" (fits the username rules). */
function suggestUsername(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

type Availability = { username: string; status: "checking" | "free" | "taken" | "invalid" };

export function SignUpForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});
  const [displayName, setDisplayName] = useState(state.values?.displayName ?? "");
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [usernameEdited, setUsernameEdited] = useState(Boolean(state.values?.username));
  const [availability, setAvailability] = useState<Availability | null>(null);

  // Keep the bookplate preview in step with the form.
  useEffect(() => setDraft({ displayName, username }), [displayName, username]);

  // Check the username a moment after the reader stops typing.
  useEffect(() => {
    if (!username || !usernameSchema.safeParse(username).success) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setAvailability({ username, status: "checking" });
      isUsernameAvailable(createClient(), username)
        .then((free) => !cancelled && setAvailability({ username, status: free ? "free" : "taken" }))
        .catch(() => !cancelled && setAvailability(null));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  if (state.sentTo) {
    return <CheckYourInbox email={state.sentTo}>Click it to confirm your email and your shelf is ready.</CheckYourInbox>;
  }

  const formatOk = !username || usernameSchema.safeParse(username).success;
  const current = availability?.username === username ? availability.status : null;
  const usernameHint = !username ? (
    "This is your @handle. Letters, numbers and underscores."
  ) : !formatOk ? (
    <span className="text-accent">3–30 characters: letters, numbers and underscores</span>
  ) : current === "checking" ? (
    "Checking the card catalogue…"
  ) : current === "free" ? (
    <span className="text-success">✓ @{username} is yours if you want it</span>
  ) : current === "taken" ? (
    <span className="text-accent">Someone already has @{username}. Try another?</span>
  ) : null;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />
      <Field
        label="Your name"
        name="displayName"
        autoComplete="name"
        placeholder="Margot Okafor"
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          if (!usernameEdited) setUsername(suggestUsername(e.target.value));
        }}
        error={state.fieldErrors?.displayName}
      />
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="margot_reads"
        value={username}
        onChange={(e) => {
          setUsernameEdited(true);
          setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"));
        }}
        error={state.fieldErrors?.username}
        hint={usernameHint}
      />
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
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <SubmitButton pendingLabel="Pasting in your bookplate…">Start my shelf</SubmitButton>
      <p className="text-center text-xs text-muted">Free forever. No ads, no selling your reading history.</p>
    </form>
  );
}
