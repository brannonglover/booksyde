import { leafArt } from "@booksyde/theme";

/**
 * A single maple leaf in currentColor, sized in em (set font-size): November's
 * stand-in for the ❦ fleuron, and on the logo. Mobile draws the same leaf
 * (apps/mobile/src/components/leaves.tsx).
 */
export function MapleLeaf({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={leafArt.viewBox} className={`size-[1em] ${className}`} fill="currentColor">
      <path d={leafArt.maple} />
    </svg>
  );
}

/**
 * Fallen autumn leaves scattered along an edge (the art is /leaves.svg, from
 * leavesArt in @booksyde/theme). Takes its own 40px of height, so lay it out
 * where nothing else sits; shown only in November.
 */
export function LeafStrip({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none hidden h-[40px] bg-[url(/leaves.svg)] bg-[length:240px_40px] bg-[position:center_top] bg-repeat-x thanksgiving:block ${className}`}
    />
  );
}
