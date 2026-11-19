"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { AnalyticsEvent, type AnalyticsEventName } from "@/lib/analytics";

/**
 * Whether PostHog started in this browser: it only does on the live site, with
 * a key, and not after `?notrack` (see instrumentation-client.ts).
 */
const tracking = () => posthog.__loaded;

/** Records an event from a client component (no-op when not tracking). */
export function captureEvent(event: AnalyticsEventName, properties: Record<string, unknown> = {}) {
  if (tracking()) posthog.capture(event, properties);
}

/**
 * One document-level listener for every element tagged with `track(...)` from
 * lib/analytics.ts, so server-rendered links can be tracked without becoming
 * client components.
 */
export function TrackClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!tracking()) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      const event = el?.dataset.track;
      if (!el || !event) return;
      const props: Record<string, string> = {};
      for (const [key, value] of Object.entries(el.dataset)) {
        // dataset turns data-track-mood-kind into trackMoodKind; send it as mood_kind.
        if (key === "track" || !key.startsWith("track") || value === undefined) continue;
        props[key.slice(5).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "")] = value;
      }
      posthog.capture(event, props);
    };
    // Capture phase, so it still runs if a handler further down stops propagation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

/**
 * Ties this browser to the signed-in reader (and forgets them on sign-out), so
 * anonymous browsing before sign-in joins their profile.
 */
export function IdentifyReader({ userId, username, email }: { userId: string | null; username?: string; email?: string }) {
  useEffect(() => {
    if (!tracking()) return;
    if (userId) {
      // Also re-run for an already-identified reader: PostHog then just updates their
      // properties (skipping repeats), so email reaches people identified before it was sent.
      // Email lets PostHog's internal-user filter leave the team's own accounts out.
      posthog.identify(userId, { username, ...(email ? { email } : {}) });
    } else if (posthog._isIdentified()) {
      posthog.reset();
    }
  }, [userId, username, email]);
  return null;
}

/**
 * Records a search once the reader stops typing. Rendered with the results, so
 * it covers every way in: the search page box, the home page form, and links.
 */
export function TrackSearch({ query, tags, books, authors, readers }: { query: string; tags: string[]; books: number; authors: number; readers: number }) {
  const tagKey = tags.join(",");
  useEffect(() => {
    if (!tracking()) return;
    // Results follow keystrokes; wait for a pause so "har", "harr", "harry" count once.
    const timer = setTimeout(() => {
      posthog.capture(AnalyticsEvent.SearchPerformed, {
        query,
        query_length: query.length,
        tags: tagKey ? tagKey.split(",") : [],
        book_results: books,
        author_results: authors,
        reader_results: readers,
        no_results: books + authors + readers === 0,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [query, tagKey, books, authors, readers]);
  return null;
}
