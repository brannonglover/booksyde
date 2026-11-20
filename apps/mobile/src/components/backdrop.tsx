import { mixHex, palette } from '@booksyde/theme';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/*
 * The scene drawn behind a featured book, as on the web home page
 * (apps/web/src/components/backdrop). A genre motif when the book's tags call
 * for one; otherwise its cover, blurred, over its cloth colour.
 */

export const motifs = ['gothic', 'mystery', 'fantasy', 'romance', 'starfield'] as const;
export type Motif = (typeof motifs)[number];

export type BackdropTag = { slug: string; kind: string; votes: number };
export type BackdropWork = {
  title: string;
  cover_url: string | null;
  cover_color: string | null;
  /** works.backdrop_style; null means auto. */
  backdrop_style?: string | null;
  tags: BackdropTag[];
};

/** Which tags call for which motif. Genres are checked before moods. */
const motifByTag: Record<string, Motif> = {
  horror: 'gothic',
  gothic: 'gothic',
  dark: 'gothic',
  mystery: 'mystery',
  thriller: 'mystery',
  mysterious: 'mystery',
  tense: 'mystery',
  fantasy: 'fantasy',
  adventurous: 'fantasy',
  romance: 'romance',
  'science-fiction': 'starfield',
};

/** The motif for a book's strongest matching tag: genres first, then moods, most votes first. */
export function motifFor(tags: BackdropTag[]): Motif | null {
  const ranked = [...tags].sort((a, b) => Number(b.kind === 'genre') - Number(a.kind === 'genre') || b.votes - a.votes);
  for (const tag of ranked) if (Object.hasOwn(motifByTag, tag.slug)) return motifByTag[tag.slug];
  return null;
}

function resolveMotif(work: BackdropWork) {
  return work.backdrop_style === 'cover' ? null : motifFor(work.tags);
}

/** The featured-book stage: a rounded 4:5 panel with the backdrop behind and the cover on top. */
export function BackdropStage({ work, cover }: { work: BackdropWork; cover: ReactNode }) {
  const motif = resolveMotif(work);
  return (
    <View style={styles.stage}>
      {motif ? <MotifArt motif={motif} tint={work.cover_color} /> : <BlurredCover work={work} />}
      <View style={styles.cover}>{cover}</View>
    </View>
  );
}

function BlurredCover({ work }: { work: BackdropWork }) {
  const cloth = mixHex(work.cover_color ?? palette.green, palette.ink, 0.35);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cloth }]}>
      {work.cover_url ? (
        <Image source={work.cover_url} blurRadius={40} contentFit="cover" style={styles.blur} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(31,27,22,0.2)' }]} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 500" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="55%" rx="70%" ry="55%">
            <Stop offset="0" stopColor="#1F1B16" stopOpacity="0" />
            <Stop offset="1" stopColor="#1F1B16" stopOpacity="0.35" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="500" fill="url(#vignette)" />
      </Svg>
    </View>
  );
}

/** Leans a motif's base colour toward the cover colour, just enough to tie them together. */
const lean = (base: string, tint: string | null | undefined, amount = 0.18) => (tint ? mixHex(base, tint, amount) : base);

/** Deterministic scatter, so every render draws the same stars, rain and petals. */
function scatter(count: number, seed: number) {
  let s = seed;
  const next = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, () => ({ x: next() * 400, y: next() * 500, r: next() }));
}

const RAIN = scatter(46, 7);
const STARS = scatter(90, 11);
const PETALS = scatter(26, 23).filter((p) => p.x < 110 || p.x > 290 || p.y < 110 || p.y > 430);

function MotifArt({ motif, tint }: { motif: Motif; tint?: string | null }) {
  const Scene = scenes[motif];
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
      <Scene tint={tint} />
    </Svg>
  );
}

type SceneProps = { tint?: string | null };

