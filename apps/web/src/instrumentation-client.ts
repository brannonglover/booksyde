import posthog from "posthog-js";
import { analyticsEnabled, POSTHOG_HOST, POSTHOG_KEY } from "@/lib/analytics";

// Runs before the app hydrates (Next's client instrumentation hook).
if (analyticsEnabled) {
  try {
    posthog.init(POSTHOG_KEY, {
      // Proxied through our own domain so ad blockers don't drop events (rewrites in next.config.ts).
      api_host: "/ingest",
      ui_host: POSTHOG_HOST.replace(".i.posthog.com", ".posthog.com"),
      // Current recommended defaults, including a $pageview on every client-side navigation.
      defaults: "2026-08-30",
      // Only readers who sign in become PostHog persons; anonymous visits stay cheap.
      person_profiles: "identified_only",
    });
  } catch (error) {
    console.error("[analytics] PostHog failed to start", error);
  }
}
