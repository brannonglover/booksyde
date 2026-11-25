import { canWriteNews, refreshNews } from "@/lib/news";

/*
 * GET → { charts, releases }: how many stories each half wrote (or why it failed).
 * Vercel Cron calls this once a day (see vercel.json) with
 * "Authorization: Bearer $CRON_SECRET"; anything else is turned away.
 */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWriteNews) return Response.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });
  const result = await refreshNews();
  return Response.json(result);
}
