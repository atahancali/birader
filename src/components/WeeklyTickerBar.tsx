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
  const renderItems = hasItems
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

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-500/10 via-black/35 to-black/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-amber-200/90">{tx(lang, "Haftanin nabzi", "Weekly pulse")}</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              className={`rounded-md px-2 py-1 text-[11px] ${scope === "all" ? "bg-white/15" : "bg-black/20"}`}
            >
              {tx(lang, "Tum", "All")}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("followed")}
              className={`rounded-md px-2 py-1 text-[11px] ${scope === "followed" ? "bg-white/15" : "bg-black/20"}`}
            >
              {tx(lang, "Takip", "Followed")}
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
          >
            {busy ? "..." : tx(lang, "Yenile", "Refresh")}
          </button>
        </div>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/25">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-black/75 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-black/75 to-transparent" />
        <div className="no-scrollbar flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto py-2 pr-2">
          {renderItems.map((item, idx) => (
            <Link
              key={`${item.key}-${idx}`}
              href={item.href || "/"}
              className="inline-flex min-w-[220px] max-w-[300px] shrink-0 snap-start flex-col rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition hover:border-amber-300/45 hover:bg-amber-500/10"
            >
              <span className="text-[10px] uppercase tracking-wide opacity-70">{item.label}</span>
              <span className="truncate text-xs font-semibold">{item.value}</span>
              <span className="truncate text-[11px] opacity-65">{item.meta}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
