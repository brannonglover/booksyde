"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
};

/** Labelled input with room for a hint or an error underneath. */
export function Field({ label, name, error, hint, aside, className = "", ...input }: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-surface-raised px-4 py-3 text-base text-text outline-none transition placeholder:text-muted/70 focus:border-text/40 focus:ring-4 focus:ring-highlight/20 ${
          error ? "border-accent" : "border-border"
        } ${className}`}
        {...input}
      />
      {error ? (
        <p id={`${name}-error`} className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <div id={`${name}-hint`} className="text-sm text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<FieldProps, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={shown ? "text" : "password"} className="pr-20" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute right-2 top-[2.05rem] rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
        aria-label={shown ? "Hide password" : "Show password"}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-full bg-primary py-3.5 font-semibold text-primary-text shadow-[0_10px_24px_-14px_rgba(31,27,22,0.7)] transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      {message}
    </p>
  );
}

/** Shown after we email the reader a link instead of signing them in. */
export function CheckYourInbox({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-5xl" aria-hidden>
        ✉️
      </p>
      <h2 className="font-display text-4xl">Check your inbox</h2>
      <p className="text-lg text-muted">
        We sent a link to <span className="font-semibold text-text">{email}</span>. {children}
      </p>
      <p className="text-sm text-muted">Can&rsquo;t find it? Look in your spam folder, or try again in a minute.</p>
    </div>
  );
}
