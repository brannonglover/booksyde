/** The canonical public address: what search engines should index and link to. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.booksyde.co").replace(/\/$/, "");

/** Only production gets indexed; previews and local dev tell crawlers to stay out. */
export const isProduction = process.env.VERCEL_ENV === "production";
