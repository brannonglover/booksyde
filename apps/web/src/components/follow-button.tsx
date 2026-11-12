"use client";

import { follow, type FollowState, unfollow } from "@booksyde/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const labels: Record<Exclude<FollowState, "self" | "signed-out">, { idle: string; hover?: string }> = {
  none: { idle: "Follow" },
  pending: { idle: "Requested", hover: "Cancel request" },
  following: { idle: "Following", hover: "Unfollow" },
};

/** Follow / Requested / Following, with the follower counts refreshed from the server after each change. */
export function FollowButton({ userId, initial, isPrivate }: { userId: string; initial: FollowState; isPrivate: boolean }) {
  const [state, setState] = useState(initial);
  const [hovered, setHovered] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  if (state === "self") return null;
  if (state === "signed-out") {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(pathname)}`}
        className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-text hover:opacity-90"
      >
        {isPrivate ? "Sign in to request a look" : "Sign in to follow"}
      </Link>
    );
  }

  const toggle = () =>
    startTransition(async () => {
      const client = createClient();
      try {
        if (state === "none") {
          await follow(client, userId);
          setState(isPrivate ? "pending" : "following");
        } else {
          await unfollow(client, userId);
          setState("none");
        }
        router.refresh();
      } catch {
        // Leave the button as it was; the next tap will try again.
      }
    });

  const label = labels[state];
  const active = state !== "none";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`min-w-36 rounded-full px-6 py-2.5 font-semibold transition disabled:opacity-60 ${
        active ? "border border-border bg-surface text-text hover:border-accent hover:text-accent" : "bg-primary text-primary-text hover:opacity-90"
      }`}
    >
      {hovered && label.hover ? label.hover : state === "none" && isPrivate ? "Request to follow" : label.idle}
    </button>
  );
}
