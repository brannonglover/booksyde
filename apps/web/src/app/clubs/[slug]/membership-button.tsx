"use client";

import type { ClubRole } from "@booksyde/shared";
import { joinClub, leaveClub } from "@booksyde/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/** Join / Member (hover to leave). Owners can't leave the club they started. */
export function MembershipButton({
  clubId,
  role,
  signedIn,
}: {
  clubId: string;
  role: ClubRole | null;
  signedIn: boolean;
}) {
  const [member, setMember] = useState(role !== null);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(pathname)}`}
        className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-text hover:opacity-90"
      >
        Sign in to join
      </Link>
    );
  }
  if (role === "owner") return null;

  const toggle = () => {
    if (member && !window.confirm("Leave this club?")) return;
    setError(false);
    startTransition(async () => {
      const client = createClient();
      try {
        if (member) await leaveClub(client, clubId);
        else await joinClub(client, clubId);
        setMember(!member);
        router.refresh();
      } catch {
        setError(true);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-1.5 sm:items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`min-w-36 rounded-full px-6 py-2.5 font-semibold transition disabled:opacity-60 ${
          member
            ? "border border-border bg-surface text-text hover:border-accent hover:text-accent"
            : "bg-primary text-primary-text hover:opacity-90"
        }`}
      >
        {member ? (hovered ? "Leave club" : "Member ✓") : "Join the club"}
      </button>
      {error ? <p className="text-sm text-accent">That didn&rsquo;t work. Try again?</p> : null}
    </div>
  );
}
