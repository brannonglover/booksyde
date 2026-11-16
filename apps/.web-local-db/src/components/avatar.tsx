import type { CSSProperties } from "react";

type AvatarProps = {
  name: string;
  /** The reader's photo (profiles.avatar_url). Without one, their monogram shows. */
  src?: string | null;
  /** Ink behind the monogram. */
  ink?: string | null;
  /** Size, shape, border and monogram type, e.g. "size-10 rounded-full text-xl". */
  className?: string;
  style?: CSSProperties;
};

/** A reader's photo, or the first letter of their name on their ink. Decorative: the name is always shown beside it. */
export function Avatar({ name, src, ink, className = "", style }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden font-display text-paper ${className}`}
      style={{ background: ink ?? "var(--bk-green)", ...style }}
    >
      {src ? (
        // Plain <img>: avatars are already small, square JPEGs from our own storage.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
        (name.trim() || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}