function Gothic({ tint }: SceneProps) {
  const sky = lean('#2A2238', tint);
  const ground = mixHex(sky, '#000000', 0.55);
  return (
    <G>
      <Rect width="400" height="500" fill={sky} />
      <Circle cx="318" cy="92" r="70" fill="#E4DCC8" opacity={0.06} />
      <Circle cx="318" cy="92" r="34" fill="#E4DCC8" opacity={0.92} />
      <Path d="M236 18 l-22 58 h18 l-26 62" fill="none" stroke="#EDE6F7" strokeWidth={2.5} opacity={0.7} />
      <G stroke="#B7AED0" strokeWidth={1.2} strokeLinecap="round" opacity={0.35}>
        {RAIN.map((d, i) => (
          <Path key={i} d={`M${d.x} ${d.y} l-7 ${22 + d.r * 14}`} />
        ))}
      </G>
      <Path
        d="M0 500V398h30v-22h16v22h20V338h12l8-28 8 28h12v60h40v-34h14v-14h14v14h14v34h50V326h12l10-32 10 32h12v72h40v-30h20v-20h20v50h48V500Z"
        fill={ground}
      />
      <G fill="#E8C878" opacity={0.85}>
        <Rect x="83" y="352" width="6" height="10" rx="3" />
        <Rect x="263" y="344" width="6" height="10" rx="3" />
        <Rect x="263" y="372" width="6" height="10" rx="3" />
      </G>
    </G>
  );
}

function Mystery({ tint }: SceneProps) {
  const base = lean('#3B4440', tint);
  const dark = mixHex(base, '#000000', 0.5);
  return (
    <G>
      <Rect width="400" height="500" fill={base} />
      {/* Rooftops and chimneys in the distance */}
      <Path d="M0 330V280h40v-30h12v30h50l20-24 20 24h70v-40h10v-14h10v54h60l26-30 26 30h56v50Z" fill={dark} opacity={0.45} />
      {/* Gas lamp */}
      <Circle cx="58" cy="118" r="48" fill="#E8C878" opacity={0.12} />
      <Circle cx="58" cy="118" r="22" fill="#E8C878" opacity={0.18} />
      <Rect x="54" y="132" width="8" height="368" fill={dark} />
      <Path d="M38 132h40l-6-30H44Z" fill={dark} />
      <Rect x="46" y="106" width="24" height="24" fill="#E8C878" />
      <Path d="M40 102h36l-18-14Z" fill={dark} />
      {/* Fog */}
      <G fill="#D7DED8">
        <Rect x="-40" y="300" width="300" height="34" rx="17" opacity={0.13} />
        <Rect x="140" y="352" width="320" height="38" rx="19" opacity={0.13} />
        <Rect x="-60" y="410" width="280" height="34" rx="17" opacity={0.15} />
        <Rect x="200" y="452" width="260" height="30" rx="15" opacity={0.12} />
      </G>
      {/* Footprints leading away */}
      <G fill={dark} opacity={0.8}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const cx = 318 + (i % 2 ? 14 : 0) + i * 6;
          const cy = 488 - i * 26;
          return <Ellipse key={i} cx={cx} cy={cy} rx="6" ry="9" transform={`rotate(${20 + i * 2} ${cx} ${cy})`} />;
        })}
      </G>
    </G>
  );
}

function Fantasy({ tint }: SceneProps) {
  const parchment = lean('#E6D6B0', tint, 0.1);
  const ink = '#6E5230';
  return (
    <G>
      <Rect width="400" height="500" fill={parchment} />
      <G stroke={ink} strokeWidth={0.6} opacity={0.15}>
        {[50, 100, 150, 200, 250, 300, 350].map((x) => (
          <Path key={`v${x}`} d={`M${x} 0V500`} />
        ))}
        {[60, 120, 180, 240, 300, 360, 420, 480].map((y) => (
          <Path key={`h${y}`} d={`M0 ${y}H400`} />
        ))}
      </G>
      {/* Mountains */}
      <G fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" opacity={0.75}>
        <Path d="M236 86l22-36 22 36M268 86l26-44 26 44M308 86l20-30 20 30M340 86l18-26 18 26" />
        <Path d="M262 62l-6 10M296 54l-6 12" strokeWidth={1.2} />
      </G>
      {/* Forest */}
      <G fill="#5F7A3A" opacity={0.6}>
        {[
          [40, 120],
          [58, 110],
          [72, 126],
          [30, 140],
          [54, 142],
          [80, 150],
        ].map(([x, y]) => (
          <Path key={`${x}-${y}`} d={`M${x} ${y - 16}l10 18h-20Z`} />
        ))}
      </G>
      {/* River and coast */}
      <Path d="M0 236c40-10 60 20 96 8s50-30 70-20" fill="none" stroke="#5E8AA0" strokeWidth={2.5} opacity={0.55} />
      <Path d="M0 470c30-8 50 6 80-4s46-18 70-10" fill="none" stroke={ink} strokeWidth={1.5} opacity={0.5} />
      {/* The road there and back again */}
      <Path
        d="M46 452C90 400 70 330 110 290S210 210 252 160 300 110 300 96"
        fill="none"
        stroke="#9A2A20"
        strokeWidth={2.5}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <Path d="M292 88l16 16M308 88l-16 16" stroke="#9A2A20" strokeWidth={3} strokeLinecap="round" />
      {/* Compass rose */}
      <G transform="translate(336 420)" stroke={ink} fill="none" strokeWidth={1.2} opacity={0.8}>
        <Circle r="30" />
        <Circle r="22" opacity={0.5} />
        <Path d="M0-44 6-6 0 0-6-6ZM0 44 6 6 0 0-6 6ZM-44 0-6-6 0 0-6 6ZM44 0 6-6 0 0 6 6Z" fill={ink} fillOpacity={0.25} />
      </G>
    </G>
  );
}

