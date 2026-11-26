"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton } from "@/app/(auth)/fields";
import { type EmailSettingsState, saveEmailSettings } from "./actions";

export function EmailForm({ monthlyPicks }: { monthlyPicks: boolean }) {
  const [state, action] = useActionState<EmailSettingsState, FormData>(saveEmailSettings, {});
  const [on, setOn] = useState(monthlyPicks);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-6">
      <FormError message={state.error} />
      <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-surface p-5">
        <input
          type="checkbox"
          name="monthly_picks"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 size-5 accent-[var(--bk-primary)]"
        />
        <span>
          <span className="block font-semibold">Your next read, monthly</span>
          <span className="text-sm text-muted">
            Near the end of each month, a few ideas for your next book: the next in a series you’re reading, new books by
            authors you follow, what’s waiting on your Want to Read shelf, and picks close to the books you love.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-48">
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </div>
        {state.saved ? (
          <p role="status" className="mt-2 text-sm text-success">
            ✓ Saved
          </p>
        ) : null}
      </div>
    </form>
  );
}
