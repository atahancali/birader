import { useId } from "react";

type FillRatio = 0 | 0.5 | 1;

function toHalfStep(value: number, max: number) {
  const clamped = Math.max(0, Math.min(max, value));
  return Math.round(clamped * 2) / 2;
}

function fillRatioAt(starIndex1: number, rating: number): FillRatio {
  const fullBefore = starIndex1 - 1;
  if (rating >= starIndex1) return 1;
  if (rating <= fullBefore) return 0;
  return 0.5;
}

function StarGlyph({
  fillRatio,
  gradientId,
  sizeClass,
}: {
  fillRatio: FillRatio;
  gradientId: string;
  sizeClass: string;
}) {
  const pct = fillRatio === 1 ? 100 : fillRatio === 0.5 ? 50 : 0;
  return (
    <svg viewBox="0 0 24 24" className={sizeClass} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset={`${pct}%`} stopColor="rgba(252, 211, 77, 0.98)" />
          <stop offset={`${pct}%`} stopColor="rgba(252, 211, 77, 0)" />
        </linearGradient>
      </defs>
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.5"
      />
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

export default function RatingStars({
  value,
  max = 5,
  size = "sm",
  unratedLabel = "—",
  className = "",
}: {
  value: number | null | undefined;
  max?: number;
  size?: "xs" | "sm" | "md";
  unratedLabel?: string;
  className?: string;
}) {
  const id = useId();
  const num = Number(value ?? 0);
  const hasRating = Number.isFinite(num) && num > 0;
  const normalized = hasRating ? toHalfStep(num, max) : 0;
  const sizeClass = size === "md" ? "h-5 w-5" : size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!hasRating) {
    return <span className={`text-xs opacity-60 ${className}`}>{unratedLabel}</span>;
  }

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${normalized} / ${max}`}>
      {Array.from({ length: max }).map((_, idx) => {
        const starIndex = idx + 1;
        const fill = fillRatioAt(starIndex, normalized);
        return <StarGlyph key={`${id}-${starIndex}`} fillRatio={fill} gradientId={`${id}-${starIndex}`} sizeClass={sizeClass} />;
      })}
    </div>
  );
}
