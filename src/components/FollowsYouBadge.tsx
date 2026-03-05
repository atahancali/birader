"use client";

import { tx, type AppLang } from "@/lib/i18n";

export default function FollowsYouBadge({ lang, className = "" }: { lang: AppLang; className?: string }) {
  return <div className={`text-[11px] text-amber-200/85 ${className}`}>{tx(lang, "Seni takip ediyor", "Follows you")}</div>;
}

