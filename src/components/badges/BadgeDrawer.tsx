"use client";

import { useEffect } from "react";
import type { Badge, BadgeProgress } from "@/lib/badgeSystem";
import { t, type AppLang } from "@/lib/i18n";

type BadgeDrawerProps = {
  badge: Badge | null;
  progress?: BadgeProgress;
  unlockedAt?: string;
  lang: AppLang;
  onClose: () => void;
};

function dateLabel(lang: AppLang, raw?: string) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function progressText(lang: AppLang, progress?: BadgeProgress) {
  if (!progress) return null;
  const base = lang === "en" ? progress.label : progress.labelTR;
  if (!progress.countable) return base;
  return `${progress.current} / ${progress.target} ${base}`.trim();
}

export default function BadgeDrawer({
  badge,
  progress,
  unlockedAt,
  lang,
  onClose,
}: BadgeDrawerProps) {
  useEffect(() => {
    if (!badge) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [badge, onClose]);

  if (!badge) return null;

  const ratio = Math.max(0, Math.min(1, progress?.ratio ?? (badge.unlocked ? 1 : 0)));
  const unlockedOn = dateLabel(lang, unlockedAt);
  const detailProgress = progressText(lang, progress);

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label={lang === "en" ? "Close" : "Kapat"}
      />

      <div className="absolute inset-x-3 bottom-3 mx-auto max-w-xl rounded-3xl border border-white/15 bg-[#0D0A06] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)] md:bottom-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/15"
              style={{
                background: `radial-gradient(circle at 35% 30%, #16120a 0%, #0d0a06 55%, ${badge.color}55 100%)`,
                boxShadow: `0 0 20px ${badge.color}55`,
              }}
            >
              <span className="text-[42px] leading-none">{badge.emoji}</span>
            </div>

            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.14em] text-[#A0764A]">{t(lang, "heading_badges")}</div>
              <h3 className="truncate text-xl font-semibold text-[#F5EDD8]">
                {lang === "en" ? badge.name : badge.nameTR}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] text-[#F5EDD8]"
                  style={{
                    borderColor: `${badge.color}66`,
                    backgroundColor: `${badge.color}22`,
                  }}
                >
                  {lang === "en" ? badge.tier : badge.tierTR}
                </span>
                {badge.rare ? (
                  <span className="rounded-full border border-amber-300/45 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                    {t(lang, "badges_rare").toUpperCase()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-[#F5EDD8]"
          >
            {lang === "en" ? "Close" : "Kapat"}
          </button>
        </div>

        <p className="mt-3 text-sm italic text-[#F5EDD8]">{lang === "en" ? badge.description : badge.descriptionTR}</p>
        <p className="mt-2 text-xs text-[#A0764A]">⚡ {lang === "en" ? badge.trigger : badge.triggerTR}</p>

        {!badge.unlocked ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-1 text-xs text-[#A0764A]">{t(lang, "badges_progress")}</div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/35">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, Math.round(ratio * 100))}%`, background: badge.color }}
              />
            </div>
            {detailProgress ? <div className="mt-2 text-[11px] text-[#A0764A]">{detailProgress}</div> : null}
          </div>
        ) : null}

        <div className="mt-3 text-xs text-[#A0764A]">
          {unlockedOn
            ? `${t(lang, "badges_unlocked_at")}: ${unlockedOn}`
            : badge.unlocked
            ? t(lang, "badges_unlocked")
            : t(lang, "badges_locked")}
        </div>
      </div>
    </div>
  );
}
