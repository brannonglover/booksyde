"use client";

import { arrangeShelf, moveOnShelf, moveTo, type ShelfMove } from "@booksyde/shared";
import type { ReadingStatus } from "@booksyde/types";
import { useRouter } from "next/navigation";
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShelfBook } from "./shelf-book";
import { ShelfScroller } from "./shelf-scroller";

type Item = { id: string; title: string; cover: ReactNode };

/**
 * One of the reader's own shelves that they can put in their own order: drag a
 * book along the row, or use the "On this shelf" moves in its menu (right-click,
 * long-press or the context-menu key). The order saves as it changes, and
 * "Back to date added" drops it again.
 */
export function ArrangeableShelf({
  status,
  label,
  heading,
  items,
  arranged,
  className,
  bookClassName,
  below,
}: {
  status: ReadingStatus;
  /** The shelf's name, for the scroll buttons. */
  label: string;
  heading: ReactNode;
  items: Item[];
  /** Whether the saved order is the reader's own (else it's by date added). */
  arranged: boolean;
  className?: string;
  bookClassName?: string;
  below?: ReactNode;
}) {
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(items);
  const [isArranged, setIsArranged] = useState(arranged);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // The last order the server has, to fall back to if a save fails.
  const saved = useRef(items);
  // Saves run one after another so a quick run of moves lands in order.
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const dropped = useRef(false);
  // The book to put focus back on once a menu move has re-rendered the row.
  const refocus = useRef<string | null>(null);

  // Take the server's order whenever it changes (e.g. a book moved shelves).
  const key = items.map((i) => i.id).join();
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setOrder(items);
    setIsArranged(arranged);
  }
  useEffect(() => {
    saved.current = items;
  }, [items]);

  // Moving a focused element in the DOM drops focus; put it back on the book.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    rowRef.current?.querySelector<HTMLElement>(`[data-work-id="${id}"] a`)?.focus();
  }, [order]);

  function save(next: Item[], { reset = false } = {}) {
    const ids = next.map((i) => i.id);
    if (!reset && ids.join() === saved.current.map((i) => i.id).join()) return;
    setError(false);
    setOrder(next);
    setIsArranged(!reset);
    pending.current += 1;
    queue.current = queue.current
      .then(async () => {
        await arrangeShelf(createClient(), status, reset ? null : ids);
        saved.current = next;
      })
      .catch(() => {
        setOrder(saved.current);
        setIsArranged(arranged);
        setError(true);
      })
      .finally(() => {
        pending.current -= 1;
        // Once everything has saved, let the rest of the app catch up (e.g. "Your next read").
        if (pending.current === 0) router.refresh();
      });
  }

  function move(index: number, how: ShelfMove) {
    const next = moveOnShelf(order, index, how);
    refocus.current = order[index].id;
    save(next);
  }

  function resetOrder() {
    // Date added, newest first: the server sorts it; refresh fetches it.
    save(order, { reset: true });
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const over = (e.target as HTMLElement).closest<HTMLElement>("[data-work-id]");
    if (!over || over.dataset.workId === dragId) return;
    const from = order.findIndex((i) => i.id === dragId);
    const at = order.findIndex((i) => i.id === over.dataset.workId);
    const rect = over.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    // Where it lands once it's out of its old spot.
    const to = from < at ? (after ? at : at - 1) : after ? at + 1 : at;
    if (to !== from) setOrder(moveTo(order, from, to));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {heading}
        {isArranged ? (
          <button type="button" onClick={resetOrder} className="text-sm font-semibold text-accent hover:underline">
            Back to date added
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="status" className="text-sm text-oxblood">
          Couldn’t save that order. Try again?
        </p>
      ) : null}
      <div
        ref={rowRef}
        onDragOver={onDragOver}
        onDrop={(e) => {
          if (!dragId) return;
          // Without this, Firefox follows the dragged link.
          e.preventDefault();
          dropped.current = true;
        }}
      >
        <ShelfScroller label={label} className={className} below={below}>
          {order.map((item, index) => (
            <div
              key={item.id}
              data-work-id={item.id}
              className={`${bookClassName ?? ""} ${dragId === item.id ? "opacity-40" : ""}`}
              onDragStart={(e) => {
                dropped.current = false;
                e.dataTransfer.effectAllowed = "move";
                setDragId(item.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                // Escape, or let go off the shelf: put it back.
                if (dropped.current) save(order);
                else setOrder(saved.current);
              }}
            >
              <ShelfBook
                workId={item.id}
                title={item.title}
                status={status}
                arrange={{ index, count: order.length, onMove: (how) => move(index, how) }}
              >
                {item.cover}
              </ShelfBook>
            </div>
          ))}
        </ShelfScroller>
      </div>
    </div>
  );
}
