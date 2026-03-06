"use client";

import type { Badge } from "@/lib/badgeSystem";

type BadgeVisualProps = {
  badge: Badge;
  size?: 40 | 72 | 120 | number;
  unlocked: boolean;
  animateUnlock?: boolean;
  className?: string;
};

export default function BadgeVisual({
  badge,
  size = 72,
  unlocked,
  animateUnlock = false,
  className = "",
}: BadgeVisualProps) {
  const ringColor = badge.color || "#f59e0b";
  const id = `badge-grad-${badge.id}-${size}`;

  return (
    <div
      className={`badge-medallion ${badge.rare ? "badge-rare" : ""} ${animateUnlock ? "badge-pop" : ""} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        filter: unlocked
          ? `drop-shadow(0 0 ${Math.max(8, size * 0.15)}px ${ringColor}55)`
          : "grayscale(1) opacity(0.72)",
      }}
      aria-label={badge.name}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={id} cx="50%" cy="42%" r="66%">
            <stop offset="0%" stopColor="#120e08" />
            <stop offset="55%" stopColor="#19120a" />
            <stop offset="100%" stopColor={`${ringColor}66`} />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="45" fill={`url(#${id})`} stroke={`${ringColor}${unlocked ? "ee" : "55"}`} strokeWidth="3" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(245,237,216,0.18)" strokeWidth="1.2" />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[42%] leading-none">
        <span>{badge.emoji}</span>
      </div>

      {!unlocked ? (
        <div className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-[34%] w-[34%] items-center justify-center rounded-full border border-white/20 bg-black/75 text-[42%]">
          🔒
        </div>
      ) : null}

      {badge.rare && unlocked ? <div className="badge-shimmer" aria-hidden="true" /> : null}
    </div>
  );
}
