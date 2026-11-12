/**
 * Booksyde design tokens — the single source of truth for colour, type,
 * spacing and shape. Plain values only (no CSS, no React Native) so both
 * apps/web and apps/mobile can consume them.
 */

export const palette = {
  grape: "#7C3AED",
  grapeSoft: "#EDE4FF",
  coral: "#FF6B6B",
  coralSoft: "#FFE3E0",
  sunshine: "#FFC53D",
  sunshineSoft: "#FFF3D1",
  mint: "#2EC4B6",
  mintSoft: "#D8F6F3",
  sky: "#3A86FF",
  skySoft: "#DDEAFF",
  bubblegum: "#FF5FA2",
  ink: "#1A1033",
  paper: "#FFF8F0",
  white: "#FFFFFF",
} as const;

export type SchemeColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  accent: string;
  highlight: string;
  success: string;
  danger: string;
};

export const colors: { light: SchemeColors; dark: SchemeColors } = {
  light: {
    background: palette.paper,
    surface: palette.white,
    surfaceRaised: "#FFFDF9",
    text: palette.ink,
    textMuted: "#6B6385",
    border: "#EDE6DC",
    primary: palette.grape,
    primaryText: palette.white,
    accent: palette.coral,
    highlight: palette.sunshine,
    success: palette.mint,
    danger: "#E5484D",
  },
  dark: {
    background: "#140F24",
    surface: "#211A38",
    surfaceRaised: "#2B2347",
    text: "#F6F1FF",
    textMuted: "#B3A9CF",
    border: "#3A3159",
    primary: "#A67CFF",
    primaryText: palette.ink,
    accent: "#FF8A8A",
    highlight: palette.sunshine,
    success: "#5EE3D6",
    danger: "#FF6B70",
  },
};

/** Each genre gets its own colour, used for chips, shelf headers and tags. */
export const genreColors = {
  fantasy: { bg: "#EDE4FF", fg: "#5B21B6" },
  romance: { bg: "#FFE3E0", fg: "#C2410C" },
  thriller: { bg: "#FFE0E3", fg: "#9F1239" },
  mystery: { bg: "#E2E8F0", fg: "#1E293B" },
  "science-fiction": { bg: "#DDEAFF", fg: "#1D4ED8" },
  horror: { bg: "#E9E3F5", fg: "#3B0764" },
  "literary-fiction": { bg: "#FFF3D1", fg: "#92400E" },
  "historical-fiction": { bg: "#F3E8D8", fg: "#7C4A1E" },
  "non-fiction": { bg: "#D8F6F3", fg: "#0F766E" },
  biography: { bg: "#E6F4EA", fg: "#166534" },
  "young-adult": { bg: "#FFE4F1", fg: "#BE185D" },
  poetry: { bg: "#F5E8FF", fg: "#86198F" },
  default: { bg: "#F1EDF7", fg: "#4C4466" },
} as const;

export type GenreKey = keyof typeof genreColors;

export function genreColor(slug: string) {
  return Object.hasOwn(genreColors, slug) ? genreColors[slug as GenreKey] : genreColors.default;
}

export const fonts = {
  /** Loud, rounded display face for headings and the wordmark. */
  display: "Bricolage Grotesque",
  /** Friendly UI/body face. */
  body: "Plus Jakarta Sans",
  /** Bookish serif for quotes and review excerpts. */
  serif: "Fraunces",
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
  "4xl": 48,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Blend two #RRGGBB colours; amount 0 → a, 1 → b. Handy for gradients that fade into the page. */
export function mixHex(a: string, b: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

/**
 * Serialises the colour tokens as CSS custom properties for the web app.
 * Light values go on :root, dark values inside a prefers-color-scheme block.
 */
export function toCssVariables(): string {
  const toVars = (scheme: SchemeColors) =>
    Object.entries(scheme)
      .map(([k, v]) => `--bk-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`)
      .join(" ");
  const paletteVars = Object.entries(palette)
    .map(([k, v]) => `--bk-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`)
    .join(" ");
  return [
    `:root { ${paletteVars} ${toVars(colors.light)} }`,
    `@media (prefers-color-scheme: dark) { :root { ${toVars(colors.dark)} } }`,
  ].join("\n");
}
