"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { tx } from "@/lib/i18n";
import { useAppLang } from "@/lib/appLang";

type TabKey = "log" | "social" | "heatmap" | "stats" | "help";
type TabTone = "amber" | "cyan" | "violet";

function activeTabFromRoute(pathname: string, section: string | null): TabKey {
  if (pathname === "/yardim") return "help";
  if (pathname === "/connections") return "social";
  if (pathname.startsWith("/u/")) return "social";
  if (pathname === "/") {
    if (section === "social") return "social";
    if (section === "heatmap") return "heatmap";
    if (section === "stats") return "stats";
    return "log";
  }
  return "log";
}

function TabIcon({ tab }: { tab: TabKey }) {
  if (tab === "log") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 3h10l-1 8v7a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-7L7 3Z" />
        <path d="M8.2 7h7.6" />
      </svg>
    );
  }
  if (tab === "social") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16.5" cy="7" r="2.5" />
        <path d="M3.8 18a4.8 4.8 0 0 1 8.4-3.1" />
        <path d="M13.6 17.6A3.6 3.6 0 0 1 20 15.2" />
      </svg>
    );
  }
  if (tab === "heatmap") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 6h16v12H4z" />
        <path d="M9.3 6v12M14.7 6v12M4 12h16" />
      </svg>
    );
  }
  if (tab === "stats") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19V5" />
        <path d="M9 19v-8" />
        <path d="M14 19v-4" />
        <path d="M19 19V9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9.2a3 3 0 1 1 4.5 2.6c-.8.5-1.3.9-1.3 1.7" />
      <circle cx="12" cy="17.2" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function toneClasses(tone: TabTone, active: boolean) {
  if (tone === "cyan") {
    return active
      ? "border-cyan-200/55 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.24)]"
      : "border-cyan-200/15 text-cyan-100/75 hover:border-cyan-200/35 hover:bg-cyan-400/10";
  }
  if (tone === "violet") {
    return active
      ? "border-violet-200/55 bg-violet-400/15 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.25)]"
      : "border-violet-200/15 text-violet-100/75 hover:border-violet-200/35 hover:bg-violet-400/10";
  }
  return active
    ? "border-amber-200/60 bg-amber-400/16 text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.26)]"
    : "border-amber-200/15 text-amber-100/80 hover:border-amber-200/35 hover:bg-amber-400/10";
}

export default function GlobalBottomNav() {
  const pathname = usePathname();
  const { lang } = useAppLang("tr");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sectionParam, setSectionParam] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthenticated(!!data.session?.user);
      setSessionChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setSessionChecked(true);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function syncSection() {
      if (typeof window === "undefined") return;
      setSectionParam(new URLSearchParams(window.location.search).get("section") || "");
    }
    function onSectionEvent(event: Event) {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      if (detail?.section) setSectionParam(detail.section);
    }
    syncSection();
    window.addEventListener("popstate", syncSection);
    window.addEventListener("birader:nav-section", onSectionEvent as EventListener);
    return () => {
      window.removeEventListener("popstate", syncSection);
      window.removeEventListener("birader:nav-section", onSectionEvent as EventListener);
    };
  }, []);

  const hiddenByRoute =
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/underage";

  const active = useMemo(
    () => activeTabFromRoute(pathname, sectionParam),
    [pathname, sectionParam]
  );

  if (!sessionChecked || !isAuthenticated || hiddenByRoute) return null;

  const tabs: Array<{
    key: TabKey;
    label: string;
    hint: string;
    href: string;
    tone: TabTone;
  }> = [
    { key: "log", label: tx(lang, "Defter", "Logbook"), hint: tx(lang, "kayit", "entries"), href: "/?section=log", tone: "amber" },
    { key: "social", label: tx(lang, "Akis", "Feed"), hint: tx(lang, "takip", "network"), href: "/?section=social", tone: "cyan" },
    { key: "heatmap", label: tx(lang, "Atlas", "Atlas"), hint: tx(lang, "isi", "heat"), href: "/?section=heatmap", tone: "amber" },
    { key: "stats", label: tx(lang, "Analiz", "Insights"), hint: tx(lang, "trend", "trend"), href: "/?section=stats", tone: "violet" },
    { key: "help", label: tx(lang, "Destek", "Support"), hint: tx(lang, "yardim", "help"), href: "/yardim", tone: "amber" },
  ];

  return (
    <nav data-testid="global-bottom-nav" className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-auto mx-auto w-[min(100%-0.9rem,68rem)] pb-[calc(env(safe-area-inset-bottom)+0.45rem)]">
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-b from-[#17120a]/95 via-[#0f0d09]/95 to-[#0b0a08]/95 p-1 shadow-[0_-10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(251,191,36,0.1),transparent_60%)]" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/40 to-transparent" />
          <div className="relative grid grid-cols-5 gap-1">
            {tabs.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                data-testid={`tab-${item.key}`}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => {
                  if (item.key === "help") return;
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("birader:nav-section", { detail: { section: item.key } }));
                  }
                }}
                className={[
                  "group relative flex min-h-[58px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center transition-all duration-200",
                  "bg-gradient-to-b from-white/[0.02] to-transparent",
                  toneClasses(item.tone, active === item.key),
                ].join(" ")}
              >
                <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center opacity-90 transition-transform duration-200 group-hover:scale-105">
                  <TabIcon tab={item.key} />
                </span>
                <span className="text-[11px] font-semibold tracking-[0.01em] md:text-[12px]">{item.label}</span>
                <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">{item.hint}</span>
                {active === item.key ? (
                  <span className="absolute inset-x-4 bottom-1 h-px rounded-full bg-gradient-to-r from-transparent via-white/85 to-transparent" />
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
