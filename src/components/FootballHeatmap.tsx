"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CheckinLite = { created_at: string };

const DOW_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

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
  const start = new Date(year, 0, 1, 12);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const diffDays = Math.floor((dd.getTime() - start.getTime()) / 86400000);
  // shift so week columns align with monday-first start
  return Math.floor((diffDays + dowMonFirst(start)) / 7);
}

// --- helper: heat color ramp (0..1) ---
function heatRGBA(t: number, a: number) {
  // hue: 120 (green) -> 0 (red)
  const tt = Math.min(1, Math.max(0, t));
  const hue = 120 - 120 * tt;
  return `hsla(${hue}, 100%, 60%, ${Math.min(1, Math.max(0, a))})`;
}

export default function FootballHeatmap({
  year,
  checkins,
  onSelectDay,
  height = 180,
}: {
  year: number;
  checkins: CheckinLite[];
  onSelectDay: (isoDay: string) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tip, setTip] = useState<{
    show: boolean;
    x: number;
    y: number;
    iso: string;
    count: number;
    dow: string;
  } | null>(null);

  // counts per day
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of checkins) {
      const day = c.created_at?.slice(0, 10) || isoLocal(new Date(c.created_at));
      m[day] = (m[day] || 0) + 1;
    }
    return m;
  }, [checkins]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);

  // build mapping day->(x,y) coordinates in "week x dow" space
  const { maxWeek, dayToCoord, coordToDay } = useMemo(() => {
    const start = new Date(year, 0, 1, 12);
    const end = new Date(year, 11, 31, 12);

    const maxW = weekIndexFromYearStart(end, year);

    const dtc: Record<string, { w: number; d: number }> = {};
    const ctd: Record<string, string> = {}; // key "w|d" -> iso

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      const dow = dowMonFirst(d);
      const w = weekIndexFromYearStart(d, year);
      dtc[iso] = { w, d: dow };
      ctd[`${w}|${dow}`] = iso;
    }

    return { maxWeek: maxW, dayToCoord: dtc, coordToDay: ctd };
  }, [year]);

  function getLayout() {
    const padX = 46; // left labels space
    const padY = 26; // top padding
    const innerW = Math.max(700, (maxWeek + 1) * 16); // big field width
    const innerH = height;

    const cssW = padX + innerW + 16;
    const cssH = padY + innerH + 16;

    const cellW = innerW / (maxWeek + 1);
    const cellH = innerH / 7;

    return { padX, padY, innerW, innerH, cssW, cssH, cellW, cellH };
  }

  function pickDayFromXY(x: number, y: number) {
    const { padX, padY, innerW, innerH, cellW, cellH } = getLayout();

    if (x < padX || y < padY || x > padX + innerW || y > padY + innerH) return null;

    const w = Math.floor((x - padX) / cellW);
    const d = Math.floor((y - padY) / cellH);

    const iso = coordToDay[`${w}|${d}`];
    if (!iso) return null;

    const dt = new Date(iso + "T12:00:00");
    const dow = DOW_TR[dowMonFirst(dt)];
    const count = counts[iso] || 0;

    return { iso, dow, count };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const { padX, padY, innerW, innerH, cssW, cssH, cellW, cellH } = getLayout();

    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- Background: pitch gradient + subtle stripes ---
    ctx.clearRect(0, 0, cssW, cssH);

    const pitch = ctx.createLinearGradient(padX, padY, padX + innerW, padY + innerH);
    pitch.addColorStop(0, "rgba(30, 60, 40, 0.22)");
    pitch.addColorStop(0.5, "rgba(18, 38, 28, 0.12)");
    pitch.addColorStop(1, "rgba(10, 20, 15, 0.18)");
    ctx.fillStyle = pitch;
    ctx.fillRect(padX, padY, innerW, innerH);

    ctx.save();
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const x0 = padX + (innerW / 10) * i;
      ctx.fillRect(x0, padY, innerW / 10, innerH);
    }
    ctx.restore();

    // labels
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    for (let i = 0; i < 7; i++) {
      const y = padY + (innerH / 7) * (i + 0.5) + 4;
      ctx.fillText(DOW_TR[i], 8, y);
    }

    // field frame
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, padY, innerW, innerH);

    // field markings
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;

    // midline
    ctx.beginPath();
    ctx.moveTo(padX + innerW / 2, padY);
    ctx.lineTo(padX + innerW / 2, padY + innerH);
    ctx.stroke();

    // center circle
    ctx.beginPath();
    ctx.arc(
      padX + innerW / 2,
      padY + innerH / 2,
      Math.min(innerW, innerH) * 0.12,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();

    // --- Offscreen density map ---
    const off = document.createElement("canvas");
    off.width = Math.floor(cssW * dpr);
    off.height = Math.floor(cssH * dpr);
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, cssW, cssH);

    for (const [day, c] of Object.entries(counts)) {
      const coord = dayToCoord[day];
      if (!coord) continue;

      const cx = padX + coord.w * cellW + cellW / 2;
      const cy = padY + coord.d * cellH + cellH / 2;

      const t = c / maxCount; // 0..1
      const r = Math.max(8, Math.min(26, 10 + 18 * t));

      const g = octx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0.0, heatRGBA(Math.min(1, t * 1.15), 0.95));
      g.addColorStop(0.35, heatRGBA(t, 0.55));
      g.addColorStop(1.0, "rgba(0,0,0,0)");

      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(cx, cy, r, 0, Math.PI * 2);
      octx.fill();
    }

    // --- Bloom passes (additive glow) ---
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(18px)";
    ctx.globalAlpha = 0.95;
    ctx.drawImage(off, 0, 0, cssW, cssH);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(8px)";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(off, 0, 0, cssW, cssH);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(0px)";
    ctx.globalAlpha = 0.65;
    ctx.drawImage(off, 0, 0, cssW, cssH);
    ctx.restore();

    // vignette
    ctx.save();
    const vg = ctx.createRadialGradient(
      padX + innerW / 2,
      padY + innerH / 2,
      Math.min(innerW, innerH) * 0.1,
      padX + innerW / 2,
      padY + innerH / 2,
      Math.max(innerW, innerH) * 0.75
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(padX, padY, innerW, innerH);
    ctx.restore();

    // tiny noise overlay for texture (cheap + enough)
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 900; i++) {
      const nx = padX + Math.random() * innerW;
      const ny = padY + Math.random() * innerH;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
      ctx.fillRect(nx, ny, 1, 1);
    }
    ctx.restore();

    // wrapper width for horizontal scroll
    wrap.style.minWidth = `${cssW}px`;
  }, [counts, dayToCoord, height, maxCount, maxWeek, year]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = pickDayFromXY(x, y);
    if (hit?.iso) onSelectDay(hit.iso);
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = pickDayFromXY(x, y);
    if (!hit) {
      setTip(null);
      return;
    }

    // tooltip position: keep it inside container a bit
    const tipX = Math.min(rect.width - 10, Math.max(10, x));
    const tipY = Math.min(rect.height - 10, Math.max(10, y));

    setTip({
      show: true,
      x: tipX,
      y: tipY,
      iso: hit.iso,
      count: hit.count,
      dow: hit.dow,
    });
  }

  function handleLeave() {
    setTip(null);
  }

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm opacity-80">Isı haritası</div>
          <div className="text-xl font-bold">{year}</div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] opacity-60">Low</div>
          <div
            className="h-2 w-28 rounded-full border border-white/10"
            style={{
              background:
                "linear-gradient(90deg, hsl(120 100% 60%), hsl(60 100% 60%), hsl(30 100% 60%), hsl(0 100% 60%))",
            }}
            aria-label="Heatmap legend"
            title={`Yoğunluk ölçeği (max: ${maxCount})`}
          />
          <div className="text-[11px] opacity-60">High</div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div ref={wrapRef} className="inline-block">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              className="rounded-3xl border border-white/10 bg-white/5"
            />

            {/* Tooltip */}
            {tip?.show ? (
              <div
                className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md"
                style={{
                  left: tip.x + 14,
                  top: tip.y + 14,
                  transform: "translateZ(0)",
                  maxWidth: 220,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {tip.dow} · {tip.iso}
                  </div>
                  <div className="rounded-md bg-white/10 px-2 py-0.5 font-semibold">
                    {tip.count}
                  </div>
                </div>
                <div className="mt-1 opacity-70">
                  Click: günü seç • Max: {maxCount}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs opacity-60">
        İpucu: sağa kaydır. Haritada bir güne gelince tooltip çıkar; tıkla → seç.
      </div>
    </div>
  );
}
