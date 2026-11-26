import { buildLetter, canBuildMonthlyPicks, adminClient, unsubscribePageUrl } from "@/lib/monthly-picks";
import { type PickReason, renderMonthlyPicks, upcomingIssue } from "@/lib/monthly-picks-email";
import { siteUrl } from "@/lib/site";

/*
 * Development only: the monthly letter as a reader would get it, without
 * sending anything. /dev/monthly-picks?user=<username> for a real reader's
 * picks; without one, popular books dressed in every kind of reason.
 * &issue=2026-12 previews another month's dressing; &format=text the plain-text part.
 */

const REASONS: { reason: PickReason; context: string | null }[] = [
  { reason: "series", context: "The Stormlight Archive" },
  { reason: "new_release", context: "Emily Henry" },
  { reason: "want_to_read", context: null },
  { reason: "taste", context: "Piranesi" },
  { reason: "popular", context: null },
];

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  if (!canBuildMonthlyPicks) return new Response("SUPABASE_SECRET_KEY is not set", { status: 503 });
  const params = new URL(request.url).searchParams;
  const issue = params.get("issue") ?? upcomingIssue();
  const client = adminClient();

  let letter;
  const username = params.get("user");
  if (username) {
    const { data: profile } = await client.from("profiles").select("id, display_name, username").eq("username", username).maybeSingle();
    if (!profile) return new Response("No reader with that username", { status: 404 });
    letter = await buildLetter(
      client,
      { user_id: profile.id, display_name: profile.display_name, username: profile.username, unsubscribe_token: "00000000-0000-0000-0000-000000000000" },
      issue,
    );
    if (!letter) return new Response("Nothing to suggest for this reader yet", { status: 404 });
  } else {
    const { data: works, error } = await client
      .from("works")
      .select("id, title, description, cover_url, cover_color, work_contributors ( role, position, authors ( name ) )")
      .not("cover_url", "is", null)
      .order("shelved_count", { ascending: false })
      .limit(REASONS.length);
    if (error) throw error;
    letter = {
      issue,
      name: "Sam",
      reading: { title: "The Night Circus" },
      siteUrl,
      unsubscribeUrl: unsubscribePageUrl("00000000-0000-0000-0000-000000000000"),
      picks: (works ?? []).map((w, i) => ({
        id: w.id,
        title: w.title,
        author: w.work_contributors?.find((c) => c.role === "author")?.authors?.name ?? null,
        coverUrl: i === 3 ? null : w.cover_url,
        coverColor: w.cover_color,
        blurb: w.description,
        ...REASONS[i],
      })),
    };
  }

  const email = renderMonthlyPicks(letter);
  if (params.get("format") === "text") {
    return new Response(`Subject: ${email.subject}\n\n${email.text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
