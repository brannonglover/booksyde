/**
 * Product analytics (PostHog). Every event Booksyde sends is named here, so the
 * PostHog dashboard and the code agree on spelling.
 *
 * Analytics is off unless NEXT_PUBLIC_POSTHOG_KEY is set, so local dev and
 * previews without a key send nothing.
 */
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
/** The PostHog region the /ingest proxy forwards to (see next.config.ts). */
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
export const analyticsEnabled = POSTHOG_KEY !== "";

export const AnalyticsEvent = {
  /** Server-side, once a password or email-link sign-in succeeds. */
  SignedIn: "signed_in",
  /** Server-side, when a new account gets its first session. */
  SignedUp: "signed_up",
  JoinFreeClicked: "join_free_clicked",
  DiscoverClicked: "discover_clicked",
  ClubsClicked: "clubs_clicked",
  MoodChipClicked: "mood_chip_clicked",
  /** A search the reader settled on (not every keystroke). */
  SearchPerformed: "search_performed",
  /** A book put on a shelf, or moved between shelves (want to read → reading → read). */
  BookShelved: "book_shelved",
  BookUnshelved: "book_unshelved",
  /** Following a reader (a request, for a private profile). */
  ReaderFollowed: "reader_followed",
  /** Server-side, once a new club exists. */
  ClubCreated: "club_created",
  /** Server-side, per batch of a Goodreads import (a big library arrives in several). */
  GoodreadsBatchImported: "goodreads_batch_imported",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/**
 * Props for a link or button whose clicks should be tracked. Works in server
 * components: the click listener in components/analytics.tsx picks them up.
 *
 *   <Link href="/discover" {...track("discover_clicked", { location: "header" })}>
 *
 * becomes `data-track="discover_clicked" data-track-location="header"`.
 */
export function track(event: AnalyticsEventName, props: Record<string, string | number> = {}) {
  const attrs: Record<string, string> = { "data-track": event };
  for (const [key, value] of Object.entries(props)) attrs[`data-track-${key.replace(/_/g, "-")}`] = String(value);
  return attrs;
}
