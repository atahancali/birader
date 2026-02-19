"use client";

type CheckinLite = {
  created_at: string;
  beer_name?: string;
  rating?: number;
};

type Props = {
  year: number;
  checkins: CheckinLite[];
  onSelectDay: (isoDay: string) => void;
  onSelectMonth: (monthIndex: number) => void;
};

const MONTHS_TR = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];

function isoDay(d: Date) {
  return d.toISOString().split("T")[0];
}

function dayCountMap(checkins: CheckinLite[]) {
  const m: Record<string, number> = {};
  for (const c of checkins) {
    const day = isoDay(new Date(c.created_at));
    m[day] = (m[day] || 0) + 1;
  }
  return m;
}

function colorByCount(count: number) {
  if (!count) return "bg-white/5";
  if (count === 1) return "bg-yellow-300/60";
  if (count === 2) return "bg-yellow-400/70";
  if (count === 3) return "bg-orange-400/80";
  return "bg-red-500/80";
}

export default function YearHeatmap({ year, checkins, onSelectDay, onSelectMonth }: Props) {
  const counts = dayCountMap(checkins);

  function renderMonth(monthIndex: number) {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);

    // Monday-first (0..6) => Mon=0 ... Sun=6
    const jsDay = first.getDay(); // Sun=0..Sat=6
    const mondayFirst = (jsDay + 6) % 7;

    const cells: (string | null)[] = [];
    for (let i = 0; i < mondayFirst; i++) cells.push(null);

    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      cells.push(isoDay(new Date(d)));
    }

    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <button
        key={monthIndex}
        onClick={() => onSelectMonth(monthIndex)}
        className="text-left w-full rounded-3xl border border-white/10 bg-white/5 p-4 active:scale-[0.99]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">{MONTHS_TR[monthIndex]}</div>
          <div className="text-xs opacity-60">yakınlaştır</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-5 rounded bg-transparent" />;

            const count = counts[day] || 0;

            return (
              <div
                key={day}
                onClick={(e) => {
                  // month zoom button wraps; stop bubbling so day click works too
                  e.stopPropagation();
                  onSelectDay(day);
                }}
                title={`${day} • ${count} bira`}
                className={`h-7 rounded ${colorByCount(count)} border border-white/10 cursor-pointer`}
              />
            );
          })}
        </div>
      </button>
    );
  }


  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm opacity-80">Yıl görünümü</div>
          <div className="text-xl font-bold">{year}</div>
        </div>
        <div className="text-xs opacity-60">Renk: günlük bira sayısı</div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
      </div>
    </div>
  );
}

