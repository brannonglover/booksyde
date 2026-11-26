import { christmas, colors, mixHex, palette, type Season, seasonColors, seasonOn, thanksgiving } from "@booksyde/theme";

/*
 * The monthly "next read" letter: the email itself, as HTML and plain text.
 * Pure (no database, no secrets), so the send job and the dev preview draw
 * exactly the same thing.
 *
 * Built like the Supabase auth emails in supabase/templates: nested tables
 * and inline styles (what mail apps understand), vellum page, paper card with
 * a green top rule, Instrument Serif headings over Plus Jakarta Sans. The
 * colours come from @booksyde/theme, dressed for the month the letter is for
 * (December's holly red, November's harvest rust), like the site.
 */

export type PickReason = "series" | "new_release" | "want_to_read" | "taste" | "popular";

export type PickBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverColor: string | null;
  /** A line or two from the description. */
  blurb: string | null;
  reason: PickReason;
  /** The series name, the author's name or the loved book's title (see monthly_picks()). */
  context: string | null;
};

export type MonthlyPicksLetter = {
  /** "2026-12": the month these ideas are for. */
  issue: string;
  /** What to call the reader, or null for a plain hello. */
  name: string | null;
  /** The book they have open now, if any: "once you've finished …". */
  reading: { title: string } | null;
  picks: PickBook[];
  siteUrl: string;
  unsubscribeUrl: string;
};

const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const SANS = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

