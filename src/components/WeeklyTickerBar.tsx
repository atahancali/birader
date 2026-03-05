"use client";

import Link from "next/link";
import type { AppLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n";

export type WeeklyTickerItem = {
  key: string;
  label: string;
  value: string;
  meta: string;
  href: string;
};

type WeeklyTickerBarProps = {
  lang?: AppLang;
  scope: "all" | "followed";
  onScopeChange: (scope: "all" | "followed") => void;
  onRefresh: () => void;
  items: WeeklyTickerItem[];
  busy?: boolean;
};

export default function WeeklyTickerBar({
  lang = "tr",
  scope,
  onScopeChange,
  onRefresh,
  items,
  busy = false,
}: WeeklyTickerBarProps) {
  const hasItems = items.length > 0;
  const baseItems = hasItems
    ? items
    : [
        {
          key: "empty",
          label: tx(lang, "Haftanin nabzi", "Weekly pulse"),
          value: tx(lang, "Bu hafta veri birikiyor...", "Collecting this week's data..."),
          meta: tx(lang, "Biraz daha logla", "Log a little more"),
          href: "/",
        },
      ];
  const scrollItems = baseItems.length > 1 ? [...baseItems, ...baseItems] : baseItems;

  return (
    <div className="w-full min-w-0 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-[#2a1c03]/90 via-[#1a1204]/95 to-[#110b02]/95 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="font-mono text-xs uppercase tracking-[0.12em] text-amber-300/95"
          style={{ textShadow: "0 0 8px rgba(252,211,77,0.45), 0 0 2px rgba(252,211,77,0.8)" }}
        >
          {tx(lang, "Haftanin nabzi", "Weekly pulse")}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-amber-300/15 bg-black/35 p-1">
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              className={`rounded-md px-2 py-1 text-[11px] ${scope === "all" ? "bg-amber-400/15 text-amber-100" : "bg-black/20 text-white/75"}`}
            >
              {tx(lang, "Tüm", "All")}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("followed")}
              className={`rounded-md px-2 py-1 text-[11px] ${scope === "followed" ? "bg-amber-400/15 text-amber-100" : "bg-black/20 text-white/75"}`}
            >
              {tx(lang, "Takip", "Followed")}
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-amber-300/20 bg-black/30 px-2 py-1 text-[11px] text-amber-100"
          >
            {busy ? "..." : tx(lang, "Yenile", "Refresh")}
          </button>
        </div>
      </div>

      <div className="ticker-wrap relative mt-2 w-full overflow-hidden rounded-xl border border-amber-300/20 bg-[#0d0a03]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0d0a03] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#0d0a03] to-transparent" />
        <div
          className={`ticker-track flex w-max items-center gap-8 py-2 pr-8 whitespace-nowrap ${
            scrollItems.length <= 1 || busy ? "[animation-play-state:paused]" : ""
          }`}
        >
          {scrollItems.map((item, idx) => (
            <Link
              key={`${item.key}-${idx}`}
              href={item.href || "/"}
              className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-amber-300/95 transition hover:text-amber-100"
              style={{ textShadow: "0 0 7px rgba(252,211,77,0.45), 0 0 2px rgba(252,211,77,0.9)" }}
            >
              <span className="mr-1 opacity-70">{item.label}:</span>
              <span className="font-semibold">{item.value}</span>
              <span className="ml-2 opacity-80">• {item.meta}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
