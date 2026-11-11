import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@booksyde/types";

export type BooksydeClient = SupabaseClient<Database>;

/**
 * Creates a typed Supabase client. Each app passes its own env values and
 * auth storage (cookies on web via @supabase/ssr, AsyncStorage on mobile).
 */
export function createBooksydeClient(
  url: string,
  publishableKey: string,
  options?: SupabaseClientOptions<"public">,
): BooksydeClient {
  if (!url || !publishableKey) {
    throw new Error("Missing Supabase URL or publishable key. Copy .env.example to .env.local.");
  }
  return createClient<Database>(url, publishableKey, options);
}
