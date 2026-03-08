"use client";

import { useMemo, useState } from "react";
import BadgeDrawer from "@/components/badges/BadgeDrawer";
import { badgeTiers, type Badge, type BadgeProgress } from "@/lib/badgeSystem";
import { t, type AppLang } from "@/lib/i18n";

type BadgeGridProps = {
  badges: Badge[];
  progressById: Record<number, BadgeProgress>;
  unlockedAtById: Record<number, string>;
  lang: AppLang;
};

const TIER_ACCENT: Record<string, string> = {
  Achievement: "#6366F1",
};

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatUnlockedAt(raw: string | undefined, lang: AppLang) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function progressLine(progress: BadgeProgress | undefined, lang: AppLang) {
  if (!progress) return null;
  const label = lang === "en" ? progress.label : progress.labelTR;
  if (!progress.countable) return label;
  return `${progress.current} / ${progress.target} ${label}`.trim();
}

function isFreshUnlock(unlockedAt?: string) {
  if (!unlockedAt) return false;
  const ts = Date.parse(unlockedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= 1000 * 60 * 2;
}

function tierAccentColor(tier: string) {
  return TIER_ACCENT[tier] || "#F59E0B";
}

export default function BadgeGrid({
  badges,
  progressById,
  unlockedAtById,
  lang,
}: BadgeGridProps) {
  const [activeTier, setActiveTier] = useState("all");
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);

  const tiers = useMemo(() => badgeTiers(), []);
  const selectedBadge = useMemo(
    () => (selectedBadgeId === null ? null : badges.find((row) => row.id === selectedBadgeId) || null),
    [badges, selectedBadgeId]
  );

  const filtered = useMemo(() => {
    if (activeTier === "all") return badges;
    return badges.filter((row) => row.tier === activeTier);
  }, [activeTier, badges]);

  const unlockedCount = badges.filter((row) => row.unlocked).length;

  return (
    <section className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-[#F5EDD8]">{t(lang, "heading_badges")}</div>
          <div className="text-xs text-[#A0764A]">
            {t(lang, "badges_unlocked")}: {unlockedCount} • {t(lang, "badges_locked")}: {Math.max(0, badges.length - unlockedCount)}
          </div>
        </div>
      </div>

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTier("all")}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            activeTier === "all" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/10"
          }`}
        >
          {t(lang, "badges_all")}
        </button>
        {tiers.map((row) => {
          const active = activeTier === row.tier;
          const accent = tierAccentColor(row.tier);
          return (
            <button
              key={`tier-tab-${row.tier}`}
              type="button"
              onClick={() => setActiveTier(row.tier)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                active ? "" : "border-white/15 bg-white/10"
              }`}
              style={active ? { borderColor: `${accent}66`, backgroundColor: `${accent}22`, color: "#F5EDD8" } : undefined}
            >
              {lang === "en" ? row.tier : row.tierTR}
            </button>
          );
        })}
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((badge) => {
            const progress = progressById[badge.id];
            const ratio = clampRatio(progress?.ratio ?? (badge.unlocked ? 1 : 0));
            const unlockedAt = unlockedAtById[badge.id];
            const unlockedLabel = formatUnlockedAt(unlockedAt, lang);
            const progressLabel = progressLine(progress, lang);
            const freshUnlock = badge.unlocked && isFreshUnlock(unlockedAt);

            return (
              <button
                key={`badge-card-${badge.id}`}
                type="button"
                onClick={() => setSelectedBadgeId(badge.id)}
                className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                  badge.unlocked
                    ? "border-white/15 bg-white/10 hover:border-amber-300/35"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                } ${freshUnlock ? "animate-[badge-first-unlock_520ms_cubic-bezier(0.2,0.8,0.2,1)_both]" : ""}`}
              >
                {badge.rare ? <div className="pointer-events-none absolute inset-0 rounded-2xl badge-rare-ring" /> : null}

                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
                      badge.unlocked ? "border-white/20" : "border-white/10"
                    }`}
                    style={{
                      background: `radial-gradient(circle at 35% 30%, #17120b 0%, #0d0a06 62%, ${badge.color}44 100%)`,
                      filter: badge.unlocked ? `drop-shadow(0 0 14px ${badge.color}66)` : "none",
                    }}
                  >
                    <span
                      className="text-[40px] leading-none"
                      style={{
                        filter: badge.unlocked ? "none" : "grayscale(1)",
                        opacity: badge.unlocked ? 1 : 0.7,
                      }}
                    >
                      {badge.emoji}
                    </span>
                    {!badge.unlocked ? (
                      <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[10px]">
                        🔒
                      </span>
                    ) : null}
                  </div>

                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
                    style={{
                      borderColor: `${badge.color}66`,
                      backgroundColor: `${badge.color}22`,
                      color: "#F5EDD8",
                    }}
                  >
                    {lang === "en" ? badge.tier : badge.tierTR}
                  </span>
                </div>

                <div className="mt-2 line-clamp-2 text-sm font-semibold text-[#F5EDD8]">
                  {lang === "en" ? badge.name : badge.nameTR}
                </div>

                {progress ? (
                  <div className="mt-2">
                    <div className="mb-1 text-[11px] text-[#A0764A]">
                      {progressLabel}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/35">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, Math.round(ratio * 100))}%`,
                          background: badge.color,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {badge.unlocked && unlockedLabel ? (
                  <div className="mt-2 text-[11px] text-[#A0764A]">
                    {t(lang, "badges_unlocked_at")}: {unlockedLabel}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[#A0764A]">
          {t(lang, "badges_empty")}
        </div>
      )}

      <BadgeDrawer
        badge={selectedBadge}
        progress={selectedBadge ? progressById[selectedBadge.id] : undefined}
        unlockedAt={selectedBadge ? unlockedAtById[selectedBadge.id] : undefined}
        lang={lang}
        onClose={() => setSelectedBadgeId(null)}
      />
    </section>
  );
}
