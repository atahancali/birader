"use client";

import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";

export default function HealthNoticeBar() {
  const { lang } = useAppLang("tr");
  return (
    <div className="sticky top-0 z-20 border-b border-amber-300/20 bg-gradient-to-r from-amber-500/10 via-black/80 to-amber-500/10 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4 py-2 text-center text-[11px] leading-relaxed text-amber-100/80 sm:text-xs">
        {tx(
          lang,
          "Alkol sağlığa zararlıdır. Sorumlu tüketin. 18 yaş altındakilere alkol satışı ve sunumu yasaktır.",
          "Drink responsibly. Sale and service of alcohol to people under 18 is prohibited."
        )}
      </div>
    </div>
  );
}
