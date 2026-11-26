"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EmailSettingsState = { saved?: boolean; error?: string };

export async function saveEmailSettings(_prev: EmailSettingsState, form: FormData): Promise<EmailSettingsState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/settings/email");
  const { error } = await supabase
    .from("email_preferences")
    .update({ monthly_picks: form.get("monthly_picks") === "on" })
    .eq("user_id", auth.user.id);
  if (error) return { error: "We couldn’t save that. Please try again." };
  return { saved: true };
}
