"use client";

import Link from "next/link";
import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";

export default function UnderagePage() {
  const { lang } = useAppLang("tr");
  return (
    <main className="min-h-screen max-w-md mx-auto p-4">
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h1 className="text-xl font-semibold text-amber-200">{tx(lang, "Erisim Izni Yok", "Access Not Allowed")}</h1>
        <p className="mt-2 text-sm opacity-85">
          {tx(lang, "Bu içeriğe erişim yalnızca 18 yaş ve üzeri kullanıcılar için açıktır.", "This content is available only to users aged 18 and above.")}
        </p>
        <Link href="/" className="mt-4 inline-block text-xs underline opacity-80">
          {tx(lang, "Ana sayfaya don", "Go to homepage")}
        </Link>
      </section>
    </main>
  );
}
