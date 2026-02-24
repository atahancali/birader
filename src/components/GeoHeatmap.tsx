"use client";

import { useMemo } from "react";

type CheckinGeo = {
  created_at: string;
  location_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Bubble = {
  key: string;
  x: number;
  y: number;
  count: number;
  locationText?: string;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function GeoHeatmap({ year, checkins }: { year: number; checkins: CheckinGeo[] }) {
  const points = useMemo(() => {
    const map = new Map<string, Bubble>();

    for (const c of checkins) {
      const y = new Date(c.created_at).getUTCFullYear();
      if (y !== year) continue;
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const latBucket = Math.round(lat * 2) / 2;
      const lngBucket = Math.round(lng * 2) / 2;
      const key = `${latBucket}:${lngBucket}`;

      const x = clamp01((lngBucket + 180) / 360);
      const yNorm = clamp01((90 - latBucket) / 180);

      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(key, {
          key,
          x,
          y: yNorm,
          count: 1,
          locationText: (c.location_text || "").trim() || undefined,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [checkins, year]);

  const topLocations = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkins) {
      const y = new Date(c.created_at).getUTCFullYear();
      if (y !== year) continue;
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const loc = (c.location_text || "").trim();
      if (!loc) continue;
      map.set(loc, (map.get(loc) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [checkins, year]);

  const max = Math.max(1, ...points.map((p) => p.count));

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm opacity-80">Cografi isi haritasi</div>
          <div className="text-xs opacity-60">Koordinat eklenen loglar ({year})</div>
        </div>
        <div className="text-xs opacity-70">Nokta: {points.length}</div>
      </div>

      <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c2a3e] via-[#16435f] to-[#0e3046]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.08),transparent_35%),radial-gradient(circle_at_75%_60%,rgba(255,255,255,.06),transparent_35%)]" />

        {points.map((p) => {
          const size = 10 + (p.count / max) * 26;
          const glow = 0.35 + (p.count / max) * 0.55;

          return (
            <div
              key={p.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100/50 bg-amber-300/70"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                boxShadow: `0 0 18px rgba(251,191,36,${glow})`,
              }}
              title={`${p.locationText || p.key} • ${p.count} log`}
            />
          );
        })}
      </div>

      <div className="mt-3 text-xs opacity-70">En cok loglanan lokasyonlar</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {topLocations.map(([loc, count]) => (
          <div key={loc} className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs">
            {loc} • {count}
          </div>
        ))}
        {!topLocations.length ? (
          <div className="text-xs opacity-60">Lokasyon verisi yok. Log eklerken konum bilgisi gir.</div>
        ) : null}
      </div>
    </section>
  );
}
