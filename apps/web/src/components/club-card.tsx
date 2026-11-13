import type { ClubCard as Club } from "@booksyde/shared";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { DEFAULT_INK } from "@/lib/inks";

/** A club as a cloth-bound card: its colour, its name, what it's reading and how many are in it. */
export function ClubCard({ club, role }: { club: Club; role?: string }) {
  const ink = club.cover_color ?? DEFAULT_INK;
  const read = club.currentRead;
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="group flex h-full overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-1 hover:border-text/30 hover:shadow-[0_18px_36px_-24px_rgba(31,27,22,0.6)]"
    >
      <div aria-hidden className="w-2.5 shrink-0" style={{ background: ink }} />
      <div className="flex min-w-0 flex-1 gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <span>
              {club.memberCount} {club.memberCount === 1 ? "reader" : "readers"}
            </span>
            {club.is_private ? <span>· 🔒 Private</span> : null}
            {role && role !== "member" ? <span className="text-accent">· {role}</span> : null}
          </div>
          <h3 className="mt-2 font-display text-3xl leading-none group-hover:text-accent">{club.name}</h3>
          {club.description ? <p className="mt-2 line-clamp-2 text-sm text-muted">{club.description}</p> : null}
          <p className="mt-auto pt-4 text-sm text-muted">
            {read ? (
              <>
                Reading <span className="font-display text-lg italic text-text">{read.work.title}</span>
              </>
            ) : (
              <span className="italic">Choosing its first book</span>
            )}
          </p>
        </div>
        {read ? (
          <BookCover
            title={read.work.title}
            author={read.work.author}
            src={read.work.cover_url}
            color={read.work.cover_color}
            sizes="64px"
            className="w-16 shrink-0 self-start"
          />
        ) : null}
      </div>
    </Link>
  );
}
