import { canRefreshCovers, refreshCovers } from "@/lib/cover-refresh";

/*
 * GET → { checked, upgraded, found, kept, skipped, stoppedBy, changes }: one
 * day's pass of the cover job (see cover-refresh.ts). Vercel Cron calls this
 * once a day (see vercel.json) with "Authorization: Bearer $CRON_SECRET";
 * anything else is turned away.
 */

// The job stops itself after four minutes; this is the platform's ceiling.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canRefreshCovers) return Response.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });
  const result = await refreshCovers();
  console.log("Covers:", JSON.stringify(result));
  return Response.json(result);
}
