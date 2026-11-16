import { type NextRequest, NextResponse } from "next/server";
import { FLASH_COOKIE, type FlashKind } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

/**
 * Where email links land (sign-in links, confirmations, password resets).
 * Supabase sends back a one-time `code`; we swap it for a session cookie
 * and continue to `next`.
 *
 * Sign-up confirmations carry `flow=signup` so we can say "Email confirmed"
 * with a toast (see components/flash-toast.tsx) on the page they land on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const isSignup = searchParams.get("flow") === "signup";
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  // Supabase reports an expired or reused link with ?error=… instead of a code.
  if (code && !searchParams.has("error")) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      if (isSignup) {
        const name = String(data.user?.user_metadata?.display_name ?? "").trim().split(/\s+/)[0] ?? "";
        flash(response, "confirmed", name);
      }
      return response;
    }
    // Supabase only hands out a sign-up code once the email is verified, so if the swap fails here
    // (usually: link opened in a different browser than the one they signed up in), they're still
    // confirmed; they just need to sign in.
    if (isSignup) {
      const response = NextResponse.redirect(
        new URL(next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`, origin),
      );
      flash(response, "confirmed-sign-in");
      return response;
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", origin));
}

function flash(response: NextResponse, kind: FlashKind, detail = "") {
  const value = detail ? `${kind}:${detail}` : kind;
  // Readable by the toast (not httpOnly) and gone within a minute even if never shown.
  // (Next URL-encodes the value; the toast decodes it.)
  response.cookies.set(FLASH_COOKIE, value, { path: "/", maxAge: 60, sameSite: "lax" });
}
