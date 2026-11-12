import Link from "next/link";
import { Ornament, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Error 404</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          This page seems to have been <em className="text-accent">misshelved</em>.
        </h1>
        <Ornament />
        <p className="text-lg text-muted">We looked in all the usual places. Try heading back to the front desk.</p>
        <Link href="/" className="mt-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-text hover:opacity-90">
          Back to Booksyde
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
