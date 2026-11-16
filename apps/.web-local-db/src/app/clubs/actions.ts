"use server";

import { clubInputSchema, createClub, fieldErrors } from "@booksyde/shared";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ClubFormState = {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
};

export async function startClub(_prev: ClubFormState, form: FormData): Promise<ClubFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/clubs/new");

  const parsed = clubInputSchema.safeParse({
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? "").trim() || null,
    cover_color: String(form.get("cover_color") ?? "") || null,
    is_private: form.get("is_private") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let slug: string;
  try {
    ({ slug } = await createClub(supabase, parsed.data));
  } catch {
    return { error: "We couldn’t start your club. Please try again." };
  }
  redirect(`/clubs/${slug}`);
}
