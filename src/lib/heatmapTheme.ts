export type HeatmapPalette = {
  key: string;
  label: string;
  from: string;
  to: string;
};

export const HEATMAP_PALETTES: HeatmapPalette[] = [
  { key: "amber-red", label: "Amber -> Kirmizi", from: "#f59e0b", to: "#ef4444" },
  { key: "emerald-lime", label: "Yesil -> Lime", from: "#10b981", to: "#84cc16" },
  { key: "blue-cyan", label: "Mavi -> Cyan", from: "#3b82f6", to: "#06b6d4" },
  { key: "violet-pink", label: "Mor -> Pembe", from: "#8b5cf6", to: "#ec4899" },
  { key: "slate-amber", label: "Slate -> Gold", from: "#334155", to: "#f59e0b" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hexRaw: string) {
  const hex = hexRaw.trim().replace("#", "");
  const full =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.length === 6
      ? hex
      : "f59e0b";
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 245,
    g: Number.isFinite(g) ? g : 158,
    b: Number.isFinite(b) ? b : 11,
  };
}

export function gradientColor(from: string, to: string, tRaw: number, alpha = 0.9) {
  const t = clamp(tRaw, 0, 1);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const blue = Math.round(a.b + (b.b - a.b) * t);
  return `rgba(${r}, ${g}, ${blue}, ${clamp(alpha, 0, 1)})`;
}
