"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const DISMISS_KEY = "birader_install_bar_dismissed_at";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export default function InstallPromptBar() {
  const pathname = usePathname();
  const { lang } = useAppLang("tr");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const ts = raw ? Number(raw) : 0;
      if (Number.isFinite(ts) && ts > 0 && Date.now() - ts < DISMISS_MS) {
        setDismissed(true);
      }
    } catch {}

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session?.user?.id));
      setSessionChecked(true);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user?.id));
      setSessionChecked(true);
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      authSub.subscription.unsubscribe();
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function triggerInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {}
    setInstalling(false);
  }

  const hiddenByRoute = pathname === "/privacy" || pathname === "/terms" || pathname === "/underage";
  if (!sessionChecked || !isAuthenticated || hiddenByRoute || dismissed || installed) return null;

  const showWebInstall = Boolean(deferredPrompt);
  const ios = isIosDevice();

  return (
    <section className="mx-auto mt-3 w-full max-w-5xl px-4">
      <div className="rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-500/10 via-black/35 to-amber-500/10 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-200">{tx(lang, "Birader Mobile", "Birader Mobile")}</div>
            <div className="text-xs opacity-80">
              {showWebInstall
                ? tx(lang, "Web uygulamayi tek tikla kur veya mobil uygulama magaza linklerini kullan.", "Install web app in one tap or use mobile store links.")
                : ios
                  ? tx(lang, "Safari'de Paylas > Ana Ekrana Ekle ile kurulum yapabilirsin.", "On Safari, use Share > Add to Home Screen.")
                  : tx(lang, "Mobil magaza linklerinden uygulamayi acabilir veya indirebilirsin.", "Open or download the app from mobile store links.")}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showWebInstall ? (
              <button
                type="button"
                onClick={() => void triggerInstall()}
                disabled={installing}
                className="rounded-lg border border-amber-300/35 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-60"
              >
                {installing ? tx(lang, "Kuruluyor...", "Installing...") : tx(lang, "Web app kur", "Install web app")}
              </button>
            ) : null}
            <a
              href="https://apps.apple.com?utm_source=birader_web"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store?utm_source=birader_web"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
            >
              Google Play
            </a>
            <Link
              href="/yardim"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
            >
              {tx(lang, "Yardim", "Help")}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs"
              aria-label={tx(lang, "Kapat", "Close")}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
