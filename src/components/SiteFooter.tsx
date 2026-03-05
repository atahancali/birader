"use client";

import Link from "next/link";
import { useAppLang } from "@/lib/appLang";
import { t } from "@/lib/i18n";

export default function SiteFooter() {
  const { lang } = useAppLang("tr");
  return (
    <footer className="mt-8 border-t border-amber-300/10 bg-gradient-to-b from-black/55 to-black/35 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] text-xs text-white/62">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
          <Link href="/privacy" className="underline decoration-white/35 underline-offset-2">
            {t(lang, "footer_privacy")}
          </Link>
          <Link href="/terms" className="underline decoration-white/35 underline-offset-2">
            {t(lang, "footer_terms")}
          </Link>
          <a href="mailto:biraderdestek@gmail.com" className="underline decoration-white/35 underline-offset-2">
            biraderdestek@gmail.com
          </a>
        </div>
        <div className="opacity-70">{t(lang, "footer_project_tagline")}</div>
      </div>
    </footer>
  );
}
