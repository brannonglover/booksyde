import { revalidateTag } from "next/cache";
import { importOpenLibraryWork } from "@/lib/open-library-import";

/*
 * POST { "olid": "OL38495W" } → { "id": "<booksyde work id>" }
 * The mobile app's "add to the catalogue". Only an Open Library id comes in;
 * everything stored is fetched from Open Library on the server.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { olid?: unknown } | null;
  const olid = typeof body?.olid === "string" ? body.olid : "";
  try {
    const id = await importOpenLibraryWork(olid);
    if (!id) return Response.json({ error: "Not found on Open Library" }, { status: 404, headers: cors });
    revalidateTag("catalog-search", "max");
    revalidateTag("catalog-drawers", "max");
    return Response.json({ id }, { headers: cors });
  } catch (e) {
    console.error("Open Library import failed", olid, e);
    return Response.json({ error: "Import failed" }, { status: 502, headers: cors });
  }
}
