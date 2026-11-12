/**
 * Booksyde design tokens — the single source of truth for colour, type,
 * spacing and shape. Plain values only (no CSS, no React Native) so both
 * apps/web and apps/mobile can consume them.
 */

/**
 * "Modern antiquarian": the colours of an old library, used with a modern,
 * flat, generous layout — vellum paper, iron-gall ink, bottle-green leather,
 * oxblood bindings and a touch of gilt.
 */
export const palette = {
  vellum: "#F3ECDF",
  paper: "#FAF6EE",
  ink: "#1F1B16",
  green: "#2D4A3E",
  greenSoft: "#DCE5DE",
  oxblood: "#8B3A2B",
  oxbloodSoft: "#F1DDD6",
  gilt: "#B8893A",
  giltSoft: "#F2E6CC",
  aubergine: "#5B3A5E",
  inkBlue: "#2F4A66",
  sage: "#6F8B5E",
  cream: "#FFFCF5",
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
  /** Reading room by day: vellum paper, ink type, green leather. */
  light: {
    background: palette.vellum,
    surface: palette.paper,
    surfaceRaised: palette.cream,
    text: palette.ink,
    textMuted: "#6F655A",
    border: "#DCD1BE",
    primary: palette.green,
    primaryText: palette.paper,
    accent: palette.oxblood,
    highlight: palette.gilt,
    success: palette.sage,
    danger: "#A8402F",
  },
  /** The study by lamplight: soft walnut brown (not black), parchment type, gilt details. */
  dark: {
    background: "#2A241F",
    surface: "#342D27",
    surfaceRaised: "#3D352E",
    text: "#F2E9DA",
    textMuted: "#BDAF9C",
    border: "#4A4038",
    primary: "#B3CDB8",
    primaryText: "#1F1B16",
    accent: "#E6957C",
    highlight: "#E0B872",
    success: "#A9C298",
    danger: "#E8907A",
  },
};

/**
 * Each genre and mood gets its own ink colour, used as a dot, rule or bar
 * beside its name. `bg`/`fg` are light tints for filled tags.
 */
export const genreColors = {
  fantasy: { dot: "#5B3A5E", bg: "#ECE2EC", fg: "#4A2E4D" },
  romance: { dot: "#B0565A", bg: "#F4E0DF", fg: "#86393D" },
  thriller: { dot: "#8B3A2B", bg: "#F1DDD6", fg: "#6E2B1F" },
  mystery: { dot: "#3A4552", bg: "#E2E5E8", fg: "#2C3540" },
  "science-fiction": { dot: "#2F4A66", bg: "#DFE6EE", fg: "#243A52" },
  horror: { dot: "#3D2A33", bg: "#E5DEE1", fg: "#3D2A33" },
  "literary-fiction": { dot: "#B8893A", bg: "#F2E6CC", fg: "#7A5A20" },
  "historical-fiction": { dot: "#7A5534", bg: "#EEE3D6", fg: "#5E4026" },
  "non-fiction": { dot: "#6F8B5E", bg: "#E3EADD", fg: "#4A6040" },
  biography: { dot: "#7D7A3E", bg: "#E9E8D6", fg: "#5A5829" },
  "young-adult": { dot: "#C27A55", bg: "#F5E4DA", fg: "#8A4E30" },
  poetry: { dot: "#2D4A3E", bg: "#DCE5DE", fg: "#2D4A3E" },
  classics: { dot: "#7A5534", bg: "#EEE3D6", fg: "#5E4026" },
  gothic: { dot: "#4A2E4D", bg: "#E5DEE1", fg: "#3D2A33" },
  // Moods: warm, readable on both the light and the dark background.
  cozy: { dot: "#C9874E", bg: "#F5E4DA", fg: "#8A4E30" },
  funny: { dot: "#D9A93F", bg: "#F6EBCF", fg: "#7A5A20" },
  dark: { dot: "#7B5A86", bg: "#E8E0EC", fg: "#4A2E4D" },
  tense: { dot: "#B5523F", bg: "#F1DDD6", fg: "#6E2B1F" },
  emotional: { dot: "#C46B78", bg: "#F4E0E3", fg: "#86393D" },
  hopeful: { dot: "#7FA06C", bg: "#E3EADD", fg: "#4A6040" },
  adventurous: { dot: "#4F7FA8", bg: "#DFE6EE", fg: "#243A52" },
  reflective: { dot: "#8A86B0", bg: "#E6E5EF", fg: "#4B4870" },
  mysterious: { dot: "#5E7C82", bg: "#DFE8E9", fg: "#33494D" },
  default: { dot: "#8A7F72", bg: "#ECE6DC", fg: "#5C534A" },
} as const;

export type GenreKey = keyof typeof genreColors;

export function genreColor(slug: string) {
  return Object.hasOwn(genreColors, slug) ? genreColors[slug as GenreKey] : genreColors.default;
}

export const fonts = {
  /** Editorial serif for headings and the wordmark: old-book character, modern proportions. */
  display: "Instrument Serif",
  /** Clean UI/body face. */
  body: "Plus Jakarta Sans",
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

/** Mostly crisp corners, like paper; pills for chips and buttons. */
export const radii = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 24,
  pill: 999,
} as const;

/** Blend two #RRGGBB colours; amount 0 → a, 1 → b. */
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

/** Open Library cover URL for a cover id (size S ≈ 45px, M ≈ 180px, L ≈ 500px wide). */
export function coverUrl(coverId: number, size: "S" | "M" | "L" = "L"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/** Light, dark, or follow the device. */
export type ThemePreference = "system" | "light" | "dark";

/**
 * Serialises the colour tokens as CSS custom properties for the web app.
 * Light values go on :root. Dark values apply when the device prefers dark
 * (unless the reader chose light), or when the reader chose dark — the choice
 * is stored as <html data-theme="light|dark">.
 */
export function toCssVariables(): string {
  const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const toVars = (obj: Record<string, string>) =>
    Object.entries(obj)
      .map(([k, v]) => `--bk-${kebab(k)}: ${v};`)
      .join(" ");
  const dark = `${toVars(colors.dark)} color-scheme: dark;`;
  return [
    `:root { ${toVars(palette)} ${toVars(colors.light)} color-scheme: light; }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
    `:root[data-theme="dark"] { ${dark} }`,
  ].join("\n");
}
