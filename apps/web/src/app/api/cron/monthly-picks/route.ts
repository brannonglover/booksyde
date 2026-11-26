import { canSendMonthlyPicks, sendMonthlyPicks, sendMonthlyPicksTo } from "@/lib/monthly-picks";

/*
 * GET → { issue, sent, nothingToSuggest, remaining, error? }: the monthly
 * "next read" letter (see monthly-picks.ts). Vercel Cron calls this on the
 * 25th to the 28th of each month (see vercel.json) with
 * "Authorization: Bearer $CRON_SECRET"; anything else is turned away. The
 * first run sends it; the later ones only pick up anyone a time limit or an
 * error left waiting.
 *
 * With the same header, by hand:
 *   ?dry=1          build the first 100 readers' letters, send nothing, mark nothing
 *   ?to=<username>  send one reader this month's letter now (for trying it out)
 */

// The job stops itself after four minutes; this is the platform's ceiling.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canSendMonthlyPicks) {
    return Response.json({ error: "SUPABASE_SECRET_KEY or RESEND_API_KEY is not set" }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const to = params.get("to");
  if (to) return Response.json(await sendMonthlyPicksTo(to));

  const result = await sendMonthlyPicks({ deadline: Date.now() + 240_000, dryRun: params.get("dry") === "1" });
  console.log("Monthly picks:", JSON.stringify(result));
  return Response.json(result, { status: result.error ? 502 : 200 });
}