/** "December" for "2026-12". */
export function issueMonth(issue: string): string {
  const [year, month] = issue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

/** The issue for the month after `date`: the letter goes out late in a month, for the next one. */
export function upcomingIssue(date: Date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function seasonFor(issue: string): Season | null {
  const [year, month] = issue.split("-").map(Number);
  return seasonOn(new Date(year, month - 1, 15));
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A sentence or two, never more than `max` characters, cut on a word. */
function shorten(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-–—]+$/, "")}…`;
}

/** The badge on each card and the line that says why. */
function why(pick: PickBook): { badge: string; line: string; tint: string; ink: string } {
  const c = pick.context;
  switch (pick.reason) {
    case "series":
      return { badge: "Next in the series", line: c ? `Next in ${c}` : "Next in a series you’re reading", tint: palette.greenSoft, ink: palette.green };
    case "new_release":
      return { badge: "New release", line: c ? `New from ${c}` : "New from an author you read", tint: palette.giltSoft, ink: "#7A5A1F" };
    case "want_to_read":
      return { badge: "On your list", line: "Waiting on your Want to Read shelf", tint: palette.oxbloodSoft, ink: palette.oxblood };
    case "taste":
      return { badge: "For your taste", line: c ? `Because you loved ${c}` : "Close to the books you love", tint: palette.greenSoft, ink: palette.inkBlue };
    case "popular":
      return { badge: "Reader favourite", line: "Popular with Booksyde readers right now", tint: palette.giltSoft, ink: "#7A5A1F" };
  }
}

function bookUrl(siteUrl: string, id: string): string {
  return `${siteUrl}/books/${id}?utm_source=email&utm_medium=monthly-picks`;
}

function httpsCover(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

function cover(pick: PickBook, width: number, scheme: typeof colors.light): string {
  const height = Math.round(width * 1.5);
  const src = httpsCover(pick.coverUrl);
  const byline = pick.author ? `${pick.title} by ${pick.author}` : pick.title;
  if (src) {
    return `<img class="bk-cover" src="${escape(src)}" width="${width}" height="${height}" alt="${escape(`Cover of ${byline}`)}" style="display:block;width:${width}px;height:${height}px;border:0;border-radius:3px;object-fit:cover;background:${scheme.border};">`;
  }
  // The site's typeset cover: the cloth colour, deepened so cream lettering reads.
  const cloth = mixHex(pick.coverColor ?? palette.green, palette.ink, 0.35);
  return `<table class="bk-cover" role="presentation" width="${width}" height="${height}" cellpadding="0" cellspacing="0" border="0" style="width:${width}px;height:${height}px;background:${cloth};border-radius:3px;"><tr><td align="center" valign="middle" style="padding:8px;font-family:${SERIF};font-size:${width > 100 ? 18 : 13}px;line-height:1.15;color:${palette.cream};">${escape(pick.title)}</td></tr></table>`;
}

/** One book as a card: the whole thing is the link. The first pick gets a bigger cover and the blurb. */
function card(pick: PickBook, lead: boolean, siteUrl: string, scheme: typeof colors.light): string {
  const href = escape(bookUrl(siteUrl, pick.id));
  const reason = why(pick);
  const width = lead ? 112 : 84;
  const blurb = pick.blurb ? shorten(pick.blurb, lead ? 220 : 140) : null;
  return `
<tr><td style="padding:0 0 14px;">
  <a href="${href}" style="display:block;text-decoration:none;color:${scheme.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${scheme.surfaceRaised};border:1px solid ${scheme.border};border-radius:10px;">
    <tr>
      <td class="bk-cover-cell" width="${width}" valign="top" style="padding:16px 0 16px 16px;width:${width}px;">${cover(pick, width, scheme)}</td>
      <td class="bk-card-text" valign="top" style="padding:16px 18px 16px 16px;font-family:${SANS};color:${scheme.text};">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${reason.tint};color:${reason.ink};white-space:nowrap;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${escape(reason.badge)}</span>
        <p class="${lead ? "bk-lead-title" : ""}" style="margin:10px 0 2px;font-family:${SERIF};font-size:${lead ? 28 : 22}px;line-height:1.1;color:${scheme.text};">${escape(pick.title)}</p>
        ${pick.author ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.4;color:${scheme.textMuted};">${escape(pick.author)}</p>` : ""}
        <p style="margin:0 0 ${blurb ? 8 : 12}px;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.35;color:${scheme.accent};">${escape(reason.line)}</p>
        ${blurb ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${scheme.text};">${escape(blurb)}</p>` : ""}
        <span style="font-size:14px;font-weight:700;color:${scheme.primary};">See the book &rarr;</span>
      </td>
    </tr>
  </table>
  </a>
</td></tr>`;
}

export function renderMonthlyPicks(letter: MonthlyPicksLetter): { subject: string; preheader: string; html: string; text: string } {
  const month = issueMonth(letter.issue);
  const season = seasonFor(letter.issue);
  const scheme = { ...colors.light, ...(season ? seasonColors[season].light : {}) };
  const stop = season === "thanksgiving" ? thanksgiving.rust : scheme.highlight;
  const greeting = season === "christmas" ? christmas.greeting : season === "thanksgiving" ? thanksgiving.greeting : "Happy reading from all of us at Booksyde.";

  const subject = `Your next read: ${letter.picks.length} ideas for ${month}`;
  const first = letter.picks[0];
  const preheader = first
    ? `${first.title}${first.author ? ` by ${first.author}` : ""}, and ${letter.picks.length - 1} more picked for you.`
    : `A few ideas for what to read in ${month}.`;
  const hello = letter.name ? `Hi ${letter.name},` : "Hello,";
  const intro = letter.reading
    ? `Once you’ve turned the last page of <em>${escape(letter.reading.title)}</em>, here are a few places to go next, picked from what you’ve read and loved.`
    : `A new month is nearly here. Here are a few ideas for your next book, picked from what you’ve read and loved.`;
  const introText = letter.reading
    ? `Once you've turned the last page of ${letter.reading.title}, here are a few places to go next, picked from what you've read and loved.`
    : `A new month is nearly here. Here are a few ideas for your next book, picked from what you've read and loved.`;
  const discover = `${letter.siteUrl}/discover?utm_source=email&utm_medium=monthly-picks`;
  const settings = `${letter.siteUrl}/settings/email`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  /* Phones: smaller covers so the words keep a readable column. Mail apps that drop <style> get the roomier desktop layout. */
  @media only screen and (max-width: 480px) {
    .bk-outer { padding: 24px 8px !important; }
    .bk-card { padding: 28px 16px 20px !important; }
    .bk-cover-cell { width: 68px !important; padding: 14px 0 14px 12px !important; }
    .bk-cover { width: 68px !important; height: 102px !important; }
    .bk-card-text { padding: 14px 14px 14px 12px !important; }
    .bk-lead-title { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${scheme.background};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${scheme.background};">
<tr><td class="bk-outer" align="center" style="padding:40px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:0 8px 20px;font-family:${SERIF};font-size:32px;line-height:1;color:${scheme.text};"><a href="${escape(letter.siteUrl)}" style="color:${scheme.text};text-decoration:none;">Booksyde<span style="color:${stop};">.</span></a></td></tr>
    <tr><td class="bk-card" style="background:${scheme.surface};border:1px solid ${scheme.border};border-top:4px solid ${scheme.primary};border-radius:8px;padding:36px 24px 24px;font-family:${SANS};color:${scheme.text};">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${scheme.accent};">Ideas for ${escape(month)}</p>
      <h1 style="margin:0 0 20px;font-family:${SERIF};font-weight:400;font-size:40px;line-height:1.05;color:${scheme.text};">Your next book, <em style="color:${scheme.accent};">picked for you</em>.</h1>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">${escape(hello)}</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${letter.picks.map((pick, i) => card(pick, i === 0, letter.siteUrl, scheme)).join("")}
      </table>
      <p style="margin:14px 0 18px;font-size:16px;line-height:1.6;">None of these quite right? There’s plenty more by mood, trope and pace.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:999px;background:${scheme.primary};">
        <a href="${escape(discover)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:${scheme.primaryText};text-decoration:none;border-radius:999px;">Discover more books</a>
      </td></tr></table>
      <hr style="border:0;border-top:1px solid ${scheme.border};margin:32px 0 18px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${scheme.textMuted};">You’re getting this monthly letter because you read with Booksyde. This address doesn’t take replies. <a href="${escape(settings)}" style="color:${palette.inkBlue};">Email settings</a> &middot; <a href="${escape(letter.unsubscribeUrl)}" style="color:${palette.inkBlue};">Unsubscribe</a></p>
    </td></tr>
    <tr><td align="center" style="padding:24px 8px 0;font-family:${SERIF};font-style:italic;font-size:16px;line-height:1.4;color:${scheme.textMuted};">${escape(greeting)}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `IDEAS FOR ${month.toUpperCase()}`,
    "Your next book, picked for you.",
    "",
    hello,
    "",
    introText,
    "",
    ...letter.picks.flatMap((pick) => [
      `* ${pick.title}${pick.author ? ` by ${pick.author}` : ""}`,
      `  ${why(pick).line}`,
      `  ${bookUrl(letter.siteUrl, pick.id)}`,
      "",
    ]),
    `Discover more books: ${discover}`,
    "",
    "--",
    "You're getting this monthly letter because you read with Booksyde. This address doesn't take replies.",
    `Email settings: ${settings}`,
    `Unsubscribe: ${letter.unsubscribeUrl}`,
  ].join("\n");

  return { subject, preheader, html, text };
}
