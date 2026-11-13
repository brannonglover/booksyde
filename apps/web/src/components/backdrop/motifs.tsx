import { mixHex } from "@booksyde/theme";

/*
 * Genre motifs: small illustrated scenes drawn behind a featured book. Each
 * is a full-bleed SVG (400×500, cropped to fit like object-fit: cover) that
 * keeps the middle fairly quiet, where the cover sits. The base colour leans
 * a little toward the book's own cover colour so each scene suits its book.
 */

export const motifs = ["gothic", "mystery", "fantasy", "romance", "starfield"] as const;
export type Motif = (typeof motifs)[number];

export const motifLabels: Record<Motif, string> = {
  gothic: "Gothic",
  mystery: "Mystery",
  fantasy: "Fantasy map",
  romance: "Romance",
  starfield: "Starfield",
};

/** Which tags call for which motif. Genres are checked before moods (see motifFor). */
const motifByTag: Record<string, Motif> = {
  horror: "gothic",
  gothic: "gothic",
  dark: "gothic",
  mystery: "mystery",
  thriller: "mystery",
  mysterious: "mystery",
  tense: "mystery",
  fantasy: "fantasy",
  adventurous: "fantasy",
  romance: "romance",
  "science-fiction": "starfield",
};

export type BackdropTag = { slug: string; kind: string; votes: number };

/** The motif for a book's strongest matching tag: genres first, then moods, most votes first. */
export function motifFor(tags: BackdropTag[]): Motif | null {
  const ranked = [...tags].sort((a, b) => Number(b.kind === "genre") - Number(a.kind === "genre") || b.votes - a.votes);
  for (const tag of ranked) if (Object.hasOwn(motifByTag, tag.slug)) return motifByTag[tag.slug];
  return null;
}

/** Leans a motif's base colour toward the cover colour, just enough to tie them together. */
const lean = (base: string, tint: string | null | undefined, amount = 0.18) =>
  tint ? mixHex(base, tint, amount) : base;

/** Deterministic scatter, so server and client draw the same stars, rain and petals. */
function scatter(count: number, seed: number) {
  let s = seed;
  const next = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, () => ({ x: next() * 400, y: next() * 500, r: next() }));
}

const RAIN = scatter(46, 7);
const STARS = scatter(90, 11);
const PETALS = scatter(26, 23).filter((p) => p.x < 110 || p.x > 290 || p.y < 110 || p.y > 430);

export function MotifArt({ motif, tint }: { motif: Motif; tint?: string | null }) {
  const Scene = scenes[motif];
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <Scene tint={tint} />
    </svg>
  );
}

type SceneProps = { tint?: string | null };

function Gothic({ tint }: SceneProps) {
  const sky = lean("#2A2238", tint);
  const ground = mixHex(sky, "#000000", 0.55);
  return (
    <>
      <rect width="400" height="500" fill={sky} />
      <circle cx="318" cy="92" r="70" fill="#E4DCC8" opacity="0.06" />
      <circle cx="318" cy="92" r="34" fill="#E4DCC8" opacity="0.92" />
      <path d="M236 18 l-22 58 h18 l-26 62" fill="none" stroke="#EDE6F7" strokeWidth="2.5" opacity="0.7" />
      <g stroke="#B7AED0" strokeWidth="1.2" strokeLinecap="round" opacity="0.35">
        {RAIN.map((d, i) => (
          <path key={i} d={`M${d.x} ${d.y} l-7 ${22 + d.r * 14}`} />
        ))}
      </g>
      <path
        d="M0 500V398h30v-22h16v22h20V338h12l8-28 8 28h12v60h40v-34h14v-14h14v14h14v34h50V326h12l10-32 10 32h12v72h40v-30h20v-20h20v50h48V500Z"
        fill={ground}
      />
      <g fill="#E8C878" opacity="0.85">
        <rect x="83" y="352" width="6" height="10" rx="3" />
        <rect x="263" y="344" width="6" height="10" rx="3" />
        <rect x="263" y="372" width="6" height="10" rx="3" />
      </g>
    </>
  );
}

