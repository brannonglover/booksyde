"use client";

import type { ThemePreference } from "@booksyde/theme";
import { setThemePreference, toggleTheme, useThemePreference } from "@/lib/theme";

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`size-[18px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`size-[18px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function SystemIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`size-[18px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  );
}

/**
 * One-tap switch for the header. The icon is chosen by CSS (the `dark:`
 * variant), so it is correct on first paint with no hydration flicker.
 */
export function ThemeToggleButton() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid size-9 place-items-center rounded-full text-text hover:bg-surface"
      aria-label="Switch between light and dark"
      title="Switch between light and dark"
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </button>
  );
}

const options: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "system", label: "System", Icon: SystemIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

/** Three-way picker (follow device / light / dark), for the footer and settings. */
export function ThemePicker() {
  const preference = useThemePreference();
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex gap-1 rounded-full border border-border bg-surface p-1">
      {options.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemePreference(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              selected ? "bg-primary text-primary-text" : "text-muted hover:text-text"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
