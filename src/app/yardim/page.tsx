"use client";

import Link from "next/link";
import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";

export default function HelpPage() {
  const { lang, setLang } = useAppLang("tr");
  return (
    <main className="min-h-screen max-w-md mx-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{tx(lang, "Birader Yardım", "Birader Help")}</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLang("tr")}
            className={`rounded-md border px-2 py-0.5 text-[10px] ${lang === "tr" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"}`}
          >
            TR
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-md border px-2 py-0.5 text-[10px] ${lang === "en" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"}`}
          >
            EN
          </button>
        </div>
        <Link href="/" className="text-xs underline opacity-80">
          {tx(lang, "Ana sayfa", "Home")}
        </Link>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">{tx(lang, "0. Interaktif Tur", "0. Interactive Tour")}</div>
          <Link href="/?tutorial=1" className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs">
            {tx(lang, "Turu Baslat", "Start Tour")}
          </Link>
        </div>
        <div className="mt-2 text-sm opacity-85">
          {tx(
            lang,
            "Uygulama icinde adim adim sekme degistiren turu ac. Log, sosyal, harita, istatistik akisini tek tek gosterir.",
            "Open the in-app guided tour with step-by-step tab navigation. It shows log, social, map and stats flow."
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">{tx(lang, "1. Hızlı Log", "1. Quick Log")}</div>
        <div className="mt-2 text-sm opacity-85">{tx(lang, "`Logla` adımlarını takip et: format, bira, detay, onay.", "Follow `Log` steps: format, beer, details, confirm.")}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">{tx(lang, "2. Geriye Dönük Toplu Log", "2. Backdated Bulk Log")}</div>
        <div className="mt-2 text-sm opacity-85">{tx(lang, "Tarih geçmişse adet girip listeye ekle. 10 adet üstü yok. Toplu ekleme için `Eminim` onayı gerekli.", "If date is in the past, set quantity and add to list. Maximum is 10. Bulk save needs `I'm sure` confirmation.")}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">{tx(lang, "3. Heatmap ve Gün Detayı", "3. Heatmap and Day Detail")}</div>
        <div className="mt-2 text-sm opacity-85">{tx(lang, "Haritadan güne dokun, gün detayında bira ekleyebilir veya `Secimli ekrana git` ile wizard’a geçebilirsin.", "Tap a day on map. In day detail you can add beer or jump to wizard via `Go to guided log`.")}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">{tx(lang, "4. Sosyal ve Öneri", "4. Social and Feedback")}</div>
        <div className="mt-2 text-sm opacity-85">{tx(lang, "Sosyalde takip/akış/leaderboard var. Sağ alttaki `Oneri` butonuyla istek ve bug bildirebilirsin.", "Social has follow/feed/leaderboard. Use `Suggest` button at bottom-right for requests and bug reports.")}</div>
      </section>
    </main>
  );
}