function Mystery({ tint }: SceneProps) {
  const base = lean("#3B4440", tint);
  const dark = mixHex(base, "#000000", 0.5);
  return (
    <>
      <rect width="400" height="500" fill={base} />
      {/* Rooftops and chimneys in the distance */}
      <path
        d="M0 330V280h40v-30h12v30h50l20-24 20 24h70v-40h10v-14h10v54h60l26-30 26 30h56v50Z"
        fill={dark}
        opacity="0.45"
      />
      {/* Gas lamp */}
      <circle cx="58" cy="118" r="48" fill="#E8C878" opacity="0.12" />
      <circle cx="58" cy="118" r="22" fill="#E8C878" opacity="0.18" />
      <rect x="54" y="132" width="8" height="368" fill={dark} />
      <path d="M38 132h40l-6-30H44Z" fill={dark} />
      <rect x="46" y="106" width="24" height="24" fill="#E8C878" />
      <path d="M40 102h36l-18-14Z" fill={dark} />
      {/* Fog */}
      <g fill="#D7DED8">
        <rect x="-40" y="300" width="300" height="34" rx="17" opacity="0.13" />
        <rect x="140" y="352" width="320" height="38" rx="19" opacity="0.13" />
        <rect x="-60" y="410" width="280" height="34" rx="17" opacity="0.15" />
        <rect x="200" y="452" width="260" height="30" rx="15" opacity="0.12" />
      </g>
      {/* Footprints leading away */}
      <g fill={dark} opacity="0.8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse
            key={i}
            cx={318 + (i % 2 ? 14 : 0) + i * 6}
            cy={488 - i * 26}
            rx="6"
            ry="9"
            transform={`rotate(${20 + i * 2} ${318 + (i % 2 ? 14 : 0) + i * 6} ${488 - i * 26})`}
          />
        ))}
      </g>
    </>
  );
}

