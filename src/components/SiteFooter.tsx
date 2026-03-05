"use client";

import Link from "next/link";
import { useAppLang } from "@/lib/appLang";
import { t } from "@/lib/i18n";

export default function SiteFooter() {
  const { lang } = useAppLang("tr");
  return (
    <footer className="mb-20 mt-8 border-t border-white/10 bg-black/35 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-xs text-white/65">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <Link href="/privacy" className="underline underline-offset-2">
            {t(lang, "footer_privacy")}
          </Link>
          <Link href="/terms" className="underline underline-offset-2">
            {t(lang, "footer_terms")}
          </Link>
          <a href="mailto:biraderdestek@gmail.com" className="underline underline-offset-2">
            biraderdestek@gmail.com
          </a>
        </div>
        <div className="opacity-60">{t(lang, "footer_project_tagline")}</div>
      </div>
    </footer>
  );
}
