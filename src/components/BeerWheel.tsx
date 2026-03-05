"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n";

type BeerWheelProps = {
  lang: AppLang;
  options: string[];
  topOptions?: string[];
  onPick: (beer: string) => void;
};

function randomFrom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

export default function BeerWheel({ lang, options, topOptions = [], onPick }: BeerWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [currentLabel, setCurrentLabel] = useState("");
  const [pickedLabel, setPickedLabel] = useState("");
  const timerRef = useRef<number | null>(null);

  const pool = useMemo(() => {
    const normalized = Array.from(new Set(options.map((x) => x.trim()).filter(Boolean)));
    const boostedTop = topOptions.filter((x) => normalized.includes(x));
    const weighted = [...boostedTop, ...boostedTop, ...normalized];
    return weighted.length ? weighted : normalized;
  }, [options, topOptions]);

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function spin() {
    if (spinning || !pool.length) return;

    stopTimer();
    setSpinning(true);
    setPickedLabel("");

    const spinLength = 26 + Math.floor(Math.random() * 10);
    let step = 0;

    const tick = () => {
      step += 1;
      const next = randomFrom(pool) || "";
      setCurrentLabel(next);

      if (step >= spinLength) {
        setSpinning(false);
        setPickedLabel(next);
        return;
      }

      const ratio = step / spinLength;
      const delay = ratio < 0.45 ? 60 : ratio < 0.75 ? 95 : 140;
      timerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/12 via-black/20 to-black/35 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-amber-200/90">{tx(lang, "Bugun ne icsem? Bira carki", "What should I drink today? Beer wheel")}</div>
        <button
          type="button"
          onClick={spin}
          disabled={spinning || !pool.length}
          className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px] transition hover:border-amber-300/35 hover:bg-amber-500/15 disabled:opacity-50"
        >
          {spinning ? tx(lang, "Donuyor...", "Spinning...") : tx(lang, "Carki cevir", "Spin wheel")}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0">
          <div
            className={`absolute inset-0 rounded-full border border-amber-200/25 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(245,158,11,0.75)_0deg,rgba(251,191,36,0.38)_110deg,rgba(15,23,42,0.42)_220deg,rgba(245,158,11,0.75)_360deg)] ${
              spinning ? "animate-[spin_850ms_linear_infinite]" : ""
            }`}
          />
          <div className="absolute inset-[14px] flex items-center justify-center rounded-full border border-white/15 bg-black/65">
            <span className="text-[11px] opacity-80">{tx(lang, "Bira", "Beer")}</span>
          </div>
          <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[10px] border-x-transparent border-b-amber-300/90" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm">
            <div className="text-[10px] uppercase tracking-wide opacity-65">{tx(lang, "Secim", "Selection")}</div>
            <div className="truncate font-semibold">{currentLabel || tx(lang, "Hazir", "Ready")}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pickedLabel ? (
              <button
                type="button"
                onClick={() => onPick(pickedLabel)}
                className="rounded-lg border border-amber-300/35 bg-amber-500/15 px-3 py-1.5 text-xs"
              >
                {tx(lang, "Bunu sec", "Use this")} • {pickedLabel}
              </button>
            ) : (
              <div className="text-[11px] opacity-65">{tx(lang, "Secimden sonra tek tikla forma aktarabilirsin.", "After spin, add with one tap.")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
