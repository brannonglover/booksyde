"use client";

import { clubSlug } from "@booksyde/shared";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton } from "@/app/(auth)/fields";
import { DEFAULT_INK, inks } from "@/lib/inks";
import { type ClubFormState, startClub } from "../actions";

export function ClubForm() {
  const [state, action] = useActionState<ClubFormState, FormData>(startClub, {});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ink, setInk] = useState<string>(DEFAULT_INK);
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <FormError message={state.error} />
        <Field
          label="Club name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder="The Thursday Night Readers"
          error={state.fieldErrors?.name}
          hint={name.trim() ? `Your club will live at /clubs/${clubSlug(name)}` : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="description" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              What it&rsquo;s about
            </label>
            <span className="text-xs text-muted">{description.length}/1000</span>
          </div>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One classic a month, argued over tea…"
            className="w-full resize-y rounded-xl border border-border bg-surface-raised px-4 py-3 text-base text-text outline-none placeholder:text-muted/70 focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
          />
          {state.fieldErrors?.description ? (
            <p className="text-sm text-accent">{state.fieldErrors.description}</p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Cloth colour</legend>
          <input type="hidden" name="cover_color" value={ink} />
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
            <span className="block font-semibold">Make it private</span>
            <span className="text-sm text-muted">
              Good for a buddy read. Only members can see a private club, and nobody can join it by themselves.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <SubmitButton pendingLabel="Starting…">Start the club</SubmitButton>
          </div>
          <Link href="/clubs" className="mt-2 rounded-full px-5 py-3 font-semibold text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>

      {/* Live preview of the club card */}
      <aside className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview</p>
        <div className="sticky top-8 flex overflow-hidden rounded-2xl border border-border bg-surface">
          <div aria-hidden className="w-2.5 shrink-0" style={{ background: ink }} />
          <div className="min-w-0 flex-1 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              1 reader{isPrivate ? " · 🔒 Private" : ""}
            </p>
            <p className="mt-2 break-words font-display text-3xl leading-none">{name.trim() || "Your club"}</p>
            {description.trim() ? <p className="mt-2 line-clamp-3 text-sm text-muted">{description}</p> : null}
            <p className="mt-4 text-sm italic text-muted">Choosing its first book</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
