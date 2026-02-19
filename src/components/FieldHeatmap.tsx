"use client";

type CheckinLite = { created_at: string };

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

function colorByCount(count: number) {
  if (!count) return "bg-white/5";
  if (count === 1) return "bg-white/15";
  if (count === 2) return "bg-white/25";
  if (count === 3) return "bg-white/35";
  return "bg-white/45";
}

export default function FieldHeatmap({
  year,
  checkins,
  onSelectDay,
}: {
  year: number;
  checkins: CheckinLite[];
  onSelectDay: (isoDay: string) => void;
}) {
  // count per day
  const counts: Record<string, number> = {};
  for (const c of checkins) {
    const day = isoLocal(new Date(c.created_at));
    counts[day] = (counts[day] || 0) + 1;
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

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm opacity-80">Isı haritası</div>
          <div className="text-xl font-bold">{year}</div>
        </div>
        <div className="text-xs opacity-60">Günlük bira sayısı</div>
      </div>

      {/* horizontal scroll "field" */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[980px]">
          {/* labels */}
          <div className="grid grid-cols-[40px_1fr] gap-3">
            <div className="pt-1">
              {DOW_TR.map((d) => (
                <div key={d} className="h-5 text-[11px] opacity-60 flex items-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="overflow-hidden">
              {/* actual grid */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${maxWeek + 1}, 18px)` }}
              >
                {Array.from({ length: maxWeek + 1 }).map((_, col) => (
                  <div key={col} className="grid grid-rows-7 gap-1">
                    {Array.from({ length: 7 }).map((_, row) => {
                      const iso = grid[row][col];
                      const count = iso ? (counts[iso] || 0) : 0;

                      return (
                        <button
                          key={`${row}-${col}`}
                          disabled={!iso}
                          onClick={() => iso && onSelectDay(iso)}
                          title={iso ? `${iso} • ${count} bira` : ""}
                          className={[
                            "h-5 w-[18px] rounded border border-white/10",
                            iso ? colorByCount(count) : "bg-transparent border-transparent",
                            iso ? "active:scale-[0.98]" : "",
                          ].join(" ")}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs opacity-60">
            İpucu: sağa kaydır. Hücreye dokun → gün detayı.
          </div>
        </div>
      </div>
    </div>
  );
}

