import { bowArt, christmas, hollyArt } from "@booksyde/theme";

/**
 * A small sprig of holly: two leaves in currentColor (gilt) and three red
 * berries. December's stand-in for the ❦ fleuron, and on the logo. Sized in
 * em, so set font-size. Mobile draws the same art (apps/mobile/src/components/holly.tsx).
 */
export function HollySprig({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={hollyArt.viewBox} className={`h-[1em] w-[1.75em] ${className}`}>
      <g fill="currentColor">
        {hollyArt.leaves.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill={christmas.berry}>
        {hollyArt.berries.map((b) => (
          <circle key={`${b.cx}-${b.cy}`} {...b} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Today's pick, gift-wrapped: a satin ribbon down the cover with a bow where it
 * crosses the top edge. Lies over a BookObject's cover; shown only in December.
 */
export function GiftWrap() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden christmas:block">
      <div
        className="absolute inset-y-0 left-[67%] w-[7%] shadow-[0_0_4px_rgba(31,27,22,0.35)]"
        style={{
          backgroundColor: christmas.ribbon,
          backgroundImage:
            "linear-gradient(90deg, rgba(0,0,0,0.25), rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.05) 55%, rgba(0,0,0,0.22))",
        }}
      />
      <svg
        viewBox={bowArt.viewBox}
        className="absolute top-[-10%] left-[70.5%] w-[62%] -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(31,27,22,0.35)]"
      >
        <defs>
          <linearGradient id="bow-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {bowArt.fill.map((d) => (
          <path key={d} d={d} fill={christmas.ribbon} />
        ))}
        {bowArt.shade.map((d) => (
          <path key={d} d={d} fill={christmas.ribbonShade} opacity="0.75" />
        ))}
        {bowArt.fill.map((d) => (
          <path key={`s${d}`} d={d} fill="url(#bow-sheen)" />
        ))}
        <ellipse {...bowArt.knot} fill={christmas.ribbon} />
        <ellipse {...bowArt.knot} fill="url(#bow-sheen)" />
      </svg>
    </div>
  );
}

/**
 * An evergreen garland swagged between little red bows, laid end to end along
 * an edge (the art is /garland.svg, from garlandArt in @booksyde/theme). It
 * takes up its own 60px of height, so lay it out where nothing else sits: it
 * should never hang over words. Shown only in December.
 */
export function Garland({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none z-10 hidden h-[60px] bg-[url(/garland.svg)] bg-[length:240px_60px] bg-[position:center_top] bg-repeat-x christmas:block ${className}`}
    />
  );
}
