import { NextResponse } from "next/server";
import { createBooksydeClient } from "@booksyde/shared";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/*
 * One-click unsubscribe (RFC 8058) for the monthly letter: mail apps POST here
 * from the List-Unsubscribe header. The token alone is the proof, so no
 * sign-in. A plain visit is sent to the /unsubscribe page, which asks first,
 * so link checkers that open every URL in an email can't unsubscribe anyone.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!UUID.test(token)) return Response.json({ error: "Bad token" }, { status: 400 });
  const client = createBooksydeClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.rpc("unsubscribe_monthly_picks", { token });
  if (error) return Response.json({ error: "Couldn't unsubscribe" }, { status: 500 });
  return Response.json({ ok: true });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(url.searchParams.get("token") ?? "")}`, url));
}
