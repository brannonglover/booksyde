/*
 * Builds (or rebuilds) the "Booksyde overview" dashboard in PostHog from the
 * events named in src/lib/analytics.ts. Safe to re-run: it replaces the
 * dashboard's charts instead of piling up copies.
 *
 *   npm run posthog:dashboard
 *
 * Reads from apps/web/.env.local:
 *   POSTHOG_PERSONAL_API_KEY  PostHog → Settings → Personal API keys, with
 *                             Project: Read, Dashboard: Write, Insight: Write
 *   NEXT_PUBLIC_POSTHOG_KEY   picks the project these events go to
 *   NEXT_PUBLIC_POSTHOG_HOST  optional; set it for the EU region
 */

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!apiKey || !projectToken) throw new Error("Set POSTHOG_PERSONAL_API_KEY and NEXT_PUBLIC_POSTHOG_KEY in apps/web/.env.local.");
// The app API lives on us.posthog.com / eu.posthog.com, not the us.i ingestion host.
const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com");
const DASHBOARD = "Booksyde overview";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${host}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

type Paged<T> = { results: T[] };

// --- Which project ----------------------------------------------------------
const projects = await api<Paged<{ id: number; name: string; api_token: string }>>("/api/projects/");
const project = projects.results.find((p) => p.api_token === projectToken);
if (!project) throw new Error("No project this API key can see matches NEXT_PUBLIC_POSTHOG_KEY.");
const base = `/api/projects/${project.id}`;
console.log(`Project: ${project.name} (${project.id})`);

// --- The dashboard (reuse it, clearing its old charts) ----------------------
const dashboards = await api<Paged<{ id: number; name: string; deleted?: boolean }>>(`${base}/dashboards/?limit=200`);
let dashboard = dashboards.results.find((d) => d.name === DASHBOARD && !d.deleted);
if (dashboard) {
  const old = await api<Paged<{ id: number }>>(`${base}/insights/?dashboards=[${dashboard.id}]&limit=200`);
  for (const insight of old.results) {
    await api(`${base}/insights/${insight.id}/`, { method: "PATCH", body: JSON.stringify({ deleted: true }) });
  }
  console.log(`Clearing ${old.results.length} old charts from "${DASHBOARD}"`);
} else {
  dashboard = await api(`${base}/dashboards/`, {
    method: "POST",
    body: JSON.stringify({
      name: DASHBOARD,
      description: "Visitors, sign-ups, and what readers do once they're in. Built by apps/web/scripts/posthog-dashboard.mts.",
      pinned: true,
    }),
  });
}

// --- Charts -----------------------------------------------------------------
const last30 = { date_from: "-30d" };
const event = (name: string, label: string, extra: Record<string, unknown> = {}) => ({ kind: "EventsNode", event: name, name: label, custom_name: label, ...extra });
const trends = (series: unknown[], extra: Record<string, unknown> = {}) => ({
  kind: "InsightVizNode",
  source: { kind: "TrendsQuery", series, interval: "day", dateRange: last30, ...extra },
});
const sql = (query: string) => ({ kind: "DataTableNode", source: { kind: "HogQLQuery", query } });

const charts: { name: string; description: string; query: unknown }[] = [
  {
    name: "Visitors and pageviews",
    description: "Unique visitors and total pageviews per day.",
    query: trends([event("$pageview", "Unique visitors", { math: "dau" }), event("$pageview", "Pageviews", { math: "total" })]),
  },
  {
    name: "Sign-ups and sign-ins",
    description: "New accounts and returning sign-ins per day.",
    query: trends([event("signed_up", "Sign-ups"), event("signed_in", "Sign-ins")], { trendsFilter: { display: "ActionsBar" } }),
  },
  {
    name: "Visit → sign up → first book shelved",
    description: "Of the people who visit, how many sign up and then put a book on a shelf within 14 days.",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "FunnelsQuery",
        series: [event("$pageview", "Visited"), event("signed_up", "Signed up"), event("book_shelved", "Shelved a book")],
        funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: "day", funnelVizType: "steps" },
        dateRange: last30,
      },
    },
  },
  {
    name: "Books shelved, by shelf",
    description: "Want to read, reading, read, did not finish.",
    query: trends([event("book_shelved", "Books shelved")], {
      interval: "week",
      breakdownFilter: { breakdown: "status", breakdown_type: "event" },
      trendsFilter: { display: "ActionsBar" },
    }),
  },
  {
    name: "Readers shelving books",
    description: "Unique readers who shelved at least one book each week.",
    query: trends([event("book_shelved", "Readers shelving", { math: "dau" })], { interval: "week", dateRange: { date_from: "-90d" } }),
  },
  {
    name: "Top searches",
    description: "What readers search for most in the last 30 days, and how often it found nothing.",
    query: sql(`SELECT lower(trim(properties.query)) AS search, count() AS searches, countIf(toString(properties.no_results) = 'true') AS found_nothing
FROM events
WHERE event = 'search_performed' AND timestamp > now() - INTERVAL 30 DAY AND properties.query != ''
GROUP BY search
ORDER BY searches DESC
LIMIT 25`),
  },
  {
    name: "Searches that found nothing",
    description: "Gaps in the catalogue: searches with zero books, authors or readers.",
    query: sql(`SELECT lower(trim(properties.query)) AS search, count() AS times
FROM events
WHERE event = 'search_performed' AND toString(properties.no_results) = 'true' AND timestamp > now() - INTERVAL 30 DAY
GROUP BY search
ORDER BY times DESC
LIMIT 25`),
  },
  {
    name: "Mood chips clicked",
    description: "Which moods and tropes pull readers in.",
    query: trends([event("mood_chip_clicked", "Clicks")], {
      breakdownFilter: { breakdown: "label", breakdown_type: "event" },
      trendsFilter: { display: "ActionsBarValue" },
    }),
  },
  {
    name: "Calls to action",
    description: "Join, Discover and Clubs clicks, by where on the page they happened.",
    query: trends(
      [event("join_free_clicked", "Join free"), event("discover_clicked", "Discover"), event("clubs_clicked", "Clubs")],
      { breakdownFilter: { breakdown: "location", breakdown_type: "event" }, trendsFilter: { display: "ActionsBarValue" } },
    ),
  },
  {
    name: "Community",
    description: "Follows, new clubs, and books brought over from Goodreads each week.",
    query: trends(
      [
        event("reader_followed", "Follows"),
        event("club_created", "Clubs started"),
        event("goodreads_batch_imported", "Goodreads books added", { math: "sum", math_property: "added" }),
      ],
      { interval: "week", dateRange: { date_from: "-90d" } },
    ),
  },
];

for (const chart of charts) {
  await api(`${base}/insights/`, { method: "POST", body: JSON.stringify({ ...chart, dashboards: [dashboard!.id] }) });
  console.log(`  + ${chart.name}`);
}
console.log(`\nDone: ${host}/project/${project.id}/dashboard/${dashboard!.id}`);
