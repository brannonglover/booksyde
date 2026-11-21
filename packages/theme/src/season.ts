import type { SchemeColors } from "./index";

/**
 * Seasonal dressing that comes back every year: a holly sprig on the logo and
 * in place of the fleuron, a holly-red accent, a ribbon rule, today's pick
 * gift-wrapped, and seasonal words. The layout never changes. Both apps decide
 * the season from the reader's own clock, so it starts at midnight wherever they are.
 */

export type Season = "christmas";

/** The season on a given day: Christmas through all of December. */
export function seasonOn(date: Date = new Date()): Season | null {
  return date.getMonth() === 11 ? "christmas" : null;
}

/** Accepts "christmas" or "off" to force a season (for previewing), anything else means follow the calendar. */
export function resolveSeason(override: string | null | undefined, date: Date = new Date()): Season | null {
  if (override === "christmas") return "christmas";
  if (override === "off") return null;
  return seasonOn(date);
}

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

/** Colour tokens that change through December: the accent turns holly red. */
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
