import { BRAND } from "@/lib/brand-paths";

// Logo pieces for next/og (satori). Satori renders <svg><path>/<circle> but
// needs explicit numeric sizes and no CSS, so these are separate from Brand.tsx.

export function MarkOg({ size }: { size: number }) {
  return (
    <svg viewBox={BRAND.mark.viewBox} width={size} height={size}>
      <path d={BRAND.mark.d} fill={BRAND.coral} />
      <circle cx={BRAND.mark.dot.cx} cy={BRAND.mark.dot.cy} r={BRAND.mark.dot.r} fill={BRAND.gold} />
    </svg>
  );
}

export function WordmarkOg({ height, color = BRAND.cream }: { height: number; color?: string }) {
  const width = Math.round((height * BRAND.word.width) / BRAND.word.height);
  return (
    <svg viewBox={BRAND.word.viewBox} width={width} height={height}>
      <path d={BRAND.word.d} fill={color} />
      <g transform={`translate(${BRAND.word.qX} 0)`}>
        <path d={BRAND.mark.d} fill={BRAND.coral} />
        <circle cx={BRAND.mark.dot.cx} cy={BRAND.mark.dot.cy} r={BRAND.mark.dot.r} fill={BRAND.gold} />
      </g>
    </svg>
  );
}
