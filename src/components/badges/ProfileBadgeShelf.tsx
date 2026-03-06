"use client";

import Link from "next/link";
import BadgeVisual from "@/components/badges/BadgeVisual";
import type { Badge } from "@/lib/badgeSystem";

type ProfileBadgeShelfProps = {
  lang: "tr" | "en";
  badges: Badge[];
  unlockedAtById: Record<number, string>;
  className?: string;
};

export default function ProfileBadgeShelf({
  lang,
  badges,
  unlockedAtById,
  className = "",
}: ProfileBadgeShelfProps) {
  const unlockedSorted = badges
    .filter((b) => b.unlocked)
    .sort((a, b) => {
      const aTime = Date.parse(unlockedAtById[a.id] || "") || 0;
      const bTime = Date.parse(unlockedAtById[b.id] || "") || 0;
      if (aTime !== bTime) return bTime - aTime;
      return b.id - a.id;
    });

  const recent = unlockedSorted.slice(0, 5);

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${className}`.trim()}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm text-[#F5EDD8]">{lang === "en" ? "Badge Shelf" : "Rozet Rafı"}</div>
        <Link href="/badges" className="text-xs underline text-[#A0764A] underline-offset-2">
          {lang === "en"
            ? `View all ${unlockedSorted.length} badges →`
            : `Tüm ${unlockedSorted.length} rozeti gör →`}
        </Link>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {recent.length ? (
          recent.map((badge) => (
            <div
              key={`shelf-${badge.id}`}
              title={lang === "en" ? badge.name : badge.nameTR}
              className="shrink-0"
            >
              <BadgeVisual badge={badge} size={40} unlocked />
            </div>
          ))
        ) : (
          <div className="text-xs text-[#A0764A]">{lang === "en" ? "No badges yet." : "Henüz rozet yok."}</div>
        )}
      </div>
    </div>
  );
}
