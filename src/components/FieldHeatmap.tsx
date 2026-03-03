"use client";

import { gradientColor } from "@/lib/heatmapTheme";
import type { AppLang } from "@/lib/i18n";

type CheckinLite = { created_at: string; rating?: number | null };

const DOW_TR = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-first: Mon=0..Sun=6
function dowMonFirst(d: Date) {
  return (d.getDay() + 6) % 7;
}

// Week index starting from the week containing Jan 1 (0-based)
function weekIndexFromYearStart(d: Date, year: number) {
  const start = new Date(year, 0, 1);
  // normalize to noon to avoid DST weirdness
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const ss = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const diffDays = Math.floor((dd.getTime() - ss.getTime()) / 86400000);
  return Math.floor((diffDays + dowMonFirst(ss)) / 7); 
}

export default function FieldHeatmap({
  year,
  checkins,
  onSelectDay,
  readOnly = false,
  cellMetric = "color",
  colorFrom = "#f59e0b",
  colorTo = "#ef4444",
  lang = "tr",
}: {
  year: number;
  checkins: CheckinLite[];
  onSelectDay: (isoDay: string) => void;
  readOnly?: boolean;
  cellMetric?: "color" | "count" | "avgRating";
  colorFrom?: string;
  colorTo?: string;
  lang?: AppLang;
}) {
  // per-day stats
  const dayStats: Record<string, { count: number; ratingSum: number; ratingCount: number }> = {};
  for (const c of checkins) {
    const day = c.created_at?.slice(0, 10) || isoLocal(new Date(c.created_at));
    const stat = dayStats[day] || { count: 0, ratingSum: 0, ratingCount: 0 };
    stat.count += 1;
    const rating = Number(c.rating);
    if (Number.isFinite(rating) && rating > 0) {
      stat.ratingSum += rating;
      stat.ratingCount += 1;
    }
    dayStats[day] = stat;
  }

  // Build all days of year
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  // compute max week index
  const maxWeek = weekIndexFromYearStart(end, year);

  // grid: 7 rows (dow), (maxWeek+1) cols
  const grid: (string | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: maxWeek + 1 }, () => null)
  );

  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
       d <= end;
       d.setDate(d.getDate() + 1)) {
    const iso = isoLocal(d);
    const row = dowMonFirst(d);          // 0..6
    const col = weekIndexFromYearStart(d, year); // 0..maxWeek
    grid[row][col] = iso;
  }

  const cellSize = cellMetric === "color" ? 18 : 26;
  const todayIso = isoLocal(new Date());
  const showCurrentWeek = new Date().getFullYear() === year;
  const currentWeek = showCurrentWeek ? weekIndexFromYearStart(new Date(), year) + 1 : null;
  const statRows = Object.values(dayStats);
  const activeDays = statRows.filter((s) => s.count > 0).length;
  const maxDailyCount = statRows.reduce((m, s) => Math.max(m, s.count), 0);
  const ratedAgg = statRows.reduce(
    (acc, s) => ({ ratingSum: acc.ratingSum + s.ratingSum, ratingCount: acc.ratingCount + s.ratingCount }),
    { ratingSum: 0, ratingCount: 0 }
  );
  const avgRated = ratedAgg.ratingCount > 0 ? Math.round((ratedAgg.ratingSum / ratedAgg.ratingCount) * 100) / 100 : 0;
  const totalDaysInYear = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const fillRate = totalDaysInYear > 0 ? Math.round((activeDays / totalDaysInYear) * 100) : 0;
  const legendStops = [0, 0.25, 0.5, 0.75, 1];

  const dow = lang === "en" ? DOW_EN : DOW_TR;
  return (
    <div className="mt-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm opacity-80">{lang === "en" ? "Heatmap" : "Isı haritası"}</div>
          <div className="text-xl font-bold">{year}</div>
        </div>
        <div className="text-xs opacity-60">
          {cellMetric === "avgRating"
            ? lang === "en"
              ? "Daily average rating"
              : "Günlük ortalama puan"
            : lang === "en"
            ? "Daily beer count"
            : "Günlük bira sayısı"}
          {currentWeek ? ` • ${lang === "en" ? "Week" : "Hafta"} ${currentWeek}` : ""}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_220px] xl:items-start">
        {/* horizontal scroll "field" */}
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            {/* labels */}
            <div className="grid grid-cols-[40px_1fr] gap-3">
              <div className="pt-1">
                {dow.map((d) => (
                  <div key={d} className="text-[11px] opacity-60 flex items-center" style={{ height: `${cellSize + 2}px` }}>
                    {d}
                  </div>
                ))}
              </div>

              <div>
                <div
                  className="mb-1 grid min-w-max gap-0.5 text-[10px] opacity-55"
                  style={{ gridTemplateColumns: `repeat(${maxWeek + 1}, ${cellSize}px)` }}
                >
                  {Array.from({ length: maxWeek + 1 }).map((_, col) => (
                    <div key={`wk-${col}`} className="text-center">
                      {col % 4 === 0 ? col + 1 : ""}
                    </div>
                  ))}
                </div>
                {/* actual grid */}
                <div
                  className="grid min-w-max"
                  style={{ gridTemplateColumns: `repeat(${maxWeek + 1}, ${cellSize}px)` }}
                >
                  {Array.from({ length: maxWeek + 1 }).map((_, col) => (
                    <div key={col} className="grid grid-rows-7 gap-1">
                      {Array.from({ length: 7 }).map((_, row) => {
                        const iso = grid[row][col];
                        const stat = iso ? dayStats[iso] : undefined;
                        const count = stat?.count || 0;
                        const isFuture = !!iso && iso > todayIso;
                        const avgRating =
                          stat && stat.ratingCount > 0 ? Math.round((stat.ratingSum / stat.ratingCount) * 10) / 10 : null;
                        const colorRatio =
                          cellMetric === "avgRating"
                            ? Math.min(1, Math.max(0, (avgRating ?? 0) / 5))
                            : Math.min(1, count / 5);
                        const textValue =
                          cellMetric === "count"
                            ? String(count)
                            : cellMetric === "avgRating"
                            ? avgRating === null
                              ? "-"
                              : avgRating.toFixed(1)
                            : "";

                        return (
                          <button
                            key={`${row}-${col}`}
                            disabled={!iso || isFuture || readOnly}
                            onClick={() => !readOnly && iso && !isFuture && onSelectDay(iso)}
                            title={
                              iso
                                ? lang === "en"
                                  ? `${iso} • Week ${col + 1} • ${count} beers${avgRating === null ? "" : ` • ${avgRating.toFixed(1)}⭐ avg`}${isFuture ? " • Future (locked)" : ""}`
                                  : `${iso} • Hafta ${col + 1} • ${count} bira${avgRating === null ? "" : ` • ${avgRating.toFixed(1)}⭐ ort.`}${isFuture ? " • Gelecek (kilitli)" : ""}`
                                : ""
                            }
                            className={[
                              "rounded border border-white/10 text-[10px] font-semibold",
                              iso ? "" : "bg-transparent border-transparent",
                              iso && count > 0 && cellMetric !== "color" ? "text-white/90" : "text-white/0",
                              isFuture ? "opacity-70" : "",
                              iso && !readOnly && !isFuture ? "active:scale-[0.98]" : "",
                            ].join(" ")}
                            style={{
                              height: `${cellSize}px`,
                              width: `${cellSize}px`,
                              backgroundColor:
                                !iso
                                  ? "rgba(255,255,255,0.06)"
                                  : isFuture
                                  ? "rgba(255,255,255,0.025)"
                                  : count <= 0
                                  ? "rgba(255,255,255,0.035)"
                                  : gradientColor(colorFrom, colorTo, colorRatio, 0.9),
                              borderColor:
                                !iso
                                  ? "rgba(255,255,255,0.03)"
                                  : isFuture
                                  ? "rgba(255,255,255,0.05)"
                                  : count <= 0
                                  ? "rgba(255,255,255,0.12)"
                                  : "rgba(255,255,255,0.16)",
                              boxShadow:
                                iso && count <= 0 && !isFuture
                                  ? "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.35)"
                                  : "none",
                              backgroundImage:
                                iso && count <= 0 && !isFuture
                                  ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 0.8px, transparent 1px), linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0))"
                                  : "none",
                              backgroundSize: iso && count <= 0 && !isFuture ? "6px 6px, 100% 100%" : "auto",
                            }}
                          >
                            {iso && count > 0 && cellMetric !== "color" ? textValue : ""}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs opacity-60">
              {readOnly
                ? lang === "en"
                  ? "Tip: scroll right."
                  : "İpucu: sağa kaydır."
                : lang === "en"
                ? "Tip: scroll right. Tap cell for day details."
                : "İpucu: sağa kaydır. Hücreye dokun → gün detayı."}
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] opacity-70">{lang === "en" ? "Legend" : "Lejant"}</div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1">
              {legendStops.map((t) => (
                <div
                  key={`legend-${t}`}
                  className="h-3 flex-1 rounded border border-white/10"
                  style={{ backgroundColor: t === 0 ? "rgba(255,255,255,0.035)" : gradientColor(colorFrom, colorTo, t, 0.9) }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] opacity-65">
              <span>{lang === "en" ? "Low" : "Dusuk"}</span>
              <span>{lang === "en" ? "High" : "Yuksek"}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-70">{lang === "en" ? "Active days" : "Aktif gun"}</span>
                <span className="font-semibold">{activeDays}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="opacity-70">{lang === "en" ? "Fill rate" : "Dolu oran"}</span>
                <span className="font-semibold">%{fillRate}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="opacity-70">{lang === "en" ? "Peak day" : "Zirve gun"}</span>
                <span className="font-semibold">{maxDailyCount}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="opacity-70">{lang === "en" ? "Avg rating" : "Ort. puan"}</span>
                <span className="font-semibold">{avgRated.toFixed(2)}⭐</span>
              </div>
            </div>
            <div className="space-y-1 text-[10px] opacity-70">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded border border-white/20 bg-white/5" />
                <span>{lang === "en" ? "Future day (locked)" : "Gelecek gun (kilitli)"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded border border-white/20"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 0.8px, transparent 1px)",
                    backgroundSize: "6px 6px",
                    backgroundColor: "rgba(255,255,255,0.035)",
                  }}
                />
                <span>{lang === "en" ? "No log on day" : "Bu gunde log yok"}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
