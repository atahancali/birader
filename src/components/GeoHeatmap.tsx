"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLang } from "@/lib/i18n";

type CheckinGeo = {
  created_at: string;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
};

type CityCount = { city: string; count: number };

type DistrictCount = { district: string; count: number };
type PairCount = { key: string; city: string; district: string; count: number };

function cleanGeoValue(value: string | null | undefined) {
  return String(value || "").trim();
}

function isLocationPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized === "diger" ||
    normalized === "diğer" ||
    normalized === "belirtilmedi" ||
    normalized === "unspecified" ||
    normalized === "other"
  );
}

function hasStrictGeo(c: CheckinGeo) {
  const city = cleanGeoValue(c.city);
  const district = cleanGeoValue(c.district);
  if (!city || !district) return false;
  if (isLocationPlaceholder(city) || isLocationPlaceholder(district)) return false;
  return true;
}

export default function GeoHeatmap({ year, checkins, lang = "tr" }: { year: number; checkins: CheckinGeo[]; lang?: AppLang }) {
  const [layer, setLayer] = useState<"city" | "district" | "pair">("city");
  const cityCounts = useMemo<CityCount[]>(() => {
    const map = new Map<string, number>();
    for (const c of checkins) {
      const y = new Date(c.created_at).getUTCFullYear();
      if (y !== year) continue;
      if (!hasStrictGeo(c)) continue;
      const city = cleanGeoValue(c.city);
      if (!city) continue;
      map.set(city, (map.get(city) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "tr"));
  }, [checkins, year]);

  const [activeCity, setActiveCity] = useState<string>("");

  const selectedCity = activeCity || cityCounts[0]?.city || "";

  useEffect(() => {
    if (!cityCounts.length) {
      setActiveCity("");
      return;
    }
    if (!activeCity || !cityCounts.some((c) => c.city === activeCity)) {
      setActiveCity(cityCounts[0].city);
    }
  }, [activeCity, cityCounts]);

  const districtCounts = useMemo<DistrictCount[]>(() => {
    if (!selectedCity) return [];
    const map = new Map<string, number>();
    for (const c of checkins) {
      const y = new Date(c.created_at).getUTCFullYear();
      if (y !== year) continue;
      if (!hasStrictGeo(c)) continue;
      const city = cleanGeoValue(c.city);
      if (city !== selectedCity) continue;
      const district = cleanGeoValue(c.district);
      map.set(district, (map.get(district) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count || a.district.localeCompare(b.district, "tr"));
  }, [checkins, selectedCity, year, lang]);

  const pairCounts = useMemo<PairCount[]>(() => {
    const map = new Map<string, number>();
    for (const c of checkins) {
      const y = new Date(c.created_at).getUTCFullYear();
      if (y !== year) continue;
      if (!hasStrictGeo(c)) continue;
      const city = cleanGeoValue(c.city);
      const district = cleanGeoValue(c.district);
      const key = `${city}::${district}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => {
        const [city, district] = key.split("::");
        return { key, city, district, count };
      })
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "tr"));
  }, [checkins, year]);

  const cityMax = Math.max(1, ...cityCounts.map((x) => x.count));
  const districtMax = Math.max(1, ...districtCounts.map((x) => x.count));
  const pairMax = Math.max(1, ...pairCounts.map((x) => x.count));

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm opacity-80">{lang === "en" ? "Turkey location heatmap" : "Turkiye konum isi haritasi"}</div>
          <div className="text-xs opacity-60">{lang === "en" ? `City/district layer density (${year})` : `Şehir/ilçe katman yogunlugu (${year})`}</div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
          <button
            type="button"
            onClick={() => setLayer("city")}
            className={`rounded-md px-2 py-1 text-[11px] ${layer === "city" ? "bg-white/15" : "bg-black/20"}`}
          >
            {lang === "en" ? "City" : "Şehir"}
          </button>
          <button
            type="button"
            onClick={() => setLayer("district")}
            className={`rounded-md px-2 py-1 text-[11px] ${layer === "district" ? "bg-white/15" : "bg-black/20"}`}
          >
            {lang === "en" ? "District" : "İlçe"}
          </button>
          <button
            type="button"
            onClick={() => setLayer("pair")}
            className={`rounded-md px-2 py-1 text-[11px] ${layer === "pair" ? "bg-white/15" : "bg-black/20"}`}
          >
            {lang === "en" ? "Pair" : "Il/İlçe"}
          </button>
        </div>
      </div>

      {!cityCounts.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs opacity-70">
          {lang === "en" ? "No city data. Select city/district while logging." : "Şehir verisi yok. Log eklerken şehir/ilçe seç."}
        </div>
      ) : (
        <>
          {layer === "city" ? (
            <>
              <div className="mb-2 text-xs opacity-70">{lang === "en" ? "Cities" : "Şehir"}: {cityCounts.length}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cityCounts.slice(0, 24).map((row) => {
                  const intensity = row.count / cityMax;
                  const active = row.city === selectedCity;
                  return (
                    <button
                      key={row.city}
                      type="button"
                      onClick={() => setActiveCity(row.city)}
                      className={`rounded-xl border px-3 py-2 text-left ${
                        active
                          ? "border-amber-300/45 bg-amber-500/15"
                          : "border-white/10 bg-black/20"
                      }`}
                      style={{
                        boxShadow: active
                          ? `0 0 0 1px rgba(252,211,77,0.2), inset 0 0 ${8 + intensity * 20}px rgba(245,158,11,0.22)`
                          : `inset 0 0 ${4 + intensity * 16}px rgba(245,158,11,${0.06 + intensity * 0.2})`,
                      }}
                      title={`${row.city} • ${row.count} ${lang === "en" ? "logs" : "log"}`}
                    >
                      <div className="truncate text-xs font-semibold">{row.city}</div>
                      <div className="text-[11px] opacity-70">{row.count} {lang === "en" ? "logs" : "log"}</div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : layer === "district" ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs opacity-70">{lang === "en" ? "Selected city" : "Secili şehir"}:</div>
                <select
                  value={selectedCity}
                  onChange={(e) => setActiveCity(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                >
                  {cityCounts.map((row) => (
                    <option key={`geo-city-${row.city}`} value={row.city}>
                      {row.city}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {districtCounts.slice(0, 18).map((d) => {
                  const intensity = d.count / districtMax;
                  return (
                    <div
                      key={`${selectedCity}-${d.district}`}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                      style={{
                        boxShadow: `inset 0 0 ${6 + intensity * 18}px rgba(245,158,11,${0.08 + intensity * 0.26})`,
                      }}
                      title={`${selectedCity} / ${d.district} • ${d.count} ${lang === "en" ? "logs" : "log"}`}
                    >
                      <div className="truncate text-xs font-semibold">{d.district}</div>
                      <div className="mt-1 text-[11px] opacity-70">
                        {d.count} {lang === "en" ? "logs" : "log"}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!districtCounts.length ? (
                <div className="mt-2 text-xs opacity-60">
                  {lang === "en" ? "No district data for this city." : "Bu şehir için ilçe verisi yok."}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-xs opacity-75">{lang === "en" ? "Top city/district pairs" : "Top il/ilçe kombinasyonlari"}</div>
              <div className="space-y-2">
                {pairCounts.slice(0, 18).map((p) => (
                  <div key={p.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate pr-2">{p.city} / {p.district}</span>
                      <span className="opacity-70">{p.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-amber-300/80"
                        style={{ width: `${Math.max(6, (p.count / pairMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!pairCounts.length ? <div className="text-xs opacity-60">{lang === "en" ? "No district data." : "İlçe verisi yok."}</div> : null}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
