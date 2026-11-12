"use client";

import { isUsernameAvailable, usernameSchema } from "@booksyde/shared";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, SubmitButton } from "@/app/(auth)/fields";
import { createClient } from "@/lib/supabase/client";
import { type ProfileFormState, saveProfile } from "./actions";

/** Ink colours readers can pick for their bookplate and avatar. */
const inks = [
  { hex: "#2D4A3E", name: "Library green" },
  { hex: "#8B3A2B", name: "Oxblood" },
  { hex: "#2F4A66", name: "Ink blue" },
  { hex: "#5B3A5E", name: "Aubergine" },
  { hex: "#B8893A", name: "Gilt" },
  { hex: "#6F8B5E", name: "Sage" },
  { hex: "#B0565A", name: "Rosewood" },
  { hex: "#1F1B16", name: "Iron-gall" },
];

type Profile = { username: string; display_name: string | null; bio: string | null; theme_color: string | null; is_private: boolean };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const [name, setName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [ink, setInk] = useState(profile.theme_color ?? inks[0].hex);
  const [isPrivate, setIsPrivate] = useState(profile.is_private);
  const [taken, setTaken] = useState<{ username: string; taken: boolean } | null>(null);

  useEffect(() => {
    if (username === profile.username || !usernameSchema.safeParse(username).success) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      isUsernameAvailable(createClient(), username)
        .then((free) => !cancelled && setTaken({ username, taken: !free }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, profile.username]);

  const formatOk = usernameSchema.safeParse(username).success;
  const usernameHint =
    username === profile.username ? (
      `Your profile lives at /u/${username}`
    ) : !formatOk ? (
      <span className="text-accent">3–30 characters: letters, numbers and underscores</span>
    ) : taken?.username === username ? (
      taken.taken ? (
        <span className="text-accent">Someone already has @{username}</span>
      ) : (
        <span className="text-success">✓ @{username} is free</span>
      )
    ) : (
      "Checking…"
    );

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <FormError message={state.error} />
        <Field
          label="Your name"
          name="display_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          error={state.fieldErrors?.display_name}
        />
        <Field
          label="Username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
          autoCapitalize="none"
          spellCheck={false}
          error={state.fieldErrors?.username}
          hint={usernameHint}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              A line about you
            </label>
            <span className="text-xs text-muted">{bio.length}/500</span>
          </div>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Rereads Austen every winter…"
            className="w-full resize-y rounded-xl border border-border bg-surface-raised px-4 py-3 text-base text-text outline-none placeholder:text-muted/70 focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your ink</legend>
          <input type="hidden" name="theme_color" value={ink} />
          <div className="flex flex-wrap gap-3">
            {inks.map((i) => (
              <button
                key={i.hex}
                type="button"
                onClick={() => setInk(i.hex)}
                aria-pressed={ink === i.hex}
                aria-label={i.name}
                title={i.name}
                className={`size-10 rounded-full ring-offset-2 ring-offset-background transition ${ink === i.hex ? "ring-2 ring-text" : "hover:scale-110"}`}
                style={{ background: i.hex }}
              />
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-surface p-5">
          <input
            type="checkbox"
            name="is_private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-1 size-5 accent-[var(--bk-primary)]"
          />
          <span>
            <span className="block font-semibold">Keep my library private</span>
            <span className="text-sm text-muted">
              Only people you approve can see your shelves, ratings and notes. Anyone can still see your bookplate.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <SubmitButton pendingLabel="Saving…">Save my bookplate</SubmitButton>
          </div>
          <Link href={`/u/${profile.username}`} className="mt-2 rounded-full px-5 py-3 font-semibold text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>

      {/* Live preview of the bookplate */}
      <aside className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview</p>
        <div className="sticky top-8 rounded-sm bg-[#FBF5E8] p-1.5 text-ink shadow-[0_20px_40px_-24px_rgba(31,27,22,0.6)] dark:bg-[#2F2822] dark:text-paper">
          <div className="rounded-sm border-[3px] border-double px-5 pb-6 pt-5 text-center" style={{ borderColor: ink }}>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.45em]" style={{ color: ink }}>
              Ex Libris
            </p>
            <div
              aria-hidden
              className="mx-auto mt-3 grid size-14 place-items-center rounded-full border-4 border-double font-display text-3xl text-paper"
              style={{ background: ink, borderColor: "var(--bk-gilt)" }}
            >
              {(name || username).charAt(0).toUpperCase()}
            </div>
            <p className="mt-3 font-display text-3xl leading-none">{name || username}</p>
            <p className="mt-1 text-xs text-muted">
              @{username}
              {isPrivate ? " · 🔒 Private" : ""}
            </p>
            {bio ? <p className="mt-3 font-display text-lg italic leading-snug">{bio}</p> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
