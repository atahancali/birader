export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

export const DAY_PERIOD_OPTIONS: Array<{ value: DayPeriod; tr: string; en: string }> = [
  { value: "morning", tr: "Sabah", en: "Morning" },
  { value: "afternoon", tr: "Öğleden sonra", en: "Afternoon" },
  { value: "evening", tr: "Akşam", en: "Evening" },
  { value: "night", tr: "Gece", en: "Night" },
];

export function inferDayPeriodFromDate(dateLike: string | Date): DayPeriod {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const h = d.getHours();
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 23) return "evening";
  return "night";
}

export function dayPeriodLabelTr(period?: string | null, fallbackDate?: string): string {
  const p = (period || "").trim().toLowerCase();
  if (p === "morning") return "Sabah";
  if (p === "afternoon") return "Öğleden sonra";
  if (p === "evening") return "Akşam";
  if (p === "night") return "Gece";
  if (fallbackDate) return dayPeriodLabelTr(inferDayPeriodFromDate(fallbackDate));
  return "Belirsiz";
}

export function dayPeriodLabelEn(period?: string | null, fallbackDate?: string): string {
  const p = (period || "").trim().toLowerCase();
  if (p === "morning") return "Morning";
  if (p === "afternoon") return "Afternoon";
  if (p === "evening") return "Evening";
  if (p === "night") return "Night";
  if (fallbackDate) return dayPeriodLabelEn(inferDayPeriodFromDate(fallbackDate));
  return "Unknown";
}
