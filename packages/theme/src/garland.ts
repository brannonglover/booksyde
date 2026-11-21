import { bowArt, christmas } from "./season";

/**
 * An evergreen garland, one swag per tile (viewBox 0 0 240 60): a rope of fir
 * needles dipping between two posts, with holly berries, a gilt bead at the
 * lowest point and half a red bow at each post, so tiles laid side by side
 * join into one long garland with a whole bow at every post.
 *
 * The needles are drawn from a fixed seed, so the garland is the same on every
 * render and on both platforms.
 */

/** palette.gilt (not imported: index.ts imports this file, and the garland is built as it loads). */
const GILT = "#B8893A";
const W = 240;
const H = 60;

/** A small seeded random number generator (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The swag's centre line: from (0, 10) down through (120, 44) and back up to (240, 10). */
function swagPoint(t: number): [number, number] {
  const x = 2 * (1 - t) * t * 120 + t * t * W;
  const y = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 78 + t * t * 10;
  return [x, y];
}

const n = (v: number) => v.toFixed(1).replace(/\.0$/, "");

function makeGarland() {
  const random = seeded(1225);
  // Darkest first so the lighter needles catch the light on top.
  const greens = ["#173326", "#24432F", "#33583F", "#4F7A57", "#6E9A70"];
  const needles: string[][] = greens.map(() => []);
  const SAMPLES = 120;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const [x, y] = swagPoint(t);
    // Fuller in the middle of the swag, slimmer where it's tied at the posts.
    const reach = 6.5 + 4 * Math.sin(Math.PI * t);
    for (let k = 0; k < 6; k++) {
      const angle = random() * Math.PI * 2;
      const length = reach * (0.55 + random() * 0.6);
      const ox = (random() - 0.5) * 4;
      const oy = (random() - 0.5) * 4;
      const shade = Math.min(greens.length - 1, Math.floor(random() * greens.length));
      needles[shade].push(`M${n(x + ox)} ${n(y + oy)}l${n(Math.cos(angle) * length)} ${n(Math.sin(angle) * length)}`);
    }
  }

  const berries = [0.3, 0.7].flatMap((t) => {
    const [x, y] = swagPoint(t);
    return [
      { cx: x - 2.2, cy: y + 1.5, r: 2.2 },
      { cx: x + 2.2, cy: y + 1.5, r: 2.2 },
      { cx: x, cy: y - 1.6, r: 2.2 },
    ];
  });
  const [bx, by] = swagPoint(0.5);

  return {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    needles: greens.map((color, i) => ({ color, d: needles[i].join("") })),
    berries,
    berry: christmas.berry,
    bead: { cx: bx, cy: by + 4, r: 2.8, color: GILT },
    /** A bow at each post, scaled down from bowArt: centred on x = 0 and x = 240. */
    bows: [0, W].map((x) => `translate(${x - 12} 1) scale(0.24)`),
  };
}

export const garlandArt = makeGarland();

/** The garland tile as a standalone SVG document (for a CSS background on the web). */
export function garlandSvg(): string {
  const g = garlandArt;
  const bow = [
    ...bowArt.fill.map((d) => `<path d="${d}" fill="${christmas.ribbon}"/>`),
    ...bowArt.shade.map((d) => `<path d="${d}" fill="${christmas.ribbonShade}" opacity="0.75"/>`),
    `<ellipse cx="${bowArt.knot.cx}" cy="${bowArt.knot.cy}" rx="${bowArt.knot.rx}" ry="${bowArt.knot.ry}" fill="${christmas.ribbon}"/>`,
  ].join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}" width="${g.width}" height="${g.height}">`,
    ...g.needles.map((s) => `<path d="${s.d}" stroke="${s.color}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`),
    ...g.berries.map((b) => `<circle cx="${n(b.cx)}" cy="${n(b.cy)}" r="${b.r}" fill="${g.berry}"/>`),
    `<circle cx="${n(g.bead.cx)}" cy="${n(g.bead.cy)}" r="${g.bead.r}" fill="${g.bead.color}"/>`,
    `<circle cx="${n(g.bead.cx - 0.9)}" cy="${n(g.bead.cy - 0.9)}" r="0.9" fill="#fff" opacity="0.6"/>`,
    ...g.bows.map((transform) => `<g transform="${transform}">${bow}</g>`),
    `</svg>`,
  ].join("");
}
