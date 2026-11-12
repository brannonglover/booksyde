"use server";

import { fieldErrors, isUsernameAvailable, profileUpdateSchema, updateMyProfile } from "@booksyde/shared";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
};

export async function saveProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/settings/profile");

  const parsed = profileUpdateSchema.safeParse({
    display_name: String(form.get("display_name") ?? "").trim() || null,
    username: String(form.get("username") ?? ""),
    bio: String(form.get("bio") ?? "").trim() || null,
    theme_color: String(form.get("theme_color") ?? "") || null,
    is_private: form.get("is_private") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // A new username must be free (your current one is, to you).
  const { data: current } = await supabase.from("profiles").select("username").eq("id", auth.user.id).single();
  if (parsed.data.username && parsed.data.username !== current?.username) {
    if (!(await isUsernameAvailable(supabase, parsed.data.username))) {
      return { fieldErrors: { username: "Someone already has that username. Try another?" } };
    }
  }

  try {
    await updateMyProfile(supabase, parsed.data);
  } catch {
    return { error: "We couldn’t save your bookplate. Please try again." };
  }
  redirect(`/u/${parsed.data.username ?? current?.username}`);
}
