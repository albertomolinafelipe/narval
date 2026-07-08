import { SiInstagram } from "react-icons/si";

// The Instagram glyph painted in Instagram's brand gradient. Used as the
// "verified Instagram" signal (in socials, list rows, and the verify button),
// so the coloured icon itself conveys verification — no separate badge needed.
//
// The gradient is defined inline; duplicate defs with the same id across
// instances are harmless (fill: url(#ig-gradient) resolves to the first).
export function InstagramGradientIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <>
      <svg width={0} height={0} className="absolute" aria-hidden>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </svg>
      <SiInstagram
        size={size}
        className={className}
        style={{ fill: "url(#ig-gradient)" }}
      />
    </>
  );
}
