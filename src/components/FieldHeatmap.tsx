"use client";

import { memo, useEffect, useMemo, useState } from "react";
import RatingStars from "@/components/RatingStars";
import { gradientColor } from "@/lib/heatmapTheme";
import type { AppLang } from "@/lib/i18n";

type CheckinLite = { created_at: string; rating?: number | null };
type DayStat = { count: number; ratingSum: number; ratingCount: number };

const DOW_TR = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS_TR = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEGEND_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

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

function FieldHeatmap({
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
  const { dayStats, grid, maxWeek, colMonthMap, statRows, totalDaysInYear, weekCountsByCol } = useMemo(() => {
    const nextDayStats: Record<string, DayStat> = {};
    for (const c of checkins) {
      const day = c.created_at?.slice(0, 10) || isoLocal(new Date(c.created_at));
      const stat = nextDayStats[day] || { count: 0, ratingSum: 0, ratingCount: 0 };
      stat.count += 1;
      const rating = Number(c.rating);
      if (Number.isFinite(rating) && rating > 0) {
        stat.ratingSum += rating;
        stat.ratingCount += 1;
      }
      nextDayStats[day] = stat;
    }

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const maxWeek = weekIndexFromYearStart(end, year);
    const grid: (string | null)[][] = Array.from({ length: 7 }, () => Array.from({ length: maxWeek + 1 }, () => null));

    for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      const row = dowMonFirst(d);
      const col = weekIndexFromYearStart(d, year);
      grid[row][col] = iso;
    }

    const colMonthMap = Array.from({ length: maxWeek + 1 }).map((_, col) => {
      for (let row = 0; row < 7; row += 1) {
        const iso = grid[row][col];
        if (iso) return Number(iso.slice(5, 7)) - 1;
      }
      return -1;
    });

    const weekCountsByCol = Array.from({ length: maxWeek + 1 }).map((_, col) =>
      Array.from({ length: 7 }).map((__, row) => {
        const iso = grid[row][col];
        if (!iso) return 0;
        return nextDayStats[iso]?.count || 0;
      })
    );
    const statRows = Object.values(nextDayStats);
    const totalDaysInYear = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    return {
      dayStats: nextDayStats,
      grid,
      maxWeek,
      colMonthMap,
      statRows,
      totalDaysInYear,
      weekCountsByCol,
    };
  }, [checkins, year]);

  const [accessiblePalette, setAccessiblePalette] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusMonth, setFocusMonth] = useState<number>(new Date().getFullYear() === year ? new Date().getMonth() : 0);
  const [hoverCell, setHoverCell] = useState<{
    iso: string;
    col: number;
    count: number;
    avgRating: number | null;
    weekCounts: number[];
  } | null>(null);

  useEffect(() => {
    if (!focusMode) return;
    const next = new Date().getFullYear() === year ? new Date().getMonth() : 0;
    setFocusMonth(next);
  }, [focusMode, year]);

  const cellSize = cellMetric === "color" ? 18 : 26;
  const todayIso = isoLocal(new Date());
  const showCurrentWeek = new Date().getFullYear() === year;
  const currentWeek = showCurrentWeek ? weekIndexFromYearStart(new Date(), year) + 1 : null;
  const paletteFrom = accessiblePalette ? "#2563eb" : colorFrom;
  const paletteTo = accessiblePalette ? "#f97316" : colorTo;
  const monthLabels = lang === "en" ? MONTHS_EN : MONTHS_TR;
  const visibleWeekCount = colMonthMap.filter((m) => !focusMode || m === focusMonth).length;
  const activeDays = statRows.filter((s) => s.count > 0).length;
  const maxDailyCount = statRows.reduce((m, s) => Math.max(m, s.count), 0);
  const ratedAgg = statRows.reduce(
    (acc, s) => ({ ratingSum: acc.ratingSum + s.ratingSum, ratingCount: acc.ratingCount + s.ratingCount }),
    { ratingSum: 0, ratingCount: 0 }
  );
  const avgRated = ratedAgg.ratingCount > 0 ? Math.round((ratedAgg.ratingSum / ratedAgg.ratingCount) * 100) / 100 : 0;
  const fillRate = totalDaysInYear > 0 ? Math.round((activeDays / totalDaysInYear) * 100) : 0;

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

      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
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

              <div className="relative">
                {hoverCell ? (
                  <div
                    className="pointer-events-none absolute z-20 w-44 rounded-xl border border-white/15 bg-black/90 p-2 text-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                    style={{
                      left: `${Math.max(4, Math.min(96, ((hoverCell.col + 1) / (maxWeek + 1)) * 100))}%`,
                      top: "-94px",
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="font-semibold">{hoverCell.iso}</div>
                    <div className="mt-0.5 opacity-75">
                      {lang === "en"
                        ? `${hoverCell.count} beers • ${hoverCell.avgRating === null ? "unrated" : `${hoverCell.avgRating.toFixed(1)}⭐ avg`}`
                        : `${hoverCell.count} bira • ${hoverCell.avgRating === null ? "puansiz" : `${hoverCell.avgRating.toFixed(1)}⭐ ort.`}`}
                    </div>
                    <div className="mt-1 flex h-7 items-end gap-[2px]">
                      {hoverCell.weekCounts.map((v, idx) => {
                        const maxVal = Math.max(1, ...hoverCell.weekCounts);
                        const h = v <= 0 ? 4 : Math.max(6, Math.round((v / maxVal) * 26));
                        return (
                          <div
                            key={`tt-w-${idx}`}
                            className="w-2 rounded-sm"
                            style={{
                              height: `${h}px`,
                              backgroundColor: v <= 0 ? "rgba(255,255,255,0.14)" : gradientColor(paletteFrom, paletteTo, Math.min(1, v / 5), 0.95),
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div
                  className="mb-1 grid min-w-max gap-0.5 text-[10px] opacity-55"
                  style={{ gridTemplateColumns: `repeat(${maxWeek + 1}, ${cellSize}px)` }}
                >
                  {Array.from({ length: maxWeek + 1 }).map((_, col) => (
                    <div
                      key={`wk-${col}`}
                      className={`text-center ${focusMode && colMonthMap[col] !== focusMonth ? "opacity-20" : "opacity-90"}`}
                    >
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
                    <div
                      key={col}
                      className={`grid grid-rows-7 gap-1 ${
                        focusMode && colMonthMap[col] !== focusMonth ? "opacity-35" : "opacity-100"
                      }`}
                    >
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
                        const cellLabel =
                          isFuture
                            ? "🔒"
                            : iso && count > 0 && cellMetric !== "color"
                            ? textValue
                            : "";
                        const isOutOfFocus = focusMode && iso && colMonthMap[col] !== focusMonth;
                        const radiusPx = !iso ? 6 : count <= 0 ? 6 : Math.round(5 + colorRatio * 9);
                        const weekCounts = weekCountsByCol[col] || [0, 0, 0, 0, 0, 0, 0];

                        return (
                          <button
                            key={`${row}-${col}`}
                            disabled={!iso || isFuture || readOnly}
                            onClick={() => !readOnly && iso && !isFuture && onSelectDay(iso)}
                            onMouseEnter={() => {
                              if (!iso) return;
                              setHoverCell({ iso, col, count, avgRating, weekCounts });
                            }}
                            onMouseLeave={() => setHoverCell(null)}
                            onFocus={() => {
                              if (!iso) return;
                              setHoverCell({ iso, col, count, avgRating, weekCounts });
                            }}
                            onBlur={() => setHoverCell(null)}
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
                              isFuture
                                ? "text-white/45"
                                : iso && count > 0 && cellMetric !== "color"
                                ? "text-white/90"
                                : "text-white/0",
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
                                  ? "rgba(15,15,15,0.82)"
                                  : count <= 0
                                  ? "rgba(255,255,255,0.035)"
                                  : gradientColor(paletteFrom, paletteTo, colorRatio, 0.9),
                              borderColor:
                                !iso
                                  ? "rgba(255,255,255,0.03)"
                                  : isFuture
                                  ? "rgba(245,158,11,0.22)"
                                  : count <= 0
                                  ? "rgba(255,255,255,0.12)"
                                  : "rgba(255,255,255,0.16)",
                              boxShadow:
                                isFuture
                                  ? "inset 0 0 0 1px rgba(245,158,11,0.1), inset 0 1px 0 rgba(255,255,255,0.03)"
                                  : iso && count <= 0
                                  ? "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.35)"
                                  : "none",
                              backgroundImage:
                                isFuture
                                  ? "repeating-linear-gradient(135deg, rgba(245,158,11,0.16) 0, rgba(245,158,11,0.16) 1px, transparent 1px, transparent 5px)"
                                  : iso && count <= 0
                                  ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 0.8px, transparent 1px), linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0))"
                                  : "none",
                              backgroundSize:
                                isFuture
                                  ? "6px 6px"
                                  : iso && count <= 0
                                  ? "6px 6px, 100% 100%"
                                  : "auto",
                              borderRadius: `${radiusPx}px`,
                              filter: isOutOfFocus ? "saturate(0.65) brightness(0.82)" : "none",
                            }}
                          >
                            {cellLabel}
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
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="text-[10px] opacity-70">{lang === "en" ? "Palette mode" : "Palet modu"}</div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setAccessiblePalette(false)}
                  className={`rounded-md border px-2 py-1 text-[10px] ${
                    !accessiblePalette ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  {lang === "en" ? "Default" : "Standart"}
                </button>
                <button
                  type="button"
                  onClick={() => setAccessiblePalette(true)}
                  className={`rounded-md border px-2 py-1 text-[10px] ${
                    accessiblePalette ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  {lang === "en" ? "Colorblind" : "Renk dostu"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="opacity-70">{lang === "en" ? "Focus mode" : "Odak modu"}</span>
                <button
                  type="button"
                  onClick={() => setFocusMode((v) => !v)}
                  className={`rounded-md border px-2 py-0.5 ${
                    focusMode ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  {focusMode ? (lang === "en" ? "On" : "Acik") : (lang === "en" ? "Off" : "Kapali")}
                </button>
              </div>
              {focusMode ? (
                <div className="mt-1">
                  <select
                    value={focusMonth}
                    onChange={(e) => setFocusMonth(Number(e.target.value))}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-[10px] outline-none"
                  >
                    {monthLabels.map((m, i) => (
                      <option key={`focus-month-${m}`} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] opacity-65">
                    {lang === "en" ? `${visibleWeekCount} weeks visible` : `${visibleWeekCount} hafta gorunur`}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1">
                {LEGEND_STOPS.map((t) => (
                  <div
                    key={`legend-${t}`}
                    className="h-3 flex-1 rounded border border-white/10"
                    style={{ backgroundColor: t === 0 ? "rgba(255,255,255,0.035)" : gradientColor(paletteFrom, paletteTo, t, 0.9) }}
                  />
                ))}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] opacity-65">
                <span>{lang === "en" ? "Low" : "Dusuk"}</span>
                <span>{lang === "en" ? "High" : "Yuksek"}</span>
              </div>
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
                <RatingStars
                  value={avgRated > 0 ? avgRated : null}
                  size="xs"
                  unratedLabel={lang === "en" ? "unrated" : "puansiz"}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-[10px] opacity-75 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-amber-300/35 bg-black/70 text-[10px] text-amber-200">
                  🔒
                </span>
                <span>{lang === "en" ? "Future day (locked)" : "Gelecek gun (kilitli)"}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
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

const MemoizedFieldHeatmap = memo(FieldHeatmap);
MemoizedFieldHeatmap.displayName = "FieldHeatmap";

export default MemoizedFieldHeatmap;
