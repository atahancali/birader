"use client";

import { useEffect, useState } from "react";
import { APP_LANG_KEY, type AppLang } from "@/lib/i18n";

const LANG_EVENT = "birader:lang-change";

export function setAppLang(next: AppLang) {
  try {
    localStorage.setItem(APP_LANG_KEY, next);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: next } }));
  }
}

export function useAppLang(defaultLang: AppLang = "tr") {
  const [lang, setLang] = useState<AppLang>(defaultLang);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(APP_LANG_KEY);
      if (saved === "tr" || saved === "en") setLang(saved);
    } catch {}

    const onChange = (e: Event) => {
      const custom = e as CustomEvent<{ lang?: AppLang }>;
      const next = custom?.detail?.lang;
      if (next === "tr" || next === "en") setLang(next);
    };
    window.addEventListener(LANG_EVENT, onChange as EventListener);
    return () => window.removeEventListener(LANG_EVENT, onChange as EventListener);
  }, []);

  return {
    lang,
    setLang: (next: AppLang) => {
      setLang(next);
      setAppLang(next);
    },
  };
}
