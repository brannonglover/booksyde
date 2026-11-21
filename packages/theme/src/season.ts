import type { SchemeColors } from "./index";

/**
 * Seasonal dressing that comes back every year. Both apps decide the season
 * from the reader's own clock, so it starts at midnight wherever they are, and
 * the layout never changes.
 *
 * - Thanksgiving, all of November: harvest colours (rust, amber, cinnamon) and
 *   autumn leaves on the logo, the ornaments and a strip under the header.
 * - Christmas, all of December: holly on the logo and ornaments, a holly-red
 *   accent, an evergreen garland, today's pick gift-wrapped, and December's
 *   bestseller-and-Christmas-book pair on the home page.
 */

export type Season = "thanksgiving" | "christmas";

export const SEASONS: readonly Season[] = ["thanksgiving", "christmas"];

/** The season on a given day: Thanksgiving through November, Christmas through December. */
export function seasonOn(date: Date = new Date()): Season | null {
  const month = date.getMonth();
  return month === 10 ? "thanksgiving" : month === 11 ? "christmas" : null;
}

/** Accepts a season's name or "off" to force it (for previewing); anything else means follow the calendar. */
export function resolveSeason(override: string | null | undefined, date: Date = new Date()): Season | null {
  if (override === "off") return null;
  if (SEASONS.includes(override as Season)) return override as Season;
  return seasonOn(date);
}

export const thanksgiving = {
  kicker: "Thankful for good books · Happy Thanksgiving",
  /** The hero headline, with its italic accent word. */
  headline: { before: "Settle in with a book to be", accent: "thankful", after: "for." },
  greeting: "Happy Thanksgiving & happy reading.",
  quote: {
    text: "Every leaf speaks bliss to me, fluttering from the autumn tree.",
    author: "Emily Brontë",
    work: "Fall, Leaves, Fall",
  },
  /** The logo's full stop: a fallen-leaf rust. */
  rust: "#B4532A",
  /** Autumn leaf colours: rust, amber, cinnamon, gold and olive. */
  leaves: ["#B4532A", "#C4862C", "#8A3B1E", "#D9A441", "#7C7A35"],
} as const;

/** November's palette: harvest colours throughout, warmer paper and walnut. */
export const thanksgivingColors: { light: Partial<SchemeColors>; dark: Partial<SchemeColors> } = {
  light: {
    background: "#F4E9D8",
    surface: "#FBF4E8",
    surfaceRaised: "#FFFAF1",
    border: "#E2CDB0",
    primary: "#7A3B1E",
    primaryText: "#FBF4E8",
    accent: "#B4532A",
    highlight: "#C4862C",
  },
  dark: {
    background: "#2D231B",
    surface: "#372B21",
    surfaceRaised: "#413328",
    border: "#54412F",
    primary: "#EDB98A",
    primaryText: "#2A1E15",
    accent: "#F09A62",
    highlight: "#E9B562",
  },
};

/**
 * Leaf artwork (viewBox 0 0 24 24), stem at the bottom: a maple leaf and a
 * plain oval leaf with its midrib. Plain path data so web and mobile draw the same leaves.
 */
export const leafArt = {
  viewBox: "0 0 24 24",
  maple:
    "M12 1.5 13.6 4.9 15.8 3.9 15.4 7.5 18.4 5.7 17.8 8.3 21 8.9 18.4 11.5 19.8 12.7 15.2 13.9 15.8 15.9 12.6 15.2 12.6 22 11.4 22 11.4 15.2 8.2 15.9 8.8 13.9 4.2 12.7 5.6 11.5 3 8.9 6.2 8.3 5.6 5.7 8.6 7.5 8.2 3.9 10.4 4.9Z",
  oval: "M12 2C6.8 7 6.2 13.4 11.4 18.4V22h1.2v-3.6C17.8 13.4 17.2 7 12 2Z",
  /** The oval leaf's midrib, drawn over it in a darker shade. */
  ovalVein: "M12 5.5V18",
} as const;

