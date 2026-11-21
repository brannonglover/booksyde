import { leafArt, thanksgiving } from "./season";

/**
 * A strip of fallen autumn leaves, one tile per 240 × 40 (laid end to end
 * along the foot of the header in November): maple and oval leaves in rust,
 * amber, cinnamon, gold and olive, scattered at angles. Every leaf sits wholly
 * inside its tile, so tiles join without a seam. Drawn from a fixed seed, so
 * it's the same on every render and on both platforms.
 */

const W = 240;
const H = 40;

/** A small seeded random number generator (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FallenLeaf = { shape: "maple" | "oval"; x: number; y: number; size: number; rotate: number; color: string };

function makeLeaves(): FallenLeaf[] {
  const random = seeded(1126);
  const COUNT = 8;
  const step = W / COUNT;
  return Array.from({ length: COUNT }, (_, i) => {
    const size = 17 + random() * 8;
    // Spread evenly across the tile (so the gap where tiles meet is no wider than any other), each wholly inside it.
    const x = Math.min(W - size - 1, Math.max(1, i * step + (step - size) / 2 + (random() - 0.5) * 8));
    return {
      shape: random() < 0.6 ? "maple" : "oval",
      x: Math.round(x * 10) / 10,
      y: Math.round((3 + random() * (H - size - 6)) * 10) / 10,
      size: Math.round(size * 10) / 10,
      rotate: Math.round(-70 + random() * 140),
      color: thanksgiving.leaves[Math.floor(random() * thanksgiving.leaves.length)],
    };
  });
}

export const leavesArt = { width: W, height: H, viewBox: `0 0 ${W} ${H}`, leaves: makeLeaves() };

/** Where a leaf goes: scaled from the 24-unit leaf art and turned about its centre. */
export function leafTransform(leaf: FallenLeaf) {
  const half = leaf.size / 2;
  return `translate(${leaf.x + half} ${leaf.y + half}) rotate(${leaf.rotate}) translate(${-half} ${-half}) scale(${leaf.size / 24})`;
}

/** The leaf strip tile as a standalone SVG document (for a CSS background on the web). */
export function leavesSvg(): string {
  const body = leavesArt.leaves
    .map((leaf) => {
      const shape =
        leaf.shape === "maple"
          ? `<path d="${leafArt.maple}" fill="${leaf.color}"/>`
          : `<path d="${leafArt.oval}" fill="${leaf.color}"/><path d="${leafArt.ovalVein}" stroke="#000" stroke-opacity="0.25" stroke-width="0.8" fill="none"/>`;
      return `<g transform="${leafTransform(leaf)}">${shape}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${leavesArt.viewBox}" width="${W}" height="${H}">${body}</svg>`;
}
