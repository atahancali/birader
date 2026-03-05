"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import { useAppLang } from "@/lib/appLang";

type TabKey = "log" | "social" | "heatmap" | "stats" | "help";

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

  const tabs: Array<{ key: TabKey; label: string; href: string }> = [
    { key: "log", label: t(lang, "nav_log"), href: "/?section=log" },
    { key: "social", label: t(lang, "nav_social"), href: "/?section=social" },
    { key: "heatmap", label: t(lang, "nav_heatmap"), href: "/?section=heatmap" },
    { key: "stats", label: t(lang, "nav_stats"), href: "/?section=stats" },
    { key: "help", label: t(lang, "nav_help"), href: "/yardim" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => {
              if (item.key === "help") return;
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("birader:nav-section", { detail: { section: item.key } }));
              }
            }}
            className={`rounded-xl border px-2 py-2 text-center text-xs ${
              active === item.key
                ? "border-amber-200/50 bg-amber-300/15 text-amber-200"
                : "border-white/10 bg-black/30 text-white/75"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