export const christmas = {
  kicker: "Season’s readings · Happy holidays from Booksyde",
  /** The hero headline, with its italic accent word. */
  headline: { before: "Curl up with a", accent: "Christmas", after: "favorite." },
  greeting: "Merry Christmas & happy reading.",
  quote: {
    text: "I will honour Christmas in my heart, and try to keep it all the year.",
    author: "Charles Dickens",
    work: "A Christmas Carol",
  },
  /** Holly leaves in gilt, berries in a deep winter red: the same in light and dark. */
  berry: "#A23B2C",
  /** Gift ribbon: satin red, a shade for the folds. */
  ribbon: "#A8302B",
  ribbonShade: "#741E1B",
} as const;

/** December's palette: the accent turns holly red. */
export const christmasColors: { light: Partial<SchemeColors>; dark: Partial<SchemeColors> } = {
  light: { accent: "#A3262A" },
  dark: { accent: "#EC7B6E" },
};

/**
 * Holly sprig artwork (viewBox 0 0 28 16): two scalloped leaves meeting at a
 * stem, and three berries. Plain path data so web and mobile draw the same sprig.
 */
export const hollyArt = {
  viewBox: "0 0 28 16",
  leaves: [
    "M14 9C12.6 6.6 11.4 5.4 9.6 5.3L9.2 3.4 7.6 4.9C6.4 4.4 5.3 4.4 4.2 4.9L3.2 3.2 2.4 5.6C1.6 6 1 6.6.6 7.4 2.4 7.4 3.4 8.2 3.9 9.4L2.9 11 5.4 10.7C6.6 11.4 7.8 11.4 8.9 10.9L9.6 12.5 10.8 10.6C12 10.2 13 9.7 14 9Z",
    "M14 9C15.4 6.6 16.6 5.4 18.4 5.3L18.8 3.4 20.4 4.9C21.6 4.4 22.7 4.4 23.8 4.9L24.8 3.2 25.6 5.6C26.4 6 27 6.6 27.4 7.4 25.6 7.4 24.6 8.2 24.1 9.4L25.1 11 22.6 10.7C21.4 11.4 20.2 11.4 19.1 10.9L18.4 12.5 17.2 10.6C16 10.2 15 9.7 14 9Z",
  ],
  berries: [
    { cx: 12.2, cy: 10.6, r: 1.9 },
    { cx: 15.8, cy: 10.6, r: 1.9 },
    { cx: 14, cy: 7.9, r: 1.9 },
  ],
} as const;

/**
 * A satin gift bow (viewBox 0 0 100 72), tied where the ribbon crosses the top
 * of the hero's book. `fill` parts take christmas.ribbon, `shade` parts ribbonShade.
 */
export const bowArt = {
  viewBox: "0 0 100 72",
  /** The two loops, then the two tails. */
  fill: [
    "M50 31C40 12 22 4 9 9 1 13 2 28 12 34 24 40 40 37 50 31Z",
    "M50 31C60 12 78 4 91 9 99 13 98 28 88 34 76 40 60 37 50 31Z",
    "M46 33 35 70 42 64 49 71 51 35Z",
    "M54 33 65 70 58 64 51 71 49 35Z",
  ],
  /** The insides of the loops, in shadow. */
  shade: ["M48 30C38 19 24 14 16 17 12 20 14 27 21 29 30 32 40 32 48 30Z", "M52 30C62 19 76 14 84 17 88 20 86 27 79 29 70 32 60 32 52 30Z"],
  knot: { cx: 50, cy: 31, rx: 7.5, ry: 8 },
} as const;

/** Each season's colour tokens, over the light and dark defaults. */
export const seasonColors: Record<Season, { light: Partial<SchemeColors>; dark: Partial<SchemeColors> }> = {
  thanksgiving: thanksgivingColors,
  christmas: christmasColors,
};

/** Each season's words (kicker, headline, greeting, quote), for code that picks by season. */
export const seasonCopy = { thanksgiving, christmas } satisfies Record<Season, unknown>;