const rose = '#B0565A';
const leaf = '#6F8B5E';

function Rose({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Ellipse cx="-16" cy="12" rx="14" ry="6" fill={leaf} transform="rotate(-30 -16 12)" />
      <Ellipse cx="16" cy="14" rx="14" ry="6" fill={leaf} transform="rotate(30 16 14)" />
      <Circle r="16" fill={rose} />
      <Circle r="11" fill={mixHex(rose, '#5A1E22', 0.25)} />
      <Path d="M-6-2a7 7 0 0 1 12 0a5 5 0 0 1-8 4" fill="none" stroke={mixHex(rose, '#FFFFFF', 0.3)} strokeWidth={1.6} />
    </G>
  );
}

function Romance({ tint }: SceneProps) {
  const base = lean('#EBD5CD', tint, 0.12);
  return (
    <G>
      <Rect width="400" height="500" fill={base} />
      {/* Climbing vine down each side */}
      <G fill="none" stroke={leaf} strokeWidth={2} opacity={0.7}>
        <Path d="M30 500C50 420 10 360 40 290S20 160 60 80 40 20 70 0" />
        <Path d="M370 500C350 430 390 370 362 300S384 170 344 96 362 24 332 0" />
      </G>
      <G fill={leaf} opacity={0.7}>
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
          <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx="11" ry="5" transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </G>
      <Rose x={46} y={70} s={1.3} />
      <Rose x={354} y={460} s={1.4} />
      <Rose x={36} y={372} />
      <Rose x={364} y={190} s={0.9} />
      <G fill={rose} opacity={0.45}>
        {PETALS.map((p, i) => (
          <Ellipse
            key={i}
            cx={p.x}
            cy={p.y}
            rx={4 + p.r * 4}
            ry={2.5 + p.r * 2}
            transform={`rotate(${p.r * 180} ${p.x} ${p.y})`}
          />
        ))}
      </G>
    </G>
  );
}

function Starfield({ tint }: SceneProps) {
  const space = lean('#141C30', tint, 0.15);
  return (
    <G>
      <Rect width="400" height="500" fill={space} />
      <G fill="#EAF0FF">
        {STARS.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={0.6 + s.r * 1.6} opacity={0.35 + s.r * 0.6} />
        ))}
      </G>
      {/* Orbits */}
      <G fill="none" stroke="#8FA8D8" strokeWidth={1} opacity={0.3}>
        <Ellipse cx="200" cy="260" rx="190" ry="70" transform="rotate(-18 200 260)" strokeDasharray="3 6" />
        <Ellipse cx="200" cy="260" rx="250" ry="110" transform="rotate(-18 200 260)" />
      </G>
      {/* Ringed planet */}
      <G transform="translate(78 96)">
        <Circle r="38" fill="#C27A55" />
        <Path d="M-38 0a38 38 0 0 0 76 0" fill="#000000" opacity={0.22} />
        <Ellipse rx="62" ry="13" fill="none" stroke="#E8C878" strokeWidth={3} opacity={0.85} transform="rotate(-16)" />
      </G>
      {/* Small moon and a comet */}
      <Circle cx="340" cy="420" r="14" fill="#8FA8D8" />
      <Path d="M300 70l70-26" stroke="#EAF0FF" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <Circle cx="300" cy="70" r="3.5" fill="#FFFFFF" />
    </G>
  );
}

const scenes: Record<Motif, (props: SceneProps) => React.ReactNode> = {
  gothic: Gothic,
  mystery: Mystery,
  fantasy: Fantasy,
  romance: Romance,
  starfield: Starfield,
};

const styles = StyleSheet.create({
  stage: {
    aspectRatio: 4 / 5,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: palette.green,
  },
  // Scaled past the edges: a blur fades the image's own borders.
  blur: { position: 'absolute', top: '-30%', left: '-30%', width: '160%', height: '160%' },
  cover: { transform: [{ rotate: '-2deg' }] },
});
