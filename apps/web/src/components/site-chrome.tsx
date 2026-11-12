import Link from "next/link";
import { ThemePicker, ThemeToggleButton } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-3xl leading-none">
          Booksyde<span className="text-highlight">.</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <Link className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="/#discover">
            Discover
          </Link>
          <Link className="hidden rounded-full px-4 py-2 hover:bg-surface sm:inline-block" href="/#join">
            Clubs
          </Link>
          <ThemeToggleButton />
          <Link className="rounded-full px-3 py-2 hover:bg-surface sm:px-4" href="/#join">
            Sign in
          </Link>
          <Link className="rounded-full bg-primary px-4 py-2 text-primary-text hover:opacity-90" href="/#join">
            Join free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl text-text">
            Booksyde<span className="text-highlight">.</span>
          </span>
          <span className="italic">Set in Instrument Serif &amp; Plus Jakarta Sans. Made for readers.</span>
        </div>
        <ThemePicker />
      </div>
    </footer>
  );
}

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-3 text-highlight ${className}`}>
      <span className="h-px w-10 bg-current opacity-60" />
      <span className="text-lg leading-none">❦</span>
      <span className="h-px w-10 bg-current opacity-60" />
    </div>
  );
}

export function SectionHeading({
  numeral,
  children,
  aside,
  as: Tag = "h2",
}: {
  numeral: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <Tag className="font-display text-4xl leading-none sm:text-5xl">
        <span className="mr-3 text-2xl italic text-highlight sm:text-3xl">{numeral}.</span>
        {children}
      </Tag>
      {aside}
    </div>
  );
}
