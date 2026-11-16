"use client";

import { useState } from "react";

/** Review text; spoiler reviews stay blurred until the reader asks to see them. */
export function ReviewBody({ body, hasSpoilers }: { body: string; hasSpoilers: boolean }) {
  const [revealed, setRevealed] = useState(!hasSpoilers);
  return (
    <div className="relative">
      <p className={`whitespace-pre-line leading-[inherit] transition ${revealed ? "" : "select-none blur-[5px]"}`} aria-hidden={!revealed}>
        {body}
      </p>
      {revealed ? null : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 m-auto h-fit w-fit rounded-full border border-border bg-surface-raised px-4 py-2 text-sm font-semibold shadow-md hover:bg-surface"
        >
          Contains spoilers · Show anyway
        </button>
      )}
    </div>
  );
}
