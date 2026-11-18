"use client";

import { getMoodVotes, MAX_MOOD_VOTES, type MoodTag, setMoodVote } from "@booksyde/shared";
import { genreColor } from "@booksyde/theme";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { moodsChanged } from "@/app/books/[id]/actions";
import { captureEvent } from "@/components/analytics";
import { AnalyticsEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

type Votes = { counts: Record<string, number>; mine: string[]; signedIn: boolean };

/** "How did it feel to you?": readers pick up to three moods for a book. Personal, so it loads in the browser. */
export function MoodVote({ workId, moods }: { workId: string; moods: MoodTag[] }) {
  const [votes, setVotes] = useState<Votes | null>(null);
  const [note, setNote] = useState<"signed-out" | "full" | "error" | null>(null);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    getMoodVotes(createClient(), workId, moods)
      .then((v) => !cancelled && setVotes(v))
      .catch(() => !cancelled && setVotes({ counts: {}, mine: [], signedIn: false }));
    return () => {
      cancelled = true;
    };
  }, [workId, moods]);

  async function toggle(mood: MoodTag) {
    if (!votes) return;
    if (!votes.signedIn) return setNote("signed-out");
    const on = !votes.mine.includes(mood.id);
    if (on && votes.mine.length >= MAX_MOOD_VOTES) return setNote("full");
    setNote(null);

    // Show it at once; put it back if the save fails.
    const before = votes;
    setVotes({
      ...votes,
      mine: on ? [...votes.mine, mood.id] : votes.mine.filter((id) => id !== mood.id),
      counts: { ...votes.counts, [mood.id]: Math.max(0, (votes.counts[mood.id] ?? 0) + (on ? 1 : -1)) },
    });
    try {
      await setMoodVote(createClient(), workId, mood.id, on);
      captureEvent(on ? AnalyticsEvent.MoodVoted : AnalyticsEvent.MoodUnvoted, { mood: mood.slug, work_id: workId });
      startTransition(() => moodsChanged(workId));
    } catch (e) {
      setVotes(before);
      setNote(e instanceof Error && /signed in/i.test(e.message) ? "signed-out" : "error");
    }
  }

  const mine = votes?.mine ?? [];
  const full = mine.length >= MAX_MOOD_VOTES;
  return (
    <div>
      <p className="font-semibold text-text">How did it feel to you?</p>
      <p className="mt-0.5 text-sm text-muted">
        {mine.length ? `${mine.length} of ${MAX_MOOD_VOTES} picked. Tap one again to take it back.` : `Pick up to ${MAX_MOOD_VOTES}.`}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-busy={votes === null}>
        {moods.map((m) => {
          const picked = mine.includes(m.id);
          const count = votes?.counts[m.id] ?? 0;
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={picked}
                disabled={votes === null}
                onClick={() => toggle(m)}
                style={{ "--tag": genreColor(m.slug).dot } as React.CSSProperties}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                  picked
                    ? "border-[var(--tag)] bg-[var(--tag)] text-white"
                    : `border-border bg-surface text-text hover:border-[var(--tag)] ${full ? "opacity-60" : ""}`
                }`}
              >
                {picked ? (
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span aria-hidden className="size-2 rounded-full bg-[var(--tag)]" />
                )}
                {m.name}
                {count > 0 ? <span className={picked ? "text-white/80" : "text-muted"}>{count}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {note ? (
        <p role="status" className="mt-3 text-sm text-muted">
          {note === "signed-out" ? (
            <>
              <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="font-semibold text-accent hover:underline">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href={`/sign-up?next=${encodeURIComponent(pathname)}`} className="font-semibold text-accent hover:underline">
                join free
              </Link>{" "}
              to add your vote.
            </>
          ) : note === "full" ? (
            `You’ve picked ${MAX_MOOD_VOTES}. Take one back to choose another.`
          ) : (
            "That didn’t save. Try again in a moment."
          )}
        </p>
      ) : null}
    </div>
  );
}
