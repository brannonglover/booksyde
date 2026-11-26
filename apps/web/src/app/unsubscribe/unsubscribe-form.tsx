"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError, SubmitButton } from "@/app/(auth)/fields";
import { type UnsubscribeState, unsubscribe } from "./actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState<UnsubscribeState, FormData>(unsubscribe, {});
  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg">Done. We won’t send you the monthly letter again.</p>
        <p className="text-muted">
          Changed your mind? You can turn it back on in your{" "}
          <Link href="/settings/email" className="font-semibold text-primary underline underline-offset-4">
            email settings
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Unsubscribing…">Unsubscribe</SubmitButton>
      <Link href="/" className="text-center font-semibold text-muted hover:text-text">
        Keep getting it
      </Link>
    </form>
  );
}
