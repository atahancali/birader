"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLang } from "@/lib/i18n";

type FavoriteRow = {
  beer_name: string;
  rank: number;
};

export default function FavoriteReplaceModal({
  open,
  favorites,
  candidateBeerName,
  lang = "tr",
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  favorites: FavoriteRow[];
  candidateBeerName: string;
  lang?: AppLang;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (rank: number) => Promise<void> | void;
}) {
  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => Number(a.rank) - Number(b.rank)),
    [favorites]
  );
  const [selectedRank, setSelectedRank] = useState<number>(1);

  useEffect(() => {
    if (!open) return;
    setSelectedRank(Number(sortedFavorites[0]?.rank ?? 1));
  }, [open, sortedFavorites]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160]">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/15 bg-black p-4">
        <div className="text-base font-semibold">
          {lang === "en" ? "Replace a favorite" : "Favori değiştir"}
        </div>
        <div className="mt-1 text-sm opacity-80">
          {lang === "en"
            ? `Favorites are full. Choose one to replace with: ${candidateBeerName}`
            : `Favoriler dolu. Şu bira için değiştirilecek favoriyi seç: ${candidateBeerName}`}
        </div>

        <div className="mt-3 space-y-2">
          {sortedFavorites.map((f) => {
            const active = Number(f.rank) === Number(selectedRank);
            return (
              <button
                key={`replace-fav-${f.rank}`}
                type="button"
                onClick={() => setSelectedRank(Number(f.rank))}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  active ? "border-amber-300/40 bg-amber-500/15" : "border-white/15 bg-white/10"
                }`}
              >
                #{f.rank} {f.beer_name}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {lang === "en" ? "Cancel" : "Vazgeç"}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(Number(selectedRank))}
            disabled={busy}
            className="rounded-lg border border-amber-300/35 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100 disabled:opacity-60"
          >
            {busy ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : lang === "en" ? "Replace" : "Değiştir"}
          </button>
        </div>
      </div>
    </div>
  );
}
