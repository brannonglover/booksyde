import { leavesSvg } from "@booksyde/theme";

/*
 * GET → November's strip of fallen leaves (see leavesArt in @booksyde/theme), as
 * an SVG the page lays end to end with CSS (components/leaves.tsx: LeafStrip).
 * Built from a fixed seed, so it never changes between deploys: cache it hard.
 */
export function GET() {
  return new Response(leavesSvg(), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, s-maxage=31536000" },
  });
}
