import { getFeaturedBook } from "@/lib/catalog";

/*
 * GET → { "book": FeaturedBook | null }
 * The home page's pick of the day, for the mobile app. Before Booksyde has a
 * crowd the pick comes from the bestseller list, which needs the server's NYT
 * key, so the app asks here rather than working it out itself.
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
    const book = await getFeaturedBook();
    return Response.json({ book }, { headers: { ...cors, "Cache-Control": "public, max-age=300, s-maxage=3600" } });
  } catch (e) {
    console.error("Featured pick failed", e);
    return Response.json({ error: "Couldn't choose today's pick" }, { status: 502, headers: cors });
  }
}
