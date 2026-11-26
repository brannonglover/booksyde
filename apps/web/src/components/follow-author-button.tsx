"use client";

import { compactCount, followAuthor, getAuthorFollowersCount, getAuthorFollowState, unfollowAuthor } from "@booksyde/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { captureEvent } from "@/components/analytics";
import { AnalyticsEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

type State = "loading" | "signed-out" | "following" | "not-following";

/**
 * Follow / Following for an author, with how many readers follow. Personal, so
 * it loads in the browser; the count is fetched fresh too, since the page
 * around it is cached.
 */
export function FollowAuthorButton({ authorId, initialCount }: { authorId: string; initialCount: number }) {
  const [state, setState] = useState<State>("loading");
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const client = createClient();
    Promise.all([getAuthorFollowState(client, authorId), getAuthorFollowersCount(client, authorId)])
      .then(([following, n]) => {
        if (cancelled) return;
        setState(following === null ? "signed-out" : following ? "following" : "not-following");
        setCount(n);
      })
      .catch(() => !cancelled && setState("not-following"));
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  async function toggle() {
    const client = createClient();
    const following = state === "following";
    setBusy(true);
    setFailed(false);
    try {
      if (following) await unfollowAuthor(client, authorId);
      else await followAuthor(client, authorId);
      captureEvent(following ? AnalyticsEvent.AuthorUnfollowed : AnalyticsEvent.AuthorFollowed, { author_id: authorId });
      setState(following ? "not-following" : "following");
      setCount(await getAuthorFollowersCount(client, authorId).catch(() => Math.max(0, count + (following ? -1 : 1))));
    } catch (e) {
      if (e instanceof Error && /signed in/i.test(e.message)) setState("signed-out");
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const countLine =
    count > 0 ? (
      <p className="text-sm text-muted">
        {compactCount(count)} {count === 1 ? "reader follows" : "readers follow"}
      </p>
    ) : null;

  if (state === "signed-out") {
    return (
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <Link
          href={`/sign-in?next=${encodeURIComponent(pathname)}`}
          className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-text hover:opacity-90"
        >
          Sign in to follow
        </Link>
        {countLine}
      </div>
    );
  }

  const following = state === "following";
  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || state === "loading"}
        aria-pressed={following}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`min-w-40 rounded-full px-6 py-2.5 font-semibold transition disabled:opacity-60 ${
          following
            ? "border border-border bg-surface text-text hover:border-accent hover:text-accent"
            : "bg-primary text-primary-text hover:opacity-90"
        }`}
      >
        {following ? (hovered ? "Unfollow" : "✓ Following") : "Follow"}
      </button>
      {failed ? <p className="text-sm text-muted">That didn&rsquo;t work. Try again?</p> : countLine}
    </div>
  );
}
