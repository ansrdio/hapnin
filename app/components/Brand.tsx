import { BRAND } from "@/lib/brand-paths";

// The Hapnin logo as inline SVG (outlines, no font dependency).
//   <Wordmark />  "hapnin?" — the word takes currentColor, the ? is coral, its dot gold.
//   <Mark />      the ? alone, for tight spots.
// Both are plain server-safe components; the satori (OG/icon) variants live in
// app/components/BrandOg.tsx because next/og needs explicit pixel sizes.

export function Wordmark({ height = 28, className = "", title = "Hapnin" }: { height?: number; className?: string; title?: string }) {
  const width = (height * BRAND.word.width) / BRAND.word.height;
  return (
    <svg viewBox={BRAND.word.viewBox} width={width} height={height} className={className} role="img" aria-label={title}>
      <path d={BRAND.word.d} fill="currentColor" />
      <g transform={`translate(${BRAND.word.qX} 0)`}>
        <path d={BRAND.mark.d} fill={BRAND.coral} />
        <circle cx={BRAND.mark.dot.cx} cy={BRAND.mark.dot.cy} r={BRAND.mark.dot.r} fill={BRAND.gold} />
      </g>
    </svg>
  );
}

export function Mark({ size = 32, className = "", title = "Hapnin" }: { size?: number; className?: string; title?: string }) {
  return (
    <svg viewBox={BRAND.mark.viewBox} width={size} height={size} className={className} role="img" aria-label={title}>
      <path d={BRAND.mark.d} fill={BRAND.coral} />
      <circle cx={BRAND.mark.dot.cx} cy={BRAND.mark.dot.cy} r={BRAND.mark.dot.r} fill={BRAND.gold} />
    </svg>
  );
}
