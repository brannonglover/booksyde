import type { BooksydeClient } from "../client";
import { usernameSchema } from "../schemas/profile";

/**
 * Whether a username is free. Profiles are public, so anyone can check.
 * (The signup trigger still falls back to a generated name if two people
 * race for the same one.)
 */
export async function isUsernameAvailable(client: BooksydeClient, username: string) {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return false;
  const { count, error } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", parsed.data);
  if (error) throw error;
  return (count ?? 0) === 0;
}

/** The signed-in reader's profile, or null when signed out. */
export async function getMyProfile(client: BooksydeClient) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, theme_color")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
