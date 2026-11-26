"use server";

import { createBooksydeClient } from "@booksyde/shared";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

export type UnsubscribeState = { done?: boolean; error?: string };

/** Turns the monthly letter off for whoever holds the token from the email. No sign-in needed. */
export async function unsubscribe(_prev: UnsubscribeState, form: FormData): Promise<UnsubscribeState> {
  const token = String(form.get("token") ?? "");
  const client = createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("unsubscribe_monthly_picks", { token });
  if (error || !data) return { error: "That unsubscribe link didn’t work. Sign in and turn the letter off in your email settings instead." };
  return { done: true };
}
