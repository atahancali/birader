"use client";

import BadgeVisual from "@/components/badges/BadgeVisual";
import type { Badge, BadgeProgress } from "@/lib/badgeSystem";

type BadgeDetailSheetProps = {
  badge: Badge | null;
  progress?: BadgeProgress;
  unlockedAt?: string;
  lang: "tr" | "en";
  open: boolean;
  onClose: () => void;
};

export default function BadgeDetailSheet({
  badge,
  progress,
  unlockedAt,
  lang,
  open,
  onClose,
}: BadgeDetailSheetProps) {
  if (!open || !badge) return null;

  const ratio = Math.max(0, Math.min(1, progress?.ratio ?? (badge.unlocked ? 1 : 0)));
  const dateLabel = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label={lang === "en" ? "Close" : "Kapat"}
      />

      <div className="absolute inset-x-3 bottom-3 mx-auto max-w-xl rounded-3xl border border-white/15 bg-[#0D0A06] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.65)] md:bottom-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#A0764A]">{lang === "en" ? "Badge" : "Rozet"}</div>
            <h3 className="mt-1 text-xl font-semibold text-[#F5EDD8]">
              {lang === "en" ? badge.name : badge.nameTR}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-[#F5EDD8]"
          >
            {lang === "en" ? "Close" : "Kapat"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <BadgeVisual badge={badge} size={120} unlocked={badge.unlocked} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-[#F5EDD8]">
                {lang === "en" ? badge.tier : badge.tierTR}
              </span>
              {badge.rare ? (
                <span className="rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  RARE
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm italic text-[#F5EDD8]">
              {lang === "en" ? badge.description : badge.descriptionTR}
            </p>
            <p className="mt-2 text-xs text-[#A0764A]">
              ⚡ {lang === "en" ? badge.trigger : badge.triggerTR}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-[#A0764A]">
            <span>{lang === "en" ? "Progress" : "İlerleme"}</span>
            {progress ? (
              <span>
                {progress.current} / {progress.target}
              </span>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, Math.round(ratio * 100))}%`, background: badge.color }}
            />
          </div>
          <div className="mt-2 text-[11px] text-[#A0764A]">
            {badge.unlocked
              ? dateLabel
                ? lang === "en"
                  ? `Unlocked on ${dateLabel}`
                  : `Kazanılma tarihi: ${dateLabel}`
                : lang === "en"
                ? "Unlocked"
                : "Kazanıldı"
              : lang === "en"
              ? "Locked"
              : "Kilitli"}
          </div>
        </div>
      </div>
    </div>
  );
}
