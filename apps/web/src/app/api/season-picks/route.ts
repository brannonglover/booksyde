import { getSeasonPicks } from "@/lib/season-picks";

/*
 * GET → { "picks": SeasonPicks | null }
 * December's bestseller and Christmas book for the mobile app's home screen
 * (the bestseller needs the server's NYT key). Null outside the weeks around
 * December; the app decides from the reader's own clock whether to show them.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET() {
  try {
    const picks = await getSeasonPicks();
    return Response.json({ picks }, { headers: { ...cors, "Cache-Control": "public, max-age=300, s-maxage=3600" } });
  } catch (e) {
    console.error("Season picks failed", e);
    return Response.json({ error: "Couldn't choose the season's picks" }, { status: 502, headers: cors });
  }
}
