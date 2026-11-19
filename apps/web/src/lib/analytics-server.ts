import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { type AnalyticsEventName, analyticsEnabled, POSTHOG_HOST, POSTHOG_KEY } from "@/lib/analytics";

/**
 * Records an event from a server action or route handler, after the response
 * is sent so a redirect never waits on PostHog. `distinctId` is the Supabase
 * user id, the same id the browser identifies with (components/analytics.tsx),
 * so these join the reader's client-side events. `person` is saved on the
 * reader's PostHog profile (e.g. their email, for the internal-user filter).
 */
export function captureServerEvent(
  distinctId: string,
  event: AnalyticsEventName,
  properties: Record<string, unknown> = {},
  person?: Record<string, unknown>,
) {
  if (!analyticsEnabled) return;
  after(async () => {
    // Serverless functions can freeze between requests, so send right away and close.
    const client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushAt: 1, flushInterval: 0 });
    try {
      client.capture({
        distinctId,
        event,
        properties: { ...properties, $process_person_profile: true, ...(person ? { $set: person } : {}) },
      });
      await client.shutdown();
    } catch (error) {
      console.error(`[analytics] couldn't send ${event}`, error);
    }
  });
}
