"use client";

import { createClubPost, deleteClubPost } from "@booksyde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Write to the club. A post about the current book is tagged with a spoiler
 * page (your own page by default), so readers behind you can't read it yet.
 */
export function PostComposer({
  clubId,
  read,
  myPage,
  finished,
}: {
  clubId: string;
  /** The club's current book, if it has one. */
  read: { id: string; title: string } | null;
  /** Your page in that book, if you've logged one. */
  myPage: number | null;
  /** You've finished that book. */
  finished: boolean;
}) {
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(read !== null && (finished || (myPage ?? 0) > 0));
  const [page, setPage] = useState(myPage ? String(myPage) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // When you log a new page (or finish), move the default spoiler page along with you.
  const [syncedFrom, setSyncedFrom] = useState({ myPage, finished });
  if (syncedFrom.myPage !== myPage || syncedFrom.finished !== finished) {
    setSyncedFrom({ myPage, finished });
    setPage(myPage ? String(myPage) : "");
    if (read && (finished || (myPage ?? 0) > 0)) setSpoiler(true);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setError("Write something first.");
      return;
    }
    const spoilerPage = read && spoiler ? Number(page) : null;
    if (spoilerPage !== null && (!Number.isInteger(spoilerPage) || spoilerPage < 1)) {
      setError("Which page does your post give away? Or untick the spoiler box.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createClubPost(createClient(), { clubId, clubReadId: read?.id ?? null, body: text, spoilerPage });
        setBody("");
        router.refresh();
      } catch {
        setError("We couldn’t post that. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <label htmlFor="club-post" className="sr-only">
        Write to the club
      </label>
      <textarea
        id="club-post"
        rows={3}
        maxLength={10000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={read ? `What do you make of ${read.title} so far?` : "Say hello to the club…"}
        className="w-full resize-y rounded-xl border border-border bg-surface-raised px-4 py-3 text-base text-text outline-none placeholder:text-muted/70 focus:border-text/40 focus:ring-4 focus:ring-highlight/20"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {read ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={spoiler}
                onChange={(e) => setSpoiler(e.target.checked)}
                className="size-4 accent-[var(--bk-primary)]"
              />
              Spoilers up to page
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={page}
              disabled={!spoiler}
              onChange={(e) => setPage(e.target.value)}
              aria-label="Spoiler page"
              placeholder="—"
              className="w-20 rounded-lg border border-border bg-surface-raised px-2 py-1 text-text outline-none focus:border-text/40 disabled:opacity-50"
            />
          </div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-text hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      {read && spoiler && page ? (
        <p className="text-xs text-muted">
          Readers who haven&rsquo;t reached page {page} won&rsquo;t see what you wrote until they do.
        </p>
      ) : null}
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </form>
  );
}

/** Delete your own post (or, for moderators, anyone's). */
export function DeletePostButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this post?")) return;
        startTransition(async () => {
          try {
            await deleteClubPost(createClient(), postId);
            router.refresh();
          } catch {
            window.alert("We couldn’t delete that post. Please try again.");
          }
        });
      }}
      className="text-xs font-semibold text-muted hover:text-accent disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
