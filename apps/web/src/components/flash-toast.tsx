"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FLASH_COOKIE, type FlashKind } from "@/lib/flash";

/*
 * One-off notices shown on whichever page the reader lands on. Two sources:
 *  - the flash cookie, set by a route handler before it redirects (e.g. `confirmed:Margot`);
 *  - sign-up links from the mobile app (`/?from=app`). The app uses Supabase's implicit flow,
 *    which puts the outcome in the URL fragment (#…&type=signup or #error=…), where only the
 *    browser can see it.
 */
type Kind = FlashKind | "confirmed-in-app" | "link-expired";
type Flash = { kind: Kind; title: string; body: string; tone: "success" | "error" };

function messageFor(kind: Kind, name = ""): Flash {
  switch (kind) {
    case "confirmed":
      return {
        kind,
        tone: "success",
        title: "Email confirmed",
        body: name ? `Welcome to Booksyde, ${name}. Your shelf is ready.` : "Welcome to Booksyde. Your shelf is ready.",
      };
    case "confirmed-sign-in":
      return { kind, tone: "success", title: "Email confirmed", body: "Sign in to open your shelf." };
    case "confirmed-in-app":
      return { kind, tone: "success", title: "Email confirmed", body: "Head back to the Booksyde app and sign in to open your shelf." };
    case "link-expired":
      return {
        kind,
        tone: "error",
        title: "That link has expired",
        body: "Confirmation links only work once. Sign up again with the same email and we’ll send a fresh one.",
      };
  }
}

function fromCookie(): Flash | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
  if (!match) return null;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/`;
  const [kind = "", ...rest] = decodeURIComponent(match[1]).split(":");
  if (kind !== "confirmed" && kind !== "confirmed-sign-in") return null;
  return messageFor(kind, rest.join(":").trim());
}

function fromAppLink(): Flash | null {
  const url = new URL(window.location.href);
  if (url.searchParams.get("from") !== "app") return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has("error") || hash.has("error_code") || url.searchParams.has("error")) return messageFor("link-expired");
  if (hash.get("type") === "signup" || hash.has("access_token")) return messageFor("confirmed-in-app");
  return null;
}

// Read once per page load: the cookie is cleared as soon as it's seen.
let flash: Flash | null | undefined;
function readFlash() {
  if (flash === undefined) flash = fromCookie() ?? fromAppLink();
  return flash;
}

const noSubscribe = () => () => {};

export function FlashToast() {
  const message = useSyncExternalStore(noSubscribe, readFlash, () => null);
  const [dismissed, setDismissed] = useState(false);

  // Take `from=app` and the fragment (it holds the app's session tokens) out of the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("from") !== "app") return;
    url.searchParams.delete("from");
    url.searchParams.delete("error");
    url.searchParams.delete("error_code");
    url.searchParams.delete("error_description");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setDismissed(true), message.tone === "error" ? 12000 : 7000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || dismissed) return null;
  const error = message.tone === "error";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-6">
      <div
        role={error ? "alert" : "status"}
        className="pointer-events-auto flex w-full max-w-md animate-[flash-in_320ms_cubic-bezier(0.2,0.9,0.3,1.2)] items-start gap-3 rounded-2xl border border-border bg-surface-raised px-5 py-4 text-text shadow-[0_20px_40px_-20px_rgba(31,27,22,0.55)]"
      >
        <span
          aria-hidden
          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-paper ${error ? "bg-accent" : "bg-success"}`}
        >
          {error ? "!" : "✓"}
        </span>
        <div className="flex-1">
          <p className="font-semibold">{message.title}</p>
          <p className="text-sm text-muted">{message.body}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-surface hover:text-text"
        >
          ×
        </button>
      </div>
    </div>
  );
}
