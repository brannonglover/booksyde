"use server";

import {
  authErrorMessage,
  emailSchema,
  fieldErrors,
  isUsernameAvailable,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@booksyde/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** Echoed back so the form keeps what the reader typed (never the password). */
  values?: Record<string, string>;
  /** Set when we emailed the reader instead of signing them in. */
  sentTo?: string;
};

/** Only follow same-site paths like "/books/123", never "//evil.com". */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host") ?? "localhost:3000"}`;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function signIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: text(form, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };
  redirect(safeNext(form.get("next")));
}

/** "Email me a sign-in link instead": only for existing members. */
export async function sendSignInLink(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const email = emailSchema.safeParse(values.email);
  if (!email.success) return { fieldErrors: { email: email.error.issues[0]?.message }, values };

  const supabase = await createClient();
  const next = safeNext(form.get("next"));
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error && /rate limit/i.test(error.message)) return { error: authErrorMessage(error), values };
  // Otherwise reply the same way whether or not the account exists, so this can't be used to probe emails.
  return { sentTo: email.data };
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { displayName: text(form, "displayName"), username: text(form, "username"), email: text(form, "email") };
  const parsed = signUpSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  if (!(await isUsernameAvailable(supabase, parsed.data.username))) {
    return { fieldErrors: { username: "Someone already has that username. Try another?" }, values };
  }

  const next = safeNext(form.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user trigger to create the profile.
      data: { username: parsed.data.username, display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };
  // With email confirmation on, there's no session until they click the link.
  if (!data.session) return { sentTo: parsed.data.email };
  redirect(next);
}

export async function requestPasswordReset(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const email = emailSchema.safeParse(values.email);
  if (!email.success) return { fieldErrors: { email: email.error.issues[0]?.message }, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/update-password`,
  });
  if (error && /rate limit/i.test(error.message)) return { error: authErrorMessage(error), values };
  return { sentTo: email.data };
}

export async function updatePassword(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const password = passwordSchema.safeParse(text(form, "password"));
  if (!password.success) return { fieldErrors: { password: password.error.issues[0]?.message } };
  if (text(form, "confirm") !== password.data) return { fieldErrors: { confirm: "Those passwords don’t match" } };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "That reset link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorMessage(error) };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
