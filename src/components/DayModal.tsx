"use client";

import { useState } from "react";

type Checkin = {
  id: string;
  beer_name: string;
  rating: number;
  created_at: string;
};

const RATINGS = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5];

export default function DayModal({
  open,
  day,
  checkins,
  onClose,
  onAdd,
}: {
  open: boolean;
  day: string;
  checkins: Checkin[];
  onClose: () => void;
  onAdd: (payload: { day: string; beer_name: string; rating: number }) => Promise<void>;
}) {
  const [beerName, setBeerName] = useState("");
  const [rating, setRating] = useState(3.5);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const avg =
    checkins.length === 0
      ? 0
      : checkins.reduce((s, c) => s + Number(c.rating ?? 0), 0) / checkins.length;

  async function handleAdd() {
    const name = beerName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onAdd({ day, beer_name: name, rating });
      setBeerName("");
      setRating(3.5);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70">{day}</div>
            <div className="text-lg font-bold">Gün Detayı</div>
            <div className="text-sm opacity-80 mt-1">
              {checkins.length} bira • Ortalama: {checkins.length ? avg.toFixed(2) : "-"} ⭐
            </div>
          </div>
          <button onClick={onClose} className="text-xl opacity-80">✕</button>
        </div>

        {/* ADD FORM */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs opacity-70 mb-2">Bu güne bira ekle</div>

          <input
            value={beerName}
            onChange={(e) => setBeerName(e.target.value)}
            placeholder="Bira adı"
            className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
          />

          <div className="mt-2 flex gap-2 flex-wrap">
            {RATINGS.map((r) => (
              <button
                key={r}
                onClick={() => setRating(r)}
                className={`px-3 py-2 rounded-2xl border text-sm ${
                  rating === r ? "bg-white text-black" : "border-white/10 bg-black/20"
                }`}
              >
                {r}⭐
              </button>
            ))}
          </div>

          <button
            disabled={saving}
            onClick={handleAdd}
            className="mt-3 w-full rounded-2xl bg-white text-black py-3 font-semibold disabled:opacity-60"
          >
            {saving ? "Ekleniyor..." : "Ekle"}
          </button>
        </div>

        {/* LIST */}
        <div className="mt-4 space-y-2">
          {checkins.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.beer_name}</div>
                <div className="text-sm">{c.rating}⭐</div>
              </div>
              <div className="text-xs opacity-60 mt-1">
                {new Date(c.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
          {checkins.length === 0 && (
            <div className="text-sm opacity-70">Bugün boş. İçmediysen helal.</div>
          )}
        </div>
      </div>
    </div>
  );
}

