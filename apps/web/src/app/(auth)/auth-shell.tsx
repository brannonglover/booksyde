import Link from "next/link";
import { ThemeToggleButton } from "@/components/theme-toggle";

/**
 * Split layout for the sign-in / sign-up pages: a green "reading room" panel
 * on wide screens (its contents vary by page) and the form on the paper side.
 */
export function AuthShell({
  aside,
  quote,
  switchPrompt,
  children,
}: {
  aside: React.ReactNode;
  quote: { text: string; source: string };
  switchPrompt: { text: string; label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-green text-paper lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-4 rounded-2xl border border-gilt/35" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 45% at 50% 42%, rgba(216,176,104,0.22), transparent 70%)" }}
        />
        <Link href="/" className="relative px-12 pt-12 font-display text-3xl">
          Booksyde<span className="text-gilt">.</span>
        </Link>
        <div className="relative flex flex-1 items-center justify-center px-12 py-10">{aside}</div>
        <figure className="relative px-12 pb-12">
          <blockquote className="max-w-md font-display text-2xl italic leading-snug text-paper/90">
            &ldquo;{quote.text}&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-gilt">{quote.source}</figcaption>
        </figure>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-10 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-3xl lg:invisible">
            Booksyde<span className="text-highlight">.</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{switchPrompt.text}</span>
            <Link href={switchPrompt.href} className="rounded-full px-3 py-2 font-semibold text-accent hover:bg-surface">
              {switchPrompt.label}
            </Link>
            <ThemeToggleButton />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{kicker}</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.02] sm:text-6xl">{title}</h1>
      {children ? <p className="mt-3 text-lg text-muted">{children}</p> : null}
    </header>
  );
}
