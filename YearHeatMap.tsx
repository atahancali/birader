"use client";

type Props = {
  checkins: { created_at: string }[];
};

export default function YearHeatmap({ checkins }: Props) {
  const year = new Date().getFullYear();

  const counts: Record<string, number> = {};
  checkins.forEach((c) => {
    const day = new Date(c.created_at).toISOString().split("T")[0];
    counts[day] = (counts[day] || 0) + 1;
  });

  function getColor(count: number) {
    if (!count) return "bg-gray-800";
    if (count === 1) return "bg-yellow-300";
    if (count === 2) return "bg-yellow-500";
    if (count === 3) return "bg-orange-500";
    return "bg-red-600";
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d).toISOString().split("T")[0]);
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-4">{year} Heatmap</h2>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = counts[day] || 0;
          return (
            <div
              key={day}
              title={`${day} - ${count} bira`}
              className={`w-8 h-8 rounded ${getColor(count)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

