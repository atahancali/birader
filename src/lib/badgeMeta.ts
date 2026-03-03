export type BadgeThreshold = {
  minTotal: number;
  minSpecific: number;
  minShare?: number;
};

export const BADGE_THRESHOLDS = {
  sat_committee: { minTotal: 12, minSpecific: 5, minShare: 0.35 },
  night_owl: { minTotal: 12, minSpecific: 6, minShare: 0.35 },
  draft_loyalist: { minTotal: 12, minSpecific: 7, minShare: 0.55 },
  bottle_lover: { minTotal: 12, minSpecific: 7, minShare: 0.55 },
  nomad: { minTotal: 0, minSpecific: 5 },
  regular: { minTotal: 15, minSpecific: 9, minShare: 0.45 },
} as const satisfies Record<string, BadgeThreshold>;

export type BadgeMeta = {
  icon: string;
  colorFrom: string;
  colorTo: string;
  ruleTr: string;
  ruleEn: string;
};

const BADGE_META_MAP: Record<string, BadgeMeta> = {
  sat_committee: {
    icon: "📆",
    colorFrom: "#f59e0b",
    colorTo: "#ef4444",
    ruleTr: "En az 12 log + en az 5 Cumartesi logu + %35 Cumartesi payi.",
    ruleEn: "At least 12 logs + at least 5 Saturday logs + 35% Saturday share.",
  },
  night_owl: {
    icon: "🌙",
    colorFrom: "#6366f1",
    colorTo: "#8b5cf6",
    ruleTr: "En az 12 log + en az 6 gece logu + %35 gece payi.",
    ruleEn: "At least 12 logs + at least 6 night logs + 35% night share.",
  },
  draft_loyalist: {
    icon: "🍺",
    colorFrom: "#f59e0b",
    colorTo: "#f97316",
    ruleTr: "En az 12 log + en az 7 fici logu + %55 fici orani.",
    ruleEn: "At least 12 logs + at least 7 draft logs + 55% draft ratio.",
  },
  bottle_lover: {
    icon: "🧴",
    colorFrom: "#10b981",
    colorTo: "#14b8a6",
    ruleTr: "En az 12 log + en az 7 sise/kutu logu + %55 oran.",
    ruleEn: "At least 12 logs + at least 7 bottle/can logs + 55% ratio.",
  },
  nomad: {
    icon: "🧭",
    colorFrom: "#3b82f6",
    colorTo: "#06b6d4",
    ruleTr: "En az 5 farkli sehirde log.",
    ruleEn: "Logs from at least 5 different cities.",
  },
  regular: {
    icon: "🏠",
    colorFrom: "#ef4444",
    colorTo: "#f97316",
    ruleTr: "En az 15 log + ayni bolgede en az 9 log + %45 pay.",
    ruleEn: "At least 15 logs + at least 9 logs in same area + 45% share.",
  },
  sat: {
    icon: "📆",
    colorFrom: "#f59e0b",
    colorTo: "#ef4444",
    ruleTr: "Cumartesi agirlikli kullanim.",
    ruleEn: "Saturday-heavy usage.",
  },
  streak7: {
    icon: "🔥",
    colorFrom: "#ef4444",
    colorTo: "#f59e0b",
    ruleTr: "Uzun aktif streak.",
    ruleEn: "Long active streak.",
  },
  weekend: {
    icon: "🎉",
    colorFrom: "#8b5cf6",
    colorTo: "#ec4899",
    ruleTr: "Hafta sonu yogunlugu yuksek.",
    ruleEn: "High weekend concentration.",
  },
  night: {
    icon: "🌙",
    colorFrom: "#6366f1",
    colorTo: "#8b5cf6",
    ruleTr: "Gece saatlerinde yogun aktivite.",
    ruleEn: "High activity at night hours.",
  },
  explorer: {
    icon: "🗺️",
    colorFrom: "#3b82f6",
    colorTo: "#06b6d4",
    ruleTr: "Sehir cesitliligi yuksek.",
    ruleEn: "High city variety.",
  },
  local: {
    icon: "📍",
    colorFrom: "#22c55e",
    colorTo: "#84cc16",
    ruleTr: "Ayni bolgede yogun kullanim.",
    ruleEn: "Dense usage in a single area.",
  },
};

export function badgeMetaForKey(key: string): BadgeMeta {
  return (
    BADGE_META_MAP[key] || {
      icon: "🏅",
      colorFrom: "#f59e0b",
      colorTo: "#ef4444",
      ruleTr: "Rozet kurali yakinda detaylanacak.",
      ruleEn: "Badge rule details will be refined soon.",
    }
  );
}

