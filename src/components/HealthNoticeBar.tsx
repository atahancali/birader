"use client";

import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";

export default function HealthNoticeBar() {
  const { lang } = useAppLang("tr");
  return (
    <div className="sticky top-0 z-20 border-b border-amber-300/15 bg-black/70 backdrop-blur-md">
      <div className="mx-auto w-full max-w-5xl px-4 py-1.5 text-center text-[10px] leading-relaxed text-amber-100/70 sm:text-[11px]">
        {tx(
          lang,
          "Alkol sağlığa zararlıdır. Sorumlu tüketin. 18 yaş altındakilere alkol satışı ve sunumu yasaktır.",
          "Drink responsibly. Sale and service of alcohol to people under 18 is prohibited."
        )}
      </div>
    </div>
  );
}
