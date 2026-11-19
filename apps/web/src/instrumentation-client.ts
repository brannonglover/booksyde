import posthog from "posthog-js";
import { ANALYTICS_HOSTS, analyticsEnabled, NO_TRACK_PARAM, NO_TRACK_STORAGE_KEY, POSTHOG_HOST, POSTHOG_KEY } from "@/lib/analytics";

/** Live site only, and not in a browser that opted out with `?notrack` (see lib/analytics.ts). */
function shouldTrack() {
  if (!ANALYTICS_HOSTS.includes(window.location.hostname)) return false;
  const choice = new URLSearchParams(window.location.search).get(NO_TRACK_PARAM);
  try {
    if (choice === "off") localStorage.removeItem(NO_TRACK_STORAGE_KEY);
    else if (choice !== null) localStorage.setItem(NO_TRACK_STORAGE_KEY, "1");
    return localStorage.getItem(NO_TRACK_STORAGE_KEY) === null;
  } catch {
    // Storage blocked: the switch can't stick, but still honour it on this page.
    return choice === null || choice === "off";
  }
}

// Runs before the app hydrates (Next's client instrumentation hook).
// When PostHog isn't started, components/analytics.tsx sends nothing.
if (analyticsEnabled && shouldTrack()) {
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
