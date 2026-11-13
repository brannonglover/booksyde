"use client";

import { READING_STATUS_LABELS, removeFromShelves, setReadingStatus } from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

const statuses: ReadingStatus[] = ["want_to_read", "reading", "read", "did_not_finish"];
const LONG_PRESS_MS = 500;
const MENU_WIDTH = 224;

/**
 * A book on the reader's own shelf. Right-click it, long-press it on a touch
 * screen, or press the context-menu key on it to move it to another shelf
 * without opening the book. A plain click still opens the book.
 */
export function ShelfBook({
  workId,
  title,
  status,
  className,
  children,
}: {
  workId: string;
  title: string;
  status: ReadingStatus;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  function openAt(x: number, y: number) {
    setError(false);
    setMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - 260)),
    });
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
    if (next === status) return;
    setSaving(true);
    try {
      const client = createClient();
      if (next) await setReadingStatus(client, workId, next);
      else await removeFromShelves(client, workId);
      startRefresh(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || refreshing;

  return (
    <div className={`relative ${className ?? ""}`}>
      <Link
        ref={linkRef}
        href={`/books/${workId}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        aria-busy={busy}
        className={`block select-none [-webkit-touch-callout:none] ${busy ? "pointer-events-none animate-pulse opacity-50" : ""}`}
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
      </Link>
      {error ? (
        <span role="status" className="absolute inset-x-0 bottom-1 mx-1 rounded bg-oxblood px-1 py-0.5 text-center text-[0.65rem] leading-tight text-paper">
          Couldn’t move it. Try again?
        </span>
      ) : null}
      {menu ? (
        <ShelfMenu
          x={menu.x}
          y={menu.y}
          title={title}
          status={status}
          onChoose={choose}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}

function ShelfMenu({
  x,
  y,
  title,
  status,
  onChoose,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  status: ReadingStatus;
  onChoose: (s: ReadingStatus | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? []);
    items()[0]?.focus();

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
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
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
      aria-label={`Move ${title} to a shelf`}
      className="fixed z-50 overflow-hidden rounded-xl border border-border bg-surface-raised p-1 text-sm shadow-xl"
      style={{ left: x, top: y, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="truncate px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {statuses.map((s) => (
        <button
          key={s}
          role="menuitemradio"
          aria-checked={status === s}
          type="button"
          onClick={() => onChoose(s)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left outline-none hover:bg-surface focus-visible:bg-surface"
        >
          {READING_STATUS_LABELS[s]}
          {status === s ? <span className="text-success">✓</span> : null}
        </button>
      ))}
      <div className="my-1 border-t border-border" />
      <button
        role="menuitem"
        type="button"
        onClick={() => onChoose(null)}
        className="w-full rounded-lg px-3 py-2 text-left text-muted outline-none hover:bg-surface focus-visible:bg-surface"
      >
        Remove from my shelves
      </button>
    </div>,
    document.body,
  );
}
