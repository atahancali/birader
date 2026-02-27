"use client";

import { gradientColor } from "@/lib/heatmapTheme";

type CheckinLite = { created_at: string; rating?: number | null };

const DOW_TR = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];

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
}: {
  year: number;
  checkins: CheckinLite[];
  onSelectDay: (isoDay: string) => void;
  readOnly?: boolean;
  cellMetric?: "color" | "count" | "avgRating";
  colorFrom?: string;
  colorTo?: string;
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

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm opacity-80">Isı haritası</div>
          <div className="text-xl font-bold">{year}</div>
        </div>
        <div className="text-xs opacity-60">
          {cellMetric === "avgRating" ? "Günlük ortalama puan" : "Günlük bira sayısı"}
        </div>
      </div>

      {/* horizontal scroll "field" */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[980px]">
          {/* labels */}
          <div className="grid grid-cols-[40px_1fr] gap-3">
            <div className="pt-1">
              {DOW_TR.map((d) => (
                <div key={d} className="text-[11px] opacity-60 flex items-center" style={{ height: `${cellSize + 2}px` }}>
                  {d}
                </div>
              ))}
            </div>

            <div>
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
                      const avgRating =
                        stat && stat.ratingCount > 0 ? Math.round((stat.ratingSum / stat.ratingCount) * 10) / 10 : null;
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
                          disabled={!iso}
                          onClick={() => !readOnly && iso && onSelectDay(iso)}
                          title={
                            iso
                              ? `${iso} • ${count} bira${avgRating === null ? "" : ` • ${avgRating.toFixed(1)}⭐ ort.`}`
                              : ""
                          }
                          className={[
                            "rounded border border-white/10 text-[10px] font-semibold",
                            iso ? "" : "bg-transparent border-transparent",
                            iso && count > 0 && cellMetric !== "color" ? "text-white/90" : "text-white/0",
                            iso && !readOnly ? "active:scale-[0.98]" : "",
                          ].join(" ")}
                          style={{
                            height: `${cellSize}px`,
                            width: `${cellSize}px`,
                            backgroundColor:
                              !iso || count <= 0
                                ? "rgba(255,255,255,0.06)"
                                : gradientColor(colorFrom, colorTo, Math.min(1, count / 5), 0.9),
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
            {readOnly ? "İpucu: sağa kaydır." : "İpucu: sağa kaydır. Hücreye dokun → gün detayı."}
          </div>
        </div>
      </div>
    </div>
  );
}
