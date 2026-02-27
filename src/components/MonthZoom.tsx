"use client";

import type { AppLang } from "@/lib/i18n";

type CheckinLite = { created_at: string };

const MONTHS_TR = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];
const MONTHS_EN = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DOW_TR = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function colorByCount(count: number) {
  if (!count) return "bg-white/5";
  if (count === 1) return "bg-white/15";
  if (count === 2) return "bg-white/25";
  if (count === 3) return "bg-white/35";
  return "bg-white/45";
}

export default function MonthZoom({
  open,
  year,
  monthIndex,
  checkins,
  onClose,
  onSelectDay,
  selectedDay,
  lang = "tr",
}: {
  open: boolean;
  year: number;
  monthIndex: number;
  checkins: CheckinLite[];
  onClose: () => void;
  onSelectDay: (iso: string) => void;
  selectedDay: string | null;
  lang?: AppLang;
}) {
  if (!open) return null;

  const counts: Record<string, number> = {};
  for (const c of checkins) {
    const d = isoDay(new Date(c.created_at));
    counts[d] = (counts[d] || 0) + 1;
  }

  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);

  // Monday-first index
  const mondayFirst = (first.getDay() + 6) % 7;

  const cells: (string | null)[] = [];

  for (let i = 0; i < mondayFirst; i++) cells.push(null);

  for (let dayNum = 1; dayNum <= last.getDate(); dayNum++) {
    cells.push(isoDay(new Date(year, monthIndex, dayNum)));
  }
while (cells.length % 7 !== 0) cells.push(null);

return (
  <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md">
    <div className="mx-auto max-w-md min-h-screen px-4 pt-6 pb-8 flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-sm active:scale-[0.98]"
        >
          ←
        </button>

        <div className="text-base font-medium tracking-wide">
          {(lang === "en" ? MONTHS_EN : MONTHS_TR)[monthIndex]} {year}
        </div>

        <button
          onClick={() => onSelectDay(isoDay(new Date()))}
          className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-sm active:scale-[0.98]"
        >
          {lang === "en" ? "Today" : "bugun"}
        </button>
      </div>

      {/* WEEKDAYS + GRID */}
      <div className="mt-6">
        <div className="grid grid-cols-7 gap-2 text-[11px] opacity-70 mb-2">
          {(lang === "en" ? DOW_EN : DOW_TR).map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {(() => {
            const todayIso = isoDay(new Date());

            return cells.map((day, idx) => {
              if (!day) {
                return (
                  <div key={idx} className="aspect-square rounded-2xl" />
                );
              }

              const count = counts[day] || 0;
              const isToday = day === todayIso;
              const isSelected = selectedDay === day;
              const isFuture = day > todayIso;

              const borderClass = isToday
                ? "border-white/40"
                : "border-white/10";

              const ringClass = isSelected
                ? "ring-2 ring-white/60"
                : "";

              return (
                <button
                  key={day}
                  onClick={() => !isFuture && onSelectDay(day)}
                  disabled={isFuture}
                  className={`relative aspect-square rounded-2xl border ${borderClass} ${ringClass} ${isFuture ? "bg-white/5 opacity-60" : colorByCount(count)} ${isFuture ? "" : "active:scale-[0.98]"}`}
                  title={`${day} • ${count} ${lang === "en" ? "beers" : "bira"}${isFuture ? (lang === "en" ? " • Future (locked)" : " • Gelecek (kilitli)") : ""}`}
                >
                  <div className="absolute left-2 top-2 text-xs opacity-80">
                    {Number(day.slice(8, 10))}
                  </div>

                  {count > 0 && (
                    <div className="absolute right-2 bottom-2 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-xs">
                      {count}
                    </div>
                  )}
                </button>
              );
            });
          })()}
        </div>
      </div>

    </div>
  </div>
);
}
