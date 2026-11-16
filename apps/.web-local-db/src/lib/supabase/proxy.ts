import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@booksyde/types";
import { hasSupabaseEnv, supabaseKey, supabaseUrl } from "./env";

/** Refreshes the Supabase auth session cookie on every request. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Don't put code between createServerClient and getClaims — it can log users out.
  await supabase.auth.getClaims();
  return response;
}
