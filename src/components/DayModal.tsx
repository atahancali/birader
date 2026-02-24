"use client";

import { useEffect, useMemo, useState } from "react";

type Checkin = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
};

const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function DayModal({
  open,
  day,
  checkins,
  beerOptions = [],
  onClose,
  onAdd,
  onDelete,
  onUpdate,
  onOpenLogForDay,
}: {
  open: boolean;
  day: string;
  checkins: Checkin[];
  beerOptions?: string[];
  onClose: () => void;
  onAdd: (payload: { day: string; beer_name: string; rating: number | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (payload: { id: string; beer_name: string; rating: number | null }) => Promise<void>;
  onOpenLogForDay?: (day: string) => void;
}) {
  // add form
  const [beerName, setBeerName] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBeer, setEditBeer] = useState("");
  const [editRating, setEditRating] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // modal kapanınca edit state sıfırla
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setBusyId(null);
    }
  }, [open]);

  const avg = useMemo(() => {
    const rated = checkins.filter((c) => c.rating !== null && c.rating !== undefined);
    if (rated.length === 0) return 0;
    return rated.reduce((s, c) => s + Number(c.rating ?? 0), 0) / rated.length;
  }, [checkins]);

  async function handleAdd() {
    const name = beerName.trim();
    if (!name) return;

    setSaving(true);
    try {
      await onAdd({ day, beer_name: name, rating });
      setBeerName("");
      setRating(null);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: Checkin) {
    setEditingId(c.id);
    setEditBeer(c.beer_name ?? "");
    setEditRating(c.rating === null || c.rating === undefined ? null : Number(c.rating));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBeer("");
    setEditRating(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kaydı silmek istiyor musun?")) return;

    setBusyId(id);
    try {
      await onDelete(id);
      // eğer silinen kayıt edit modundaysa kapat
      if (editingId === id) cancelEdit();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(id: string) {
    const name = editBeer.trim();
    if (!name) return;

    setBusyId(id);
    try {
      await onUpdate({ id, beer_name: name, rating: editRating });
      cancelEdit();
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70">{day}</div>
            <div className="text-lg font-bold">Gün Detayı</div>
            <div className="text-sm opacity-80 mt-1">
              {checkins.length} bira • Ortalama: {avg ? avg.toFixed(2) : "-"} ⭐
            </div>
          </div>
          <button onClick={onClose} className="text-xl opacity-80">
            ✕
          </button>
        </div>

        {/* ADD FORM */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs opacity-70">Bu güne bira ekle</div>
            {onOpenLogForDay ? (
              <button
                type="button"
                onClick={() => onOpenLogForDay(day)}
                className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[11px]"
              >
                Secimli ekrana git
              </button>
            ) : null}
          </div>

          <input
            value={beerName}
            onChange={(e) => setBeerName(e.target.value)}
            placeholder="Bira adı"
            list="daymodal-beer-options"
            className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
          />
          <datalist id="daymodal-beer-options">
            {beerOptions.slice(0, 250).map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() => setRating((r) => (r === null ? 3.5 : null))}
            className={`mt-2 px-3 py-2 rounded-2xl border text-sm ${
              rating === null ? "bg-white text-black" : "border-white/10 bg-black/20"
            }`}
          >
            {rating === null ? "Puansız log (açık)" : "Puansız log"}
          </button>

          <div className="mt-2 flex gap-2 flex-wrap">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
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
          {checkins.map((c) => {
            const isEditing = editingId === c.id;
            const isBusy = busyId === c.id;

            return (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                {!isEditing ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.beer_name}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {new Date(c.created_at).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm whitespace-nowrap">
                          {c.rating === null ? "—" : `${c.rating}⭐`}
                        </div>

                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                        >
                          Düzenle
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={isBusy}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs disabled:opacity-60"
                        >
                          {isBusy ? "..." : "Sil"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs opacity-70 mb-2">Düzenle</div>

                    <input
                      value={editBeer}
                      onChange={(e) => setEditBeer(e.target.value)}
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
                      placeholder="Bira adı"
                    />

                    <button
                      type="button"
                      onClick={() => setEditRating((r) => (r === null ? 3.5 : null))}
                      className={`mt-2 px-3 py-2 rounded-2xl border text-sm ${
                        editRating === null ? "bg-white text-black" : "border-white/10 bg-black/20"
                      }`}
                    >
                      {editRating === null ? "Puansız log (açık)" : "Puansız log"}
                    </button>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      {RATINGS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditRating(r)}
                          className={`px-3 py-2 rounded-2xl border text-sm ${
                            editRating === r ? "bg-white text-black" : "border-white/10 bg-black/20"
                          }`}
                        >
                          {r}⭐
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-2xl border border-white/10 bg-black/20 py-3 text-sm"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(c.id)}
                        disabled={isBusy}
                        className="rounded-2xl bg-white text-black py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {isBusy ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {checkins.length === 0 && (
            <div className="text-sm opacity-70">Bu gün için kayıt yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
