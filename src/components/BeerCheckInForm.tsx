"use client";

import React, { useMemo, useRef, useState } from "react";

type Beer = { id: string; name: string };

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function Star({
  filled,
  className = "",
}: {
  filled: boolean;
  className?: string;
}) {
  // Simple star SVG (no deps)
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        className={
          filled ? "fill-white" : "fill-transparent stroke-white/55"
        }
        strokeWidth="1.6"
      />
    </svg>
  );
}

function StarRating({
  value,
  onChange,
  max = 5,
}: {
  value: number; // 0..5
  onChange: (v: number) => void;
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rating"
      >
        {Array.from({ length: max }).map((_, i) => {
          const v = i + 1;
          const filled = v <= display;
          return (
            <button
              key={v}
              type="button"
              className="p-1"
              onMouseEnter={() => setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(null)}
              onClick={() => {
                // Letterboxd hissi: aynı yıldıza tekrar tıkla -> sıfırla (opsiyon)
                onChange(v === value ? 0 : v);
              }}
              aria-label={`${v} star`}
              aria-checked={v === value}
              role="radio"
            >
              <Star
                filled={filled}
                className={filled ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]" : ""}
              />
            </button>
          );
        })}
      </div>

      <div className="text-sm opacity-70 w-10">
        {value ? `${value}/5` : "—"}
      </div>
    </div>
  );
}

export default function BeerCheckInForm({
  beers,
  onSubmit,
  initialBeerId,
}: {
  beers: Beer[];
  initialBeerId?: string;
  onSubmit: (payload: {
    beerId: string;
    dateISO: string; // YYYY-MM-DD
    rating: number; // 0..5
    notes?: string;
  }) => void;
}) {
  const today = useMemo(() => isoTodayLocal(), []);
  const [beerId, setBeerId] = useState<string>(initialBeerId ?? beers?.[0]?.id ?? "");
  const [dateISO, setDateISO] = useState<string>(today);
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const [dateOpen, setDateOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  const selectedBeer = useMemo(
    () => beers.find((b) => b.id === beerId)?.name ?? "",
    [beers, beerId]
  );

  function submit() {
    if (!beerId) return;
    onSubmit({
      beerId,
      dateISO,
      rating: clamp(rating, 0, 5),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-4">
        <div className="text-lg font-semibold">Bira Logla</div>
        <div className="text-sm opacity-70">
          Default bugün. Geçmiş için tarihi açılır menüden seç.
        </div>
      </div>

      {/* Beer dropdown */}
      <div className="mb-4">
        <label className="mb-2 block text-sm opacity-75">Bira</label>
        <div className="relative">
          <select
            value={beerId}
            onChange={(e) => setBeerId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/25"
          >
            {beers.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#0b0b0b]">
                {b.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
            ▾
          </div>
        </div>
        {selectedBeer ? (
          <div className="mt-1 text-xs opacity-60">Seçili: {selectedBeer}</div>
        ) : null}
      </div>

      {/* Date picker popover */}
      <div className="mb-4">
        <label className="mb-2 block text-sm opacity-75">Tarih</label>

        <div className="relative" ref={popRef}>
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm outline-none hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              <span>{dateISO}</span>
              <span className="text-white/55">📅</span>
            </div>
          </button>

          {dateOpen ? (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="date"
                  value={dateISO}
                  onChange={(e) => setDateISO(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                />
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-white/20"
                  onClick={() => {
                    setDateISO(today);
                    setDateOpen(false);
                  }}
                  title="Bugün"
                >
                  Bugün
                </button>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDateOpen(false)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  Kapat
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-4">
        <label className="mb-2 block text-sm opacity-75">Puan</label>
        <StarRating value={rating} onChange={setRating} />
        <div className="mt-1 text-xs opacity-60">
          Yıldızların üstüne gel → önizleme. Tıkla → seç. Aynı yıldıza tekrar tıkla → sıfırla.
        </div>
      </div>

      {/* Notes (optional) */}
      <div className="mb-5">
        <label className="mb-2 block text-sm opacity-75">Not (opsiyonel)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/25"
          placeholder="Kısa bir not…"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setBeerId(initialBeerId ?? beers?.[0]?.id ?? "");
            setDateISO(today);
            setRating(0);
            setNotes("");
          }}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-white/20"
        >
          Sıfırla
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={!beerId}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold hover:border-white/20 disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

