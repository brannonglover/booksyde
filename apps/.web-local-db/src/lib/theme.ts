import type { ThemePreference } from "@booksyde/theme";
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

/**
 * The reader's light/dark choice lives on <html data-theme> (no attribute =
 * follow the device) and in localStorage, so it survives reloads. The inline
 * script from theme-script.ts (run in layout.tsx) applies it before first paint to avoid a flash.
 */
const CHANGE_EVENT = "booksyde-theme-change";

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export function setThemePreference(preference: ThemePreference) {
  const commit = () => {
    applyPreference(preference);
    try {
      if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  // Crossfade the whole page (see ::view-transition rules in globals.css) where supported.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && typeof document.startViewTransition === "function") document.startViewTransition(commit);
  else commit();
}

function getPreference(): ThemePreference {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  // Keep other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    applyPreference(e.newValue === "light" || e.newValue === "dark" ? e.newValue : "system");
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onChange);
  };
}

/** The reader's choice: "system" until hydrated. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getPreference, () => "system");
}

/** Toggle to the opposite of whatever is showing right now, as an explicit choice. */
export function toggleTheme() {
  const preference = getPreference();
  const showingDark = preference === "dark" || (preference === "system" && systemPrefersDark());
  setThemePreference(showingDark ? "light" : "dark");
}
