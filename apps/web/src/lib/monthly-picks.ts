import "server-only";

import { type BooksydeClient, createBooksydeClient } from "@booksyde/shared";
import { createHash } from "node:crypto";
import { type MonthlyPicksLetter, type PickBook, type PickReason, renderMonthlyPicks, upcomingIssue } from "./monthly-picks-email";
import { siteUrl } from "./site";
import { supabaseUrl } from "./supabase/env";

/*
 * The monthly "next read" letter (run by /api/cron/monthly-picks, late each
 * month): for every reader who wants it, a handful of ideas for their next
 * book from monthly_picks(), drawn by monthly-picks-email.ts and sent through
 * Resend.
 *
 * Readers are taken a batch at a time, and each one is marked with the issue
 * ("2026-12") once handled, so the job can stop at its time limit and the
 * next day's run carries on without sending anyone the same letter twice.
 */

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const resendKey = process.env.RESEND_API_KEY ?? "";
const from = process.env.MONTHLY_PICKS_FROM || "Booksyde <noreply@booksyde.co>";

export const canSendMonthlyPicks = Boolean(supabaseUrl && secretKey && resendKey);
export const canBuildMonthlyPicks = Boolean(supabaseUrl && secretKey);

/** Bypasses RLS: monthly_picks() and the recipient list are for the service role only. */
export function adminClient() {
  return createBooksydeClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Readers per batch (Resend's batch endpoint takes up to 100). */
const BATCH = 50;
const PICKS = 5;

type Recipient = {
  user_id: string;
  email: string;
  display_name: string | null;
  username: string;
  unsubscribe_token: string;
};

type Email = { to: string; subject: string; html: string; text: string; unsubscribeUrl: string };

/** The page a reader lands on from the letter's unsubscribe link. */
export const unsubscribePageUrl = (token: string) => `${siteUrl}/unsubscribe?token=${token}`;
/** Where a mail app's one-click unsubscribe button posts (RFC 8058). */
const oneClickUrl = (token: string) => `${siteUrl}/api/email/unsubscribe?token=${token}`;

/** First name only ("Hi Brannon,"); a generated username ("reader_3f9a…") is no way to greet anyone. */
function nameFor(r: Pick<Recipient, "display_name" | "username">): string | null {
  const first = r.display_name?.trim().split(/\s+/)[0];
  if (first) return first;
  return r.username.startsWith("reader_") ? null : r.username;
}

/** One reader's letter, or null when there's nothing to suggest. */
export async function buildLetter(
  client: BooksydeClient,
  reader: Pick<Recipient, "user_id" | "display_name" | "username" | "unsubscribe_token">,
  issue = upcomingIssue(),
): Promise<MonthlyPicksLetter | null> {
  const [picks, reading] = await Promise.all([
    client.rpc("monthly_picks", { target: reader.user_id, max_results: PICKS }),
    client
      .from("user_books")
      .select("works ( title )")
      .eq("user_id", reader.user_id)
      .eq("status", "reading")
      .order("position", { ascending: true, nullsFirst: true })
      .order("shelved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (picks.error) throw picks.error;
  if (reading.error) throw reading.error;
  const rows = picks.data ?? [];
  if (rows.length === 0) return null;

  const { data: works, error } = await client
    .from("works")
    .select("id, title, description, cover_url, cover_color, work_contributors ( role, position, authors ( name ) )")
    .in(
      "id",
      rows.map((r) => r.work_id),
    );
  if (error) throw error;
  const byId = new Map((works ?? []).map((w) => [w.id, w]));

  const books: PickBook[] = rows.flatMap((r) => {
    const w = byId.get(r.work_id);
    if (!w) return [];
    const author = (w.work_contributors ?? [])
      .filter((c) => c.role === "author" && c.authors)
      .sort((a, b) => a.position - b.position)[0]?.authors?.name;
    return [
      {
        id: w.id,
        title: w.title,
        author: author ?? null,
        coverUrl: w.cover_url,
        coverColor: w.cover_color,
        blurb: w.description,
        reason: r.reason as PickReason,
        context: r.context,
      },
    ];
  });
  if (books.length === 0) return null;

  return {
    issue,
    name: nameFor(reader),
    reading: reading.data?.works ? { title: reading.data.works.title } : null,
    picks: books,
    siteUrl,
    unsubscribeUrl: unsubscribePageUrl(reader.unsubscribe_token),
  };
}

/** Sends up to 100 emails in one call. Throws on anything but success. */
async function sendBatch(emails: Email[], idempotencyKey: string) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(
      emails.map((e) => ({
        from,
        to: [e.to],
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: {
          "List-Unsubscribe": `<${e.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })),
    ),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

function toEmail(recipient: Recipient, letter: MonthlyPicksLetter): Email {
  const { subject, html, text } = renderMonthlyPicks(letter);
  return { to: recipient.email, subject, html, text, unsubscribeUrl: oneClickUrl(recipient.unsubscribe_token) };
}

export type MonthlyPicksResult = { issue: string; sent: number; nothingToSuggest: number; remaining: boolean; error?: string };

/**
 * Sends this month's issue to everyone still waiting for it, until done or
 * `deadline` (ms since epoch) passes. `dryRun` builds every letter and marks
 * nothing.
 */
export async function sendMonthlyPicks({ deadline, dryRun = false }: { deadline: number; dryRun?: boolean }): Promise<MonthlyPicksResult> {
  const client = adminClient();
  const issue = upcomingIssue();
  const result: MonthlyPicksResult = { issue, sent: 0, nothingToSuggest: 0, remaining: false };
  // A dry run can't mark readers done, so it pages by hand instead.
  const seen = new Set<string>();

  while (true) {
    if (Date.now() > deadline) {
      result.remaining = true;
      break;
    }
    const { data, error } = await client.rpc("monthly_picks_recipients", { issue, max_results: BATCH + seen.size });
    if (error) throw error;
    const batch = (data ?? []).filter((r) => !seen.has(r.user_id)).slice(0, BATCH);
    if (batch.length === 0) break;

    const emails: Email[] = [];
    const handled: string[] = [];
    // Ten readers at a time: three small queries each.
    for (let i = 0; i < batch.length; i += 10) {
      const letters = await Promise.all(batch.slice(i, i + 10).map((r) => buildLetter(client, r, issue)));
      letters.forEach((letter, j) => {
        const recipient = batch[i + j];
        handled.push(recipient.user_id);
        if (letter) emails.push(toEmail(recipient, letter));
        else result.nothingToSuggest += 1;
      });
    }

    if (dryRun) {
      for (const id of handled) seen.add(id);
      result.sent += emails.length;
      continue;
    }
    if (emails.length > 0) {
      const key = createHash("sha256").update(`${issue}:${handled.join(",")}`).digest("hex");
      try {
        await sendBatch(emails, `monthly-picks-${key}`);
      } catch (e) {
        // Leave this batch unmarked so the next run tries it again.
        result.error = e instanceof Error ? e.message : String(e);
        result.remaining = true;
        break;
      }
    }
    const { error: markError } = await client
      .from("email_preferences")
      .update({ monthly_picks_issue: issue })
      .in("user_id", handled);
    if (markError) throw markError;
    result.sent += emails.length;
  }
  return result;
}

/** One reader's letter, sent now, whether or not they've had this issue (for trying it out). Marks nothing. */
export async function sendMonthlyPicksTo(username: string): Promise<{ sent: boolean; reason?: string }> {
  const client = adminClient();
  const { data: profile } = await client.from("profiles").select("id, display_name, username").eq("username", username).maybeSingle();
  if (!profile) return { sent: false, reason: "No reader with that username" };
  const [{ data: prefs }, { data: user }] = await Promise.all([
    client.from("email_preferences").select("unsubscribe_token").eq("user_id", profile.id).maybeSingle(),
    client.auth.admin.getUserById(profile.id),
  ]);
  const email = user?.user?.email;
  if (!prefs || !email) return { sent: false, reason: "That reader has no email address" };
  const reader = { user_id: profile.id, display_name: profile.display_name, username: profile.username, unsubscribe_token: prefs.unsubscribe_token };
  const letter = await buildLetter(client, reader);
  if (!letter) return { sent: false, reason: "Nothing to suggest yet" };
  await sendBatch([toEmail({ ...reader, email }, letter)], `monthly-picks-test-${profile.id}-${Date.now()}`);
  return { sent: true };
}