function Fantasy({ tint }: SceneProps) {
  const parchment = lean("#E6D6B0", tint, 0.1);
  const ink = "#6E5230";
  return (
    <>
      <rect width="400" height="500" fill={parchment} />
      <g stroke={ink} strokeWidth="0.6" opacity="0.15">
        {[50, 100, 150, 200, 250, 300, 350].map((x) => (
          <path key={`v${x}`} d={`M${x} 0V500`} />
        ))}
        {[60, 120, 180, 240, 300, 360, 420, 480].map((y) => (
          <path key={`h${y}`} d={`M0 ${y}H400`} />
        ))}
      </g>
      {/* Mountains */}
      <g fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" opacity="0.75">
        <path d="M236 86l22-36 22 36M268 86l26-44 26 44M308 86l20-30 20 30M340 86l18-26 18 26" />
        <path d="M262 62l-6 10M296 54l-6 12" strokeWidth="1.2" />
      </g>
      {/* Forest */}
      <g fill="#5F7A3A" opacity="0.6">
        {[
          [40, 120],
          [58, 110],
          [72, 126],
          [30, 140],
          [54, 142],
          [80, 150],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y - 16}l10 18h-20Z`} />
        ))}
      </g>
      {/* River and coast */}
      <path d="M0 236c40-10 60 20 96 8s50-30 70-20" fill="none" stroke="#5E8AA0" strokeWidth="2.5" opacity="0.55" />
      <path d="M0 470c30-8 50 6 80-4s46-18 70-10" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />
      {/* The road there and back again */}
      <path
        d="M46 452C90 400 70 330 110 290S210 210 252 160 300 110 300 96"
        fill="none"
        stroke="#9A2A20"
        strokeWidth="2.5"
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <path d="M292 88l16 16M308 88l-16 16" stroke="#9A2A20" strokeWidth="3" strokeLinecap="round" />
      {/* Compass rose */}
      <g transform="translate(336 420)" stroke={ink} fill="none" strokeWidth="1.2" opacity="0.8">
        <circle r="30" />
        <circle r="22" opacity="0.5" />
        <path d="M0-44 6-6 0 0-6-6ZM0 44 6 6 0 0-6 6ZM-44 0-6-6 0 0-6 6ZM44 0 6-6 0 0 6 6Z" fill={ink} fillOpacity="0.25" />
      </g>
    </>
  );
}

const rose = "#B0565A";
const leaf = "#6F8B5E";

function Rose({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-16" cy="12" rx="14" ry="6" fill={leaf} transform="rotate(-30 -16 12)" />
      <ellipse cx="16" cy="14" rx="14" ry="6" fill={leaf} transform="rotate(30 16 14)" />
      <circle r="16" fill={rose} />
      <circle r="11" fill={mixHex(rose, "#5A1E22", 0.25)} />
      <path d="M-6-2a7 7 0 0 1 12 0a5 5 0 0 1-8 4" fill="none" stroke={mixHex(rose, "#FFFFFF", 0.3)} strokeWidth="1.6" />
    </g>
  );
}

function Romance({ tint }: SceneProps) {
  const base = lean("#EBD5CD", tint, 0.12);
  return (
    <>
      <rect width="400" height="500" fill={base} />
      {/* Climbing vine down each side */}
      <g fill="none" stroke={leaf} strokeWidth="2" opacity="0.7">
        <path d="M30 500C50 420 10 360 40 290S20 160 60 80 40 20 70 0" />
        <path d="M370 500C350 430 390 370 362 300S384 170 344 96 362 24 332 0" />
      </g>
      <g fill={leaf} opacity="0.7">
        {[
          [40, 420, -30],
          [28, 330, 30],
          [44, 230, -40],
          [52, 130, 20],
          [362, 440, 30],
          [372, 340, -30],
          [360, 240, 40],
          [350, 140, -20],
        ].map(([x, y, a]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="11" ry="5" transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </g>
      <Rose x={46} y={70} s={1.3} />
      <Rose x={354} y={460} s={1.4} />
      <Rose x={36} y={372} />
      <Rose x={364} y={190} s={0.9} />
      <g fill={rose} opacity="0.45">
        {PETALS.map((p, i) => (
          <ellipse key={i} cx={p.x} cy={p.y} rx={4 + p.r * 4} ry={2.5 + p.r * 2} transform={`rotate(${p.r * 180} ${p.x} ${p.y})`} />
        ))}
      </g>
    </>
  );
}

function Starfield({ tint }: SceneProps) {
  const space = lean("#141C30", tint, 0.15);
  return (
    <>
      <rect width="400" height="500" fill={space} />
      <g fill="#EAF0FF">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={0.6 + s.r * 1.6} opacity={0.35 + s.r * 0.6} />
        ))}
      </g>
      {/* Orbits */}
      <g fill="none" stroke="#8FA8D8" strokeWidth="1" opacity="0.3">
        <ellipse cx="200" cy="260" rx="190" ry="70" transform="rotate(-18 200 260)" strokeDasharray="3 6" />
        <ellipse cx="200" cy="260" rx="250" ry="110" transform="rotate(-18 200 260)" />
      </g>
      {/* Ringed planet */}
      <g transform="translate(78 96)">
        <circle r="38" fill="#C27A55" />
        <path d="M-38 0a38 38 0 0 0 76 0" fill="#000000" opacity="0.22" />
        <ellipse rx="62" ry="13" fill="none" stroke="#E8C878" strokeWidth="3" opacity="0.85" transform="rotate(-16)" />
      </g>
      {/* Small moon and a comet */}
      <circle cx="340" cy="420" r="14" fill="#8FA8D8" />
      <path d="M300 70l70-26" stroke="#EAF0FF" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="300" cy="70" r="3.5" fill="#FFFFFF" />
    </>
  );
}

const scenes: Record<Motif, (props: SceneProps) => React.ReactNode> = {
  gothic: Gothic,
  mystery: Mystery,
  fantasy: Fantasy,
  romance: Romance,
  starfield: Starfield,
};
