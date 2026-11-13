import { mixHex, palette } from "@booksyde/theme";
import type { Database } from "@booksyde/types";
import Image from "next/image";
import type { ReactNode } from "react";
import { type BackdropTag, MotifArt, type Motif, motifFor } from "./motifs";

/*
 * The scene drawn behind a featured book. A book can ask for a style
 * (works.backdrop_style); otherwise it gets the richest one it has data for:
 *
 *   generated image → setting scene → genre motif → blurred cover
 *
 * Generated images and setting scenes aren't built yet, so asking for them
 * falls through to the next style down. The blurred cover always works: with
 * no cover art it's the cover colour (or bottle green).
 */

export type BackdropStyle = Database["public"]["Enums"]["backdrop_style"];
export type Backdrop = { style: "cover" } | { style: "motif"; motif: Motif };

export type BackdropWork = {
  title: string;
  cover_url: string | null;
  cover_color: string | null;
  /** Null (or missing, before the migration) means auto. */
  backdrop_style?: BackdropStyle | null;
  tags: BackdropTag[];
};

export function resolveBackdrop(work: BackdropWork): Backdrop {
  const motif = motifFor(work.tags);
  if (work.backdrop_style === "cover") return { style: "cover" };
  // "motif", "setting", "generated" and auto all land here until the richer styles exist.
  return motif ? { style: "motif", motif } : { style: "cover" };
}

/** Fills its (relatively positioned) parent. Pass `backdrop` to force a style, e.g. in the preview page. */
export function BookBackdrop({ work, backdrop = resolveBackdrop(work) }: { work: BackdropWork; backdrop?: Backdrop }) {
  if (backdrop.style === "motif") return <MotifArt motif={backdrop.motif} tint={work.cover_color} />;
  return <BlurredCover work={work} />;
}

function BlurredCover({ work }: { work: BackdropWork }) {
  const cloth = mixHex(work.cover_color ?? palette.green, palette.ink, 0.35);
  return (
    <div aria-hidden className="absolute inset-0" style={{ background: cloth }}>
      {work.cover_url ? (
        // Blurred to mush anyway, so a thumbnail-sized image is plenty. Scaled well past the
        // edges because a blur fades the image's own borders to transparent.
        <Image src={work.cover_url} alt="" fill sizes="96px" className="scale-[1.6] object-cover blur-2xl saturate-150" />
      ) : null}
      <div className="absolute inset-0 bg-ink/20" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 55% at 50% 55%, transparent, rgba(31,27,22,0.35))" }}
      />
    </div>
  );
}

/** The featured-book stage: a rounded panel with the backdrop behind and the cover on top. */
export function BackdropStage({
  work,
  backdrop,
  cover,
  className = "",
}: {
  work: BackdropWork;
  backdrop?: Backdrop;
  cover: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[28px] shadow-[0_24px_60px_-30px_rgba(31,27,22,0.6)] ring-1 ring-black/5 ${className}`}
    >
      <BookBackdrop work={work} backdrop={backdrop} />
      {cover}
    </div>
  );
}

export { type Motif, motifLabels, motifs, motifFor } from "./motifs";
