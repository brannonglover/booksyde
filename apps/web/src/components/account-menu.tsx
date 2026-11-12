"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";

type Profile = { username: string; display_name: string | null; theme_color: string | null };

/** Avatar button with a small menu: who you are, and a way out. */
export function AccountMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = profile.display_name || profile.username;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-surface"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full font-display text-lg text-paper"
          style={{ background: profile.theme_color ?? "var(--bk-green)" }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name.split(" ")[0]}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate font-display text-xl leading-tight">{name}</p>
            <p className="truncate text-sm text-muted">@{profile.username}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link role="menuitem" href="/" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>
            Home
          </Link>
          <form action={signOut}>
            <button role="menuitem" type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-surface">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
