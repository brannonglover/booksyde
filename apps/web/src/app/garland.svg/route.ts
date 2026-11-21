import { garlandSvg } from "@booksyde/theme";

/*
 * GET → the December garland tile (see garlandArt in @booksyde/theme), as an
 * SVG the page lays end to end with CSS (components/holly.tsx: Garland). Built
 * from a fixed seed, so it never changes between deploys: cache it hard.
 */
export function GET() {
  return new Response(garlandSvg(), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=31536000" },
  });
}
