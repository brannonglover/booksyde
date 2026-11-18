"use client";

import { getMyReadingStatus, READING_STATUS_LABELS, removeFromShelves, setReadingStatus, type ShelfMove } from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { captureEvent } from "@/components/analytics";
import { AnalyticsEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

const statuses: ReadingStatus[] = ["want_to_read", "reading", "read", "did_not_finish"];
const LONG_PRESS_MS = 500;
const MENU_WIDTH = 224;
const arrangeMoves: { move: ShelfMove; label: string }[] = [
  { move: "front", label: "Move to the front" },
  { move: "earlier", label: "Move left" },
  { move: "later", label: "Move right" },
  { move: "end", label: "Move to the end" },
];

/**
 * Fired on `window` when the quick menu changes a book's shelf, with
 * `{ workId, status }` as its detail, so other shelf controls for the same
 * book on the page (the book page's shelf button) can keep up.
 */
export const SHELF_CHANGED_EVENT = "booksyde:shelf-changed";
export type ShelfChangedDetail = { workId: string; status: ReadingStatus | null };

/** Where a book sits on a shelf the reader can arrange, and how to move it along. */
export type ShelfArrangement = {
  index: number;
  count: number;
  onMove: (move: ShelfMove) => void;
};

/** The reader's shelf for a book as the menu knows it: still looking, signed out, or a shelf (null for none). */
type Known = { state: "loading" } | { state: "signed-out" } | { state: "known"; status: ReadingStatus | null };

/**
 * A book cover with a quick shelf menu. Right-click it, long-press it on a
 * touch screen, or press the context-menu key on it to put it on a shelf, move
 * it to another, or take it off, without opening the book. A plain click still
 * opens the book.
 *
 * Pass `status` for a book on the reader's own shelf: the page is refreshed
 * after a change so the book moves shelves (and `arrange` adds moves along
 * that shelf). Leave it out anywhere else, and the menu looks up the reader's
 * shelf for the book when it opens.
 *
 * With `here` (the book whose page this is), the cover isn't a link: a click
 * or Enter opens the menu instead.
 */
export function ShelfBook({
  workId,
  title,
  status,
  arrange,
  here,
  className,
  linkClassName,
  children,
}: {
  workId: string;
  title: string;
  status?: ReadingStatus;
  arrange?: ShelfArrangement;
  /** This is the book the page is about, so the cover opens the menu rather than linking to itself. */
  here?: boolean;
  /** On the wrapper, which holds the cover's place in the layout. */
  className?: string;
  /** On the link itself; defaults to `block`. */
  linkClassName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ownShelf = status !== undefined;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // On the reader's own shelf the page says where the book is; anywhere else the menu looks it up.
  const [looked, setKnown] = useState<Known>({ state: "loading" });
  const known: Known = ownShelf ? { state: "known", status } : looked;
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const linkRef = useRef<HTMLElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  function lookUp() {
    if (ownShelf) return;
    const client = createClient();
    client.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) return setKnown({ state: "signed-out" });
        setKnown({ state: "known", status: await getMyReadingStatus(client, workId) });
      })
      .catch(() => setKnown({ state: "known", status: null }));
  }

  function openAt(x: number, y: number) {
    setError(false);
    // Look again each time: the reader may have shelved it on another page since.
    if (!ownShelf && known.state !== "known") setKnown({ state: "loading" });
    lookUp();
    // ShelfMenu nudges itself up if it would run off the bottom of the window.
    setMenu({ x: Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8)), y: Math.max(8, y) });
  }

  function openFromElement() {
    const r = linkRef.current?.getBoundingClientRect();
    if (r) openAt(r.left + r.width / 2, r.top + r.height / 2);
  }

  const closeMenu = useCallback(() => {
    setMenu(null);
    linkRef.current?.focus();
  }, []);

  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer);
  }

  async function choose(next: ReadingStatus | null) {
    setMenu(null);
    linkRef.current?.focus();
    if (known.state !== "known") return;
    const previous = known.status;
    if (next === previous) return;
    setSaving(true);
    try {
      const client = createClient();
      if (next) await setReadingStatus(client, workId, next);
      else await removeFromShelves(client, workId);
      if (next) captureEvent(AnalyticsEvent.BookShelved, { status: next, previous_status: previous, work_id: workId, source: "quick_menu" });
      else captureEvent(AnalyticsEvent.BookUnshelved, { previous_status: previous, work_id: workId, source: "quick_menu" });
      setKnown({ state: "known", status: next });
      window.dispatchEvent(new CustomEvent<ShelfChangedDetail>(SHELF_CHANGED_EVENT, { detail: { workId, status: next } }));
      if (ownShelf) startRefresh(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || refreshing;

  return (
    <div className={`relative ${className ?? ""}`}>
      <Trigger
        linkRef={linkRef}
        href={here ? null : `/books/${workId}`}
        onActivate={(e) => {
          if ("clientX" in e && (e.clientX || e.clientY)) openAt(e.clientX, e.clientY);
          else openFromElement();
        }}
        title={title}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        aria-busy={busy}
        className={`${linkClassName ?? "block"} select-none [-webkit-touch-callout:none] ${busy ? "pointer-events-none animate-pulse opacity-50" : ""}`}
        onContextMenu={(e) => {
          e.preventDefault();
          cancelPress();
          // Keyboard-triggered context menus report (0, 0); anchor those to the cover.
          if (e.clientX === 0 && e.clientY === 0) openFromElement();
          else openAt(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const p = { timer: 0, x: t.clientX, y: t.clientY, fired: false };
          p.timer = window.setTimeout(() => {
            p.fired = true;
            navigator.vibrate?.(10);
            openAt(p.x, p.y);
          }, LONG_PRESS_MS);
          press.current = p;
        }}
        onTouchMove={(e) => {
          const p = press.current;
          const t = e.touches[0];
          if (p && Math.hypot(t.clientX - p.x, t.clientY - p.y) > 10) cancelPress();
        }}
        onTouchEnd={cancelPress}
        onTouchCancel={cancelPress}
        onClick={(e) => {
          // The tap that ended a long press shouldn't also open the book.
          if (press.current?.fired) {
            e.preventDefault();
            press.current = null;
          }
        }}
      >
        {children}
      </Trigger>
      {error ? (
        <span role="status" className="absolute inset-x-0 bottom-1 mx-1 rounded bg-oxblood px-1 py-0.5 text-center text-[0.65rem] leading-tight text-paper">
          Couldn’t {ownShelf ? "move" : "shelve"} it. Try again?
        </span>
      ) : null}
      {menu ? (
        <ShelfMenu
          x={menu.x}
          y={menu.y}
          title={title}
          known={known}
          arrange={arrange}
          onChoose={choose}
          onArrange={(move) => {
            setMenu(null);
            arrange?.onMove(move);
          }}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}

type TriggerProps = Omit<ComponentProps<"a">, "href" | "ref"> & {
  linkRef: RefObject<HTMLElement | null>;
  /** Null for the book whose page this is: then it's a button that opens the menu. */
  href: string | null;
  onActivate: (e: ReactMouseEvent | ReactKeyboardEvent) => void;
};

/** The cover itself: a link to the book, or (on the book's own page) a button for its menu. */
function Trigger({ linkRef, href, onActivate, onClick, ...props }: TriggerProps) {
  if (href) return <Link ref={linkRef as RefObject<HTMLAnchorElement>} href={href} onClick={onClick} {...props} />;
  return (
    <div
      ref={linkRef as RefObject<HTMLDivElement>}
      role="button"
      tabIndex={0}
      aria-current="page"
      {...(props as ComponentProps<"div">)}
      onClick={(e) => {
        onClick?.(e as unknown as ReactMouseEvent<HTMLAnchorElement>);
        if (!e.defaultPrevented) onActivate(e);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onActivate(e);
      }}
    />
  );
}

function ShelfMenu({
  x,
  y,
  title,
  known,
  arrange,
  onChoose,
  onArrange,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  known: Known;
  arrange?: ShelfArrangement;
  onChoose: (s: ReadingStatus | null) => void;
  onArrange: (move: ShelfMove) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [top, setTop] = useState(y);
  const status = known.state === "known" ? known.status : null;
  const loading = known.state === "loading";

  // Keep the whole menu on screen: lift it if it would run past the bottom
  // (again once the reader's shelf is known, since the menu may grow).
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(y, window.innerHeight - height - 8)));
  }, [y, known.state]);

  // Focus the first item, and again when the items change (loading → known, or signed out).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role^=menuitem]:not(:disabled)")?.focus();
  }, [known.state]);

  useEffect(() => {
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not(:disabled)") ?? []);

    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    };
    // Any scroll or resize would leave the menu floating away from its book.
    const close = () => onClose();

    // Wait a frame so the press that opened the menu doesn't immediately close it.
    const id = window.setTimeout(() => document.addEventListener("pointerdown", onPointer), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  // Portalled to <body>: the cover's hover lift is a transform, which would
  // otherwise make `fixed` position the menu against the book, not the window.
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Put ${title} on a shelf`}
      aria-busy={loading}
      className="fixed z-50 overflow-hidden rounded-xl border border-border bg-surface-raised p-1 text-sm shadow-xl"
      style={{ left: x, top, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="truncate px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {known.state === "signed-out" ? (
        <>
          <p className="px-3 pb-1 pt-1 text-muted">Sign in to keep track of your books.</p>
          <Link
            role="menuitem"
            href={`/sign-in?next=${encodeURIComponent(pathname)}`}
            className="block rounded-lg px-3 py-2 font-semibold text-accent outline-none hover:bg-surface focus-visible:bg-surface"
          >
            Sign in
          </Link>
          <Link
            role="menuitem"
            href={`/sign-up?next=${encodeURIComponent(pathname)}`}
            className="block rounded-lg px-3 py-2 outline-none hover:bg-surface focus-visible:bg-surface"
          >
            Start your shelf
          </Link>
        </>
      ) : (
        statuses.map((s) => (
          <button
            key={s}
            role="menuitemradio"
            aria-checked={status === s}
            type="button"
            disabled={loading}
            onClick={() => onChoose(s)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left outline-none hover:bg-surface focus-visible:bg-surface disabled:pointer-events-none disabled:opacity-50"
          >
            {READING_STATUS_LABELS[s]}
            {status === s ? <span className="text-success">✓</span> : null}
          </button>
        ))
      )}
      {arrange && arrange.count > 1 ? (
        <>
          <div className="my-1 border-t border-border" />
          <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">On this shelf</p>
          {arrangeMoves.map(({ move, label }) => {
            const atStart = arrange.index === 0;
            const atEnd = arrange.index === arrange.count - 1;
            const disabled = move === "front" || move === "earlier" ? atStart : atEnd;
            return (
              <button
                key={move}
                role="menuitem"
                type="button"
                disabled={disabled}
                onClick={() => onArrange(move)}
                className="w-full rounded-lg px-3 py-2 text-left outline-none hover:bg-surface focus-visible:bg-surface disabled:pointer-events-none disabled:opacity-40"
              >
                {label}
              </button>
            );
          })}
        </>
      ) : null}
      {status ? (
        <>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            onClick={() => onChoose(null)}
            className="w-full rounded-lg px-3 py-2 text-left text-muted outline-none hover:bg-surface focus-visible:bg-surface"
          >
            Remove from my shelves
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
