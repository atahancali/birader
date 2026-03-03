"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deleteCookie, readCookie, writeCookie } from "@/lib/cookies";

const AGE_COOKIE = "age_verified_18";
const CONSENT_COOKIE = "cookie_consent";
const ANALYTICS_COOKIE = "cookie_analytics";

type ConsentValue = "" | "accepted" | "rejected" | "custom";

export default function ComplianceLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [consent, setConsent] = useState<ConsentValue>("");
  const [manageOpen, setManageOpen] = useState(false);
  const [analyticsPref, setAnalyticsPref] = useState(false);

  useEffect(() => {
    setAgeVerified(readCookie(AGE_COOKIE) === "yes");
    const consentValue = readCookie(CONSENT_COOKIE);
    if (consentValue === "accepted" || consentValue === "rejected" || consentValue === "custom") {
      setConsent(consentValue);
    }
    setAnalyticsPref(readCookie(ANALYTICS_COOKIE) === "1");

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session?.user?.id));
      setSessionChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user?.id));
      setSessionChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const skipAgeGateRoute = pathname === "/underage";
  const showAgeGate = sessionChecked && !skipAgeGateRoute && !isAuthenticated && !ageVerified;
  const showConsentBanner = sessionChecked && !showAgeGate && pathname !== "/underage" && !consent;

  function acceptAge() {
    writeCookie(AGE_COOKIE, "yes", { path: "/", sameSite: "Lax" });
    setAgeVerified(true);
  }

  function rejectAge() {
    router.replace("/underage");
  }

  function acceptCookies() {
    writeCookie(CONSENT_COOKIE, "accepted", { days: 365, path: "/", sameSite: "Lax" });
    writeCookie(ANALYTICS_COOKIE, "1", { days: 365, path: "/", sameSite: "Lax" });
    setConsent("accepted");
    setManageOpen(false);
  }

  function rejectCookies() {
    writeCookie(CONSENT_COOKIE, "rejected", { days: 365, path: "/", sameSite: "Lax" });
    deleteCookie(ANALYTICS_COOKIE);
    setConsent("rejected");
    setManageOpen(false);
  }

  function savePreferences() {
    writeCookie(CONSENT_COOKIE, "custom", { days: 365, path: "/", sameSite: "Lax" });
    if (analyticsPref) {
      writeCookie(ANALYTICS_COOKIE, "1", { days: 365, path: "/", sameSite: "Lax" });
    } else {
      deleteCookie(ANALYTICS_COOKIE);
    }
    setConsent("custom");
    setManageOpen(false);
  }

  if (!sessionChecked) {
    return <div className="fixed inset-0 z-[120] bg-black" aria-hidden />;
  }

  return (
    <>
      {showAgeGate ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/95 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/85 p-5">
            <div className="text-lg font-semibold text-amber-200">18+ Yas Onayi</div>
            <p className="mt-2 text-sm opacity-85">18 yasinda veya daha buyuk musunuz?</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={acceptAge}
                className="rounded-xl border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-sm"
              >
                Evet, 18+ yasindayim
              </button>
              <button
                type="button"
                onClick={rejectAge}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
              >
                Hayir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConsentBanner ? (
        <div className="fixed inset-x-0 bottom-0 z-[125] border-t border-white/10 bg-black/90 p-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs opacity-80">
              Cerez tercihlerinizi yonetin. Zorunlu olmayan cerezler yalnizca izin verdiginizde kullanilir.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={acceptCookies}
                className="rounded-lg border border-amber-300/35 bg-amber-500/15 px-3 py-1.5 text-xs"
              >
                Kabul Et
              </button>
              <button
                type="button"
                onClick={rejectCookies}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
              >
                Reddet
              </button>
              <button
                type="button"
                onClick={() => setManageOpen((v) => !v)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
              >
                Tercihleri Yonet
              </button>
            </div>
          </div>
          {manageOpen ? (
            <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-white/10 bg-black/50 p-3">
              <label className="flex items-center gap-2 text-xs opacity-90">
                <input
                  type="checkbox"
                  checked={analyticsPref}
                  onChange={(e) => setAnalyticsPref(e.target.checked)}
                />
                Analitik cerezlerine izin ver
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={savePreferences}
                  className="rounded-lg border border-amber-300/35 bg-amber-500/15 px-3 py-1.5 text-xs"
                >
                  Tercihleri Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setManageOpen(false)}
                  className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
                >
                  Vazgec
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
