"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import DayModal from "@/components/DayModal";
import MonthZoom from "@/components/MonthZoom";
import FieldHeatmap from "@/components/FieldHeatmap";
import FootballHeatmap from "@/components/FootballHeatmap";
import GeoHeatmap from "@/components/GeoHeatmap";
import { normalizeUsername, usernameFromEmail, usernameToCandidateEmails } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";
import { TURKEY_CITIES, districtsForCity } from "@/lib/trLocations";
import { DAY_PERIOD_OPTIONS, dayPeriodLabelEn, dayPeriodLabelTr, type DayPeriod } from "@/lib/dayPeriod";
import { HEATMAP_PALETTES } from "@/lib/heatmapTheme";
import { getExperimentVariant } from "@/lib/ab";
import { t, tx } from "@/lib/i18n";
import { useAppLang } from "@/lib/appLang";

const SocialPanel = dynamic(() => import("@/components/SocialPanel"), {
  ssr: false,
  loading: () => <div className="mt-6 text-xs opacity-60">Sosyal yukleniyor... / Loading social...</div>,
});

type Checkin = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
  day_period?: DayPeriod | null;
  country_code?: string | null;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
  price_try?: number | null;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  media_url?: string | null;
  media_type?: string | null;
};

type FavoriteBeer = {
  beer_name: string;
  rank: number;
};

type HeaderProfile = {
  username: string;
  display_name?: string | null;
  avatar_path?: string | null;
  is_admin?: boolean | null;
  heatmap_color_from?: string | null;
  heatmap_color_to?: string | null;
  referral_code?: string | null;
};
type ProductSuggestionRow = {
  id: number;
  user_id: string | null;
  category: string;
  message: string;
  status: "new" | "in_progress" | "done";
  created_at: string;
  username?: string | null;
  display_name?: string | null;
};
type UserBadgeRow = {
  badge_key: string;
  title_tr: string;
  title_en: string;
  detail_tr: string;
  detail_en: string;
  score: number;
  computed_at: string;
};

type HomeSection = "log" | "social" | "heatmap" | "stats";
type LocationSuggestion = { city: string; district: string; score: number };
const MAX_BULK_BACKDATE_COUNT = 10;
const ONBOARDING_SEEN_KEY = "birader:onboarding:v1";
const PENDING_COMPLIANCE_KEY = "birader:pending-compliance:v1";
const LOG_SUBMIT_COOLDOWN_MS = 10_000;
const HEATMAP_THEME_KEY = "birader:heatmap-theme:v1";
const REFERRAL_KEY = "birader:pending-referral:v1";
const OFFLINE_LOG_QUEUE_KEY = "birader:offline-log-queue:v1";
const TUTORIAL_DONE_KEY = "birader:tutorial-done:v1";
const CHECKINS_SELECT_WITH_MEDIA =
  "id, beer_name, rating, created_at, day_period, country_code, city, district, location_text, price_try, note, latitude, longitude, media_url, media_type";
const CHECKINS_SELECT_BASE =
  "id, beer_name, rating, created_at, day_period, country_code, city, district, location_text, price_try, note, latitude, longitude";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type TutorialStep = {
  title: string;
  desc: string;
  section: HomeSection;
};

type BeerItem = {
  brand: string;
  format: "Fici" | "Şişe/Kutu";
  ml: number;
};

const BEER_CATALOG: BeerItem[] = [
  { brand: "Efes Pilsen", format: "Fici", ml: 300 },
  { brand: "Efes Pilsen", format: "Fici", ml: 500 },
  { brand: "Belfast", format: "Fici", ml: 500 },
  { brand: "Bomonti Filtresiz", format: "Fici", ml: 300 },
  { brand: "Bomonti Filtresiz", format: "Fici", ml: 500 },
  { brand: "Bomonti Red Ale", format: "Fici", ml: 500 },
  { brand: "Marmara Gold", format: "Fici", ml: 500 },
  { brand: "Beck’s", format: "Fici", ml: 500 },
  { brand: "Miller Genuine Draft", format: "Fici", ml: 500 },
  { brand: "Amsterdam Navigator", format: "Fici", ml: 500 },
  { brand: "Desperados", format: "Fici", ml: 500 },
  { brand: "Tuborg Gold", format: "Fici", ml: 300 },
  { brand: "Tuborg Gold", format: "Fici", ml: 500 },
  { brand: "Tuborg Amber", format: "Fici", ml: 500 },
  { brand: "Tuborg Filtresiz", format: "Fici", ml: 500 },
  { brand: "Carlsberg", format: "Fici", ml: 500 },
  { brand: "Troy", format: "Fici", ml: 500 },
  { brand: "Heineken", format: "Fici", ml: 500 },
  { brand: "Corona Extra", format: "Fici", ml: 500 },
  { brand: "Leffe Blonde", format: "Fici", ml: 500 },
  { brand: "Stella Artois", format: "Fici", ml: 500 },
  { brand: "Guinness", format: "Fici", ml: 500 },
  { brand: "Bud", format: "Fici", ml: 500 },
  { brand: "Hoegaarden", format: "Fici", ml: 500 },
  { brand: "1664 Blanc", format: "Fici", ml: 500 },
  { brand: "Paulaner Hefe Weissbier", format: "Fici", ml: 500 },
  { brand: "Erdinger Weissbier", format: "Fici", ml: 500 },

  { brand: "Efes Pilsen", format: "Şişe/Kutu", ml: 330 },
  { brand: "Efes Pilsen", format: "Şişe/Kutu", ml: 500 },
  { brand: "Belfast", format: "Şişe/Kutu", ml: 500 },
  { brand: "Efes Malt", format: "Şişe/Kutu", ml: 500 },
  { brand: "Efes %100 Malt", format: "Şişe/Kutu", ml: 500 },
  { brand: "Efes Özel Seri", format: "Şişe/Kutu", ml: 500 },
  { brand: "Efes Dark", format: "Şişe/Kutu", ml: 500 },
  { brand: "Efes Glutensiz", format: "Şişe/Kutu", ml: 500 },
  { brand: "Bomonti Filtresiz", format: "Şişe/Kutu", ml: 500 },
  { brand: "Bomonti Red Ale", format: "Şişe/Kutu", ml: 500 },
  { brand: "Bomonti Black", format: "Şişe/Kutu", ml: 500 },
  { brand: "Marmara Gold", format: "Şişe/Kutu", ml: 500 },
  { brand: "Marmara Kırmızı", format: "Şişe/Kutu", ml: 500 },
  { brand: "Beck’s", format: "Şişe/Kutu", ml: 330 },
  { brand: "Beck’s", format: "Şişe/Kutu", ml: 500 },
  { brand: "Beck’s Gold", format: "Şişe/Kutu", ml: 330 },
  { brand: "Miller Genuine Draft", format: "Şişe/Kutu", ml: 330 },
  { brand: "Amsterdam Navigator", format: "Şişe/Kutu", ml: 500 },
  { brand: "Amsterdam Dark", format: "Şişe/Kutu", ml: 500 },
  { brand: "Desperados", format: "Şişe/Kutu", ml: 330 },
  { brand: "Tuborg Gold", format: "Şişe/Kutu", ml: 500 },
  { brand: "Tuborg Amber", format: "Şişe/Kutu", ml: 500 },
  { brand: "Tuborg Special", format: "Şişe/Kutu", ml: 500 },
  { brand: "Tuborg Filtresiz", format: "Şişe/Kutu", ml: 500 },
  { brand: "Tuborg Shot", format: "Şişe/Kutu", ml: 250 },
  { brand: "Tuborg Christmas Brew", format: "Şişe/Kutu", ml: 500 },
  { brand: "Carlsberg", format: "Şişe/Kutu", ml: 500 },
  { brand: "Carlsberg Luna", format: "Şişe/Kutu", ml: 500 },
  { brand: "Carlsberg Special Brew", format: "Şişe/Kutu", ml: 500 },
  { brand: "Troy", format: "Şişe/Kutu", ml: 500 },
  { brand: "Venüs", format: "Şişe/Kutu", ml: 500 },
  { brand: "Skol", format: "Şişe/Kutu", ml: 500 },
  { brand: "Stella Artois", format: "Şişe/Kutu", ml: 330 },
  { brand: "Stella Artois", format: "Şişe/Kutu", ml: 500 },
  { brand: "Heineken", format: "Şişe/Kutu", ml: 330 },
  { brand: "Heineken", format: "Şişe/Kutu", ml: 500 },
  { brand: "Heineken Silver", format: "Şişe/Kutu", ml: 330 },
  { brand: "Corona Extra", format: "Şişe/Kutu", ml: 330 },
  { brand: "Bud", format: "Şişe/Kutu", ml: 330 },
  { brand: "Budweiser", format: "Şişe/Kutu", ml: 330 },
  { brand: "Budvar", format: "Şişe/Kutu", ml: 330 },
  { brand: "Leffe Blonde", format: "Şişe/Kutu", ml: 330 },
  { brand: "Leffe Brune", format: "Şişe/Kutu", ml: 330 },
  { brand: "Duvel", format: "Şişe/Kutu", ml: 330 },
  { brand: "Guinness", format: "Şişe/Kutu", ml: 440 },
  { brand: "Hoegaarden", format: "Şişe/Kutu", ml: 330 },
  { brand: "1664 Blanc", format: "Şişe/Kutu", ml: 330 },
  { brand: "Paulaner Hefe Weissbier", format: "Şişe/Kutu", ml: 500 },
  { brand: "Erdinger Weissbier", format: "Şişe/Kutu", ml: 500 },
  { brand: "Weihenstephaner Hefe Weissbier", format: "Şişe/Kutu", ml: 500 },
  { brand: "Grimbergen Blonde", format: "Şişe/Kutu", ml: 330 },
  { brand: "Chimay Blue", format: "Şişe/Kutu", ml: 330 },
  { brand: "Bistro Lager", format: "Şişe/Kutu", ml: 330 },
];

const LS_KEY = "birader:checkins:v1";

function loadLocalCheckins(): Checkin[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Checkin[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCheckins(next: Checkin[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function beerLabel(b: BeerItem) {
  return `${b.brand} — ${b.format} — ${b.ml}ml`;
}

function beerStyleLabel(b: BeerItem) {
  return `${b.brand} — ${b.format}`;
}

function inferFormatFromBeerName(label: string): BeerItem["format"] {
  if (label.includes("— Fici —")) return "Fici";
  if (label.includes("— Şişe/Kutu —")) return "Şişe/Kutu";
  return "Fici";
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function sanitizeRating(n: number | null | undefined) {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  return Math.round(clamp(v, 0.5, 5) * 2) / 2;
}

function sanitizePrice(input: string) {
  const normalized = input.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function inferMediaType(urlRaw: string) {
  const url = urlRaw.trim().toLowerCase();
  if (!url) return "";
  if (url.match(/\.(mp4|webm|mov)(\?|$)/) || url.includes("video")) return "video";
  return "image";
}

function isMissingMediaColumnError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") && (msg.includes("media_url") || msg.includes("media_type"));
}

function normalizeTR(input: string) {
  return input
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .trim();
}

function looksLikeEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim().toLowerCase());
}

function randomReferralCode() {
  return `b${Math.random().toString(36).slice(2, 8)}`;
}

function ageFromBirthDate(isoDate: string) {
  if (!isoDate) return 0;
  const birth = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
] as const;

function emailDomainSuggestions(rawInput: string) {
  const value = rawInput.trim().toLowerCase();
  if (!value) return [] as string[];

  if (!value.includes("@")) {
    return COMMON_EMAIL_DOMAINS.map((d) => `${value}@${d}`);
  }

  const [localPart, rawDomain = ""] = value.split("@");
  if (!localPart) return [] as string[];

  return COMMON_EMAIL_DOMAINS
    .filter((d) => d.startsWith(rawDomain))
    .map((d) => `${localPart}@${d}`);
}

function StarIcon({ fillRatio, id }: { fillRatio: 0 | 0.5 | 1; id: string }) {
  const pct = fillRatio === 1 ? 100 : fillRatio === 0.5 ? 50 : 0;
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset={`${pct}%`} stopColor="rgba(255,255,255,0.95)" />
          <stop offset={`${pct}%`} stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function StarRatingHalf({
  value,
  onChange,
  max = 5,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const safeValue = value ?? 0;
  const display = hover ?? safeValue;

  function getFillRatio(starIndex1toN: number) {
    const fullBefore = starIndex1toN - 1;
    if (display >= starIndex1toN) return 1 as const;
    if (display <= fullBefore) return 0 as const;
    return 0.5 as const;
  }

  function handlePointer(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const half = x < rect.width / 2 ? 0.5 : 1;
    setHover(star - 1 + half);
  }

  function commit(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const half = x < rect.width / 2 ? 0.5 : 1;
    const v = star - 1 + half;
    onChange(v === safeValue ? null : v);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rating"
      >
        {Array.from({ length: max }).map((_, i) => {
          const star = i + 1;
          const fillRatio = getFillRatio(star);
          const gid = `star-grad-${star}`;
          return (
            <button
              key={star}
              type="button"
              className="p-1"
              onMouseMove={(e) => handlePointer(e, star)}
              onMouseEnter={(e) => handlePointer(e, star)}
              onClick={(e) => commit(e, star)}
              aria-label={`${star} star`}
              role="radio"
              aria-checked={safeValue >= star}
            >
              <div
                className={
                  fillRatio > 0 ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]" : ""
                }
              >
                <StarIcon fillRatio={fillRatio} id={gid} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-sm opacity-70 w-14 text-right">
        {value !== null ? value.toFixed(1) : "—"}
      </div>
    </div>
  );
}

function ComboboxBeer({
  formatLabel,
  query,
  setQuery,
  pinned,
  options,
  value,
  onChange,
  lang,
}: {
  formatLabel: string;
  query: string;
  setQuery: (v: string) => void;
  pinned: string[];
  options: string[];
  value: string;
  onChange: (v: string) => void;
  lang: "tr" | "en";
}) {
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const shownPinned = q ? pinned.filter((x) => x.toLowerCase().includes(q)) : pinned;
  const shownOptions = q ? options.filter((x) => x.toLowerCase().includes(q)) : options;

  const pinnedSet = new Set(shownPinned);
  const merged = [...shownPinned, ...shownOptions.filter((x) => !pinnedSet.has(x))].slice(0, 30);
  const customCandidate = query.trim();
  const hasExact =
    !!customCandidate &&
    [...options, ...pinned].some((x) => x.toLowerCase() === customCandidate.toLowerCase());

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      {pinned.length > 0 && (
        <div className="mb-2">
          <div className="mb-2 text-[11px] opacity-60">{tx(lang, "★ En cok ictiklerin", "★ Most consumed")}</div>
          <div className="flex flex-wrap gap-2">
            {pinned.slice(0, 6).map((b) => {
              const active = b === value;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => onChange(b)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5"
                  }`}
                  title={b}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={tx(lang, `${formatLabel} icin ara... (orn. efes, 330)`, `Search in ${formatLabel}... (e.g. efes, 330)`)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-white/25"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
        >
          {open ? tx(lang, "Kapat", "Close") : tx(lang, "Ac", "Open")}
        </button>
      </div>

      <div className="mt-2 text-xs opacity-70">
        {tx(lang, "Secili", "Selected")}: <span className="opacity-90">{value || "—"}</span>
      </div>

      {open && (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/60 p-2">
          {customCandidate && !hasExact ? (
            <button
              type="button"
              onClick={() => {
                onChange(customCandidate);
                setQuery(customCandidate);
                setOpen(false);
              }}
              className="mb-2 w-full rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-2 text-left text-sm"
            >
              {tx(lang, "Listede yok, bunu kullan", "Not in list, use this")}: {customCandidate}
            </button>
          ) : null}
          {merged.length === 0 ? (
            <div className="px-2 py-2 text-sm opacity-60">{tx(lang, "Sonuc yok.", "No results.")}</div>
          ) : (
            merged.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  onChange(b);
                  setOpen(false);
                }}
                className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10 ${
                  b === value ? "bg-white/10" : ""
                }`}
              >
                {b}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<any>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [checkins, setCheckins] = useState<Checkin[]>([]);

  // Local'dan ilk yükleme
  useEffect(() => {
    const local = loadLocalCheckins();
    if (local.length) setCheckins(local);
  }, []);

  // Local'a otomatik kaydet
  useEffect(() => {
    saveLocalCheckins(checkins);
  }, [checkins]);

  const dayCheckins = selectedDay
    ? checkins.filter((c) => {
        const d = new Date(c.created_at);
        const iso = d.toISOString().slice(0, 10);
        return iso === selectedDay;
      })
    : [];

  // auth
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [signupBirthDate, setSignupBirthDate] = useState("");
  const [signupTermsAccepted, setSignupTermsAccepted] = useState(false);
  const [signupPrivacyAccepted, setSignupPrivacyAccepted] = useState(false);
  const [signupCommercialAccepted, setSignupCommercialAccepted] = useState(false);
  const [signupMarketingOptIn, setSignupMarketingOptIn] = useState(false);
  const authEmailSuggestions = useMemo(
    () =>
      authMode === "signup"
        ? emailDomainSuggestions(authIdentifier).slice(0, 4)
        : ([] as string[]),
    [authIdentifier, authMode]
  );

  async function upsertComplianceProfile(userId: string, email: string, payload: {
    birthDate: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    commercialAccepted: boolean;
    marketingOptIn: boolean;
  }) {
    const username = usernameFromEmail(email) || `user-${userId.slice(0, 6)}`;
    const now = new Date().toISOString();
    const age = ageFromBirthDate(payload.birthDate);
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        username,
        display_name: username,
        birth_date: payload.birthDate || null,
        age_verified_at: age >= 18 ? now : null,
        terms_accepted_at: payload.termsAccepted ? now : null,
        privacy_accepted_at: payload.privacyAccepted ? now : null,
        commercial_consent_at: payload.commercialAccepted ? now : null,
        marketing_opt_in: payload.marketingOptIn,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("compliance profile upsert error", error.message);
      throw error;
    }
  }

  async function authWithUsernamePassword() {
    const identifier = authIdentifier.trim().toLowerCase();
    const p = password;
    if (!identifier || !p) return;

    const isEmail = looksLikeEmail(identifier);
    const emailCandidates = isEmail ? [identifier] : usernameToCandidateEmails(identifier);
    if (!emailCandidates.length) {
      alert("Geçerli bir kullanıcı adı veya e-posta gir.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        if (!isEmail) {
          alert("Kayıt için e-posta girmen gerekiyor.");
          return;
        }
        if (!signupBirthDate) {
          alert("Dogum tarihi zorunlu.");
          return;
        }
        const age = ageFromBirthDate(signupBirthDate);
        if (age < 18) {
          alert(tx(lang, "Birader 18+ kullanicilar icindir.", "Birader is for 18+ users."));
          return;
        }
        if (!signupTermsAccepted || !signupPrivacyAccepted || !signupCommercialAccepted) {
          alert("Devam etmek icin yasal ve ticari onay kutularini isaretle.");
          return;
        }

        const signupEmail = emailCandidates[0];
        const compliancePayload = {
          birthDate: signupBirthDate,
          termsAccepted: signupTermsAccepted,
          privacyAccepted: signupPrivacyAccepted,
          commercialAccepted: signupCommercialAccepted,
          marketingOptIn: signupMarketingOptIn,
        };
        try {
          localStorage.setItem(
            PENDING_COMPLIANCE_KEY,
            JSON.stringify({ email: signupEmail, ...compliancePayload })
          );
        } catch {}
        const { data: signupData, error } = await supabase.auth.signUp({
          email: signupEmail,
          password: p,
        });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("rate limit")) {
            alert("Çok sık kayıt denemesi yapıldı. 1-2 dakika bekleyip tekrar dene.");
          } else {
            alert(error.message || "Kayıt başarısız.");
          }
          return;
        }

        if (signupData.session) {
          try {
            await upsertComplianceProfile(signupData.session.user.id, signupEmail, compliancePayload);
            localStorage.removeItem(PENDING_COMPLIANCE_KEY);
            const ref = (localStorage.getItem(REFERRAL_KEY) || "").trim();
            if (ref) {
              trackEvent({ eventName: "referral_signup", userId: signupData.session.user.id, props: { ref } });
              localStorage.removeItem(REFERRAL_KEY);
            }
          } catch {}
          trackEvent({
            eventName: "auth_success",
            props: { mode: "signup", email: signupEmail, auto_login: true },
          });
          return;
        }

        const { error: e2 } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: p,
        });
        if (e2) {
          const msg = (e2.message || "").toLowerCase();
          if (msg.includes("email not confirmed")) {
            alert("Hesap oluşturuldu. Giriş için e-postanı doğrula.");
          } else {
            alert(e2.message);
          }
        } else {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) {
            try {
              await upsertComplianceProfile(s.session.user.id, signupEmail, compliancePayload);
              localStorage.removeItem(PENDING_COMPLIANCE_KEY);
              const ref = (localStorage.getItem(REFERRAL_KEY) || "").trim();
              if (ref) {
                trackEvent({ eventName: "referral_signup", userId: s.session.user.id, props: { ref } });
                localStorage.removeItem(REFERRAL_KEY);
              }
            } catch {}
          }
          trackEvent({
            eventName: "auth_success",
            props: { mode: "signup", email: signupEmail },
          });
        }
      } else {
        // Login için email girildiyse direkt, kullanıcı adı girildiyse legacy dahil dener.
        const attempts = emailCandidates;
        let lastError: string | null = null;
        let loggedIn = false;

        for (const email of attempts) {
          const { error } = await supabase.auth.signInWithPassword({ email, password: p });
          if (!error) {
            loggedIn = true;
            break;
          }
          lastError = error.message;
        }

        if (!loggedIn && lastError) {
          alert(lastError);
        } else if (loggedIn) {
          trackEvent({
            eventName: "auth_success",
            props: { mode: "login", identifier },
          });
        }
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function installPwa() {
    if (!pwaPromptEvent) return;
    await pwaPromptEvent.prompt();
    try {
      await pwaPromptEvent.userChoice;
    } catch {}
    setPwaPromptEvent(null);
    setPwaInstallOpen(false);
  }

  // logging state
  const today = useMemo(() => isoTodayLocal(), []);
  const [format, setFormat] = useState<BeerItem["format"]>("Fici");
  const [formatConfirmed, setFormatConfirmed] = useState(false);
  const [beerQuery, setBeerQuery] = useState("");
  const [beerName, setBeerName] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [city, setCity] = useState<string>(TURKEY_CITIES[39] ?? "Istanbul");
  const [district, setDistrict] = useState<string>("");
  const [customDistrict, setCustomDistrict] = useState("");
  const [locationSuggestQuery, setLocationSuggestQuery] = useState("");
  const [remoteLocationSuggestions, setRemoteLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationText, setLocationText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [logNote, setLogNote] = useState("");
  const [dayPeriod, setDayPeriod] = useState<DayPeriod>("evening");
  const [activeRatingBucket, setActiveRatingBucket] = useState<number | null>(null);
  const [dateISO, setDateISO] = useState(today);
  const [dateOpen, setDateOpen] = useState(false);
  const [batchBeerNames, setBatchBeerNames] = useState<string[]>([]);
  const [batchCountInput, setBatchCountInput] = useState("1");
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const [favoriteOnSave, setFavoriteOnSave] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteBeer[]>([]);
  const [replaceFavoriteRank, setReplaceFavoriteRank] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<HomeSection>("log");
  const [logStep, setLogStep] = useState<1 | 2 | 3 | 4>(1);
  const [heatmapMode, setHeatmapMode] = useState<"football" | "grid">("football");
  const [gridCellMetric, setGridCellMetric] = useState<"color" | "count" | "avgRating">("color");
  const [gridColorFrom, setGridColorFrom] = useState<string>("#f59e0b");
  const [gridColorTo, setGridColorTo] = useState<string>("#ef4444");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionCategory, setSuggestionCategory] = useState("general");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [recentExpandStep, setRecentExpandStep] = useState(0);
  const [headerProfile, setHeaderProfile] = useState<HeaderProfile | null>(null);
  const [pwaPromptEvent, setPwaPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstallOpen, setPwaInstallOpen] = useState(false);
  const { lang, setLang } = useAppLang("tr");
  const [abOnboardingVariant, setAbOnboardingVariant] = useState<"A" | "B">("A");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIdx, setTutorialStepIdx] = useState(0);
  const [isLogMutating, setIsLogMutating] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [dbBadges, setDbBadges] = useState<UserBadgeRow[]>([]);
  const [badgeRefreshBusy, setBadgeRefreshBusy] = useState(false);
  const [adminSuggestions, setAdminSuggestions] = useState<ProductSuggestionRow[]>([]);
  const [adminSuggestionsBusy, setAdminSuggestionsBusy] = useState(false);
  const [adminReports, setAdminReports] = useState<Array<{
    id: number;
    reporter_id: string | null;
    target_user_id: string | null;
    target_type: string;
    target_id: string;
    reason: string;
    status: "open" | "reviewed" | "resolved";
    created_at: string;
  }>>([]);
  const [adminReportsBusy, setAdminReportsBusy] = useState(false);
  const [adminSuggestionStatusFilter, setAdminSuggestionStatusFilter] = useState<"all" | "new" | "in_progress" | "done">("all");
  const [adminSuggestionCategoryFilter, setAdminSuggestionCategoryFilter] = useState<string>("all");
  const lastLogAttemptAtRef = useRef(0);
  const logMutationLockRef = useRef(false);

  const year = useMemo(() => new Date().getFullYear(), []);
  const isBackDate = dateISO !== today;
  const districtOptions = useMemo(() => districtsForCity(city), [city]);
  const resolvedDistrict = useMemo(
    () => (district === "Diger" ? customDistrict.trim() : district.trim()),
    [customDistrict, district]
  );
  const canManageSuggestions = useMemo(
    () => isAdminUser,
    [isAdminUser]
  );

  function canOpenLogStep(step: 1 | 2 | 3 | 4) {
    if (step <= 1) return true;
    if (!formatConfirmed) return false;
    if (step >= 3 && !(isBackDate ? batchBeerNames.length > 0 || !!beerName : !!beerName)) return false;
    return true;
  }

  function goToLogStep(step: 1 | 2 | 3 | 4) {
    if (step < logStep) {
      setLogStep(step);
      return;
    }
    if (!canOpenLogStep(step)) {
      if (!formatConfirmed) alert("Once Adim 1'de sunum tarzini sec.");
      else alert("Once bira secimini tamamla.");
      return;
    }
    setLogStep(step);
  }

  function beginLogMutation() {
    if (logMutationLockRef.current || isLogMutating) {
      alert("Log islemi suruyor, lutfen bekle.");
      return false;
    }
    const now = Date.now();
    const elapsed = now - lastLogAttemptAtRef.current;
    if (elapsed < LOG_SUBMIT_COOLDOWN_MS) {
      const remain = Math.ceil((LOG_SUBMIT_COOLDOWN_MS - elapsed) / 1000);
      alert(`Cok hizli log atiyorsun. ${remain} sn bekle.`);
      return false;
    }
    lastLogAttemptAtRef.current = now;
    logMutationLockRef.current = true;
    setIsLogMutating(true);
    return true;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaPromptEvent(e as BeforeInstallPromptEvent);
      setPwaInstallOpen(true);
    };
    const onInstalled = () => {
      setPwaPromptEvent(null);
      setPwaInstallOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    setAbOnboardingVariant(getExperimentVariant("onboarding-copy-v1"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = (params.get("ref") || "").trim().toLowerCase();
      if (ref) localStorage.setItem(REFERRAL_KEY, ref);
      const tutorialParam = (params.get("tutorial") || "").trim();
      if (tutorialParam === "1") {
        setTutorialStepIdx(0);
        setTutorialOpen(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function flushPendingCompliance() {
      if (!session?.user?.id || !session?.user?.email) return;
      try {
        const raw = localStorage.getItem(PENDING_COMPLIANCE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          email?: string;
          birthDate?: string;
          termsAccepted?: boolean;
          privacyAccepted?: boolean;
          commercialAccepted?: boolean;
          marketingOptIn?: boolean;
        };
        if (!parsed?.email || parsed.email !== session.user.email) return;
        await upsertComplianceProfile(session.user.id, session.user.email, {
          birthDate: parsed.birthDate || "",
          termsAccepted: Boolean(parsed.termsAccepted),
          privacyAccepted: Boolean(parsed.privacyAccepted),
          commercialAccepted: Boolean(parsed.commercialAccepted),
          marketingOptIn: Boolean(parsed.marketingOptIn),
        });
        localStorage.removeItem(PENDING_COMPLIANCE_KEY);
      } catch {}
    }
    void flushPendingCompliance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, session?.user?.email]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HEATMAP_THEME_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { from?: string; to?: string };
      if (parsed.from) setGridColorFrom(parsed.from);
      if (parsed.to) setGridColorTo(parsed.to);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HEATMAP_THEME_KEY, JSON.stringify({ from: gridColorFrom, to: gridColorTo }));
    } catch {}
  }, [gridColorFrom, gridColorTo]);

  async function loadCheckins() {
    if (!session?.user?.id) return;

    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;

    const withMedia = await supabase
      .from("checkins")
      .select(CHECKINS_SELECT_WITH_MEDIA)
      .eq("user_id", session.user.id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (!withMedia.error) {
      setCheckins((withMedia.data as any) ?? []);
      return;
    }
    if (!isMissingMediaColumnError(withMedia.error)) {
      console.error(withMedia.error);
      return;
    }
    const fallback = await supabase
      .from("checkins")
      .select(CHECKINS_SELECT_BASE)
      .eq("user_id", session.user.id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (fallback.error) {
      console.error(fallback.error);
      return;
    }
    setCheckins((((fallback.data as any[]) ?? []).map((c) => ({ ...c, media_url: null, media_type: null })) as any) ?? []);
  }

  async function loadFavorites() {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("favorite_beers")
      .select("beer_name, rank")
      .eq("user_id", session.user.id)
      .order("rank", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }
    const normalized = ((data as FavoriteBeer[] | null) ?? []).map((f) => ({
      ...f,
      beer_name: favoriteBeerName(f.beer_name),
    }));
    setFavorites(normalized);
  }

  function readOfflineLogQueue() {
    try {
      const raw = localStorage.getItem(OFFLINE_LOG_QUEUE_KEY);
      if (!raw) return [] as Array<Record<string, any>>;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as Array<Record<string, any>>;
    }
  }

  function writeOfflineLogQueue(rows: Array<Record<string, any>>) {
    try {
      localStorage.setItem(OFFLINE_LOG_QUEUE_KEY, JSON.stringify(rows.slice(-200)));
    } catch {}
  }

  async function flushOfflineLogQueue() {
    if (!session?.user?.id) return;
    const queued = readOfflineLogQueue();
    if (!queued.length) return;
    const ownRows = queued.filter((r) => String(r.user_id) === session.user.id);
    if (!ownRows.length) return;
    const { error } = await supabase.from("checkins").insert(ownRows);
    if (!error) {
      const remained = queued.filter((r) => String(r.user_id) !== session.user.id);
      writeOfflineLogQueue(remained);
      await loadCheckins();
      trackEvent({ eventName: "offline_queue_flushed", userId: session.user.id, props: { count: ownRows.length } });
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadCheckins();
      loadFavorites();
      void flushOfflineLogQueue();
      void (async () => {
        let row: any = null;
        const withTheme = await supabase
          .from("profiles")
          .select("username, display_name, avatar_path, is_admin, heatmap_color_from, heatmap_color_to, referral_code")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!withTheme.error) {
          row = withTheme.data;
        } else {
          const fallback = await supabase
            .from("profiles")
            .select("username, display_name, avatar_path, is_admin, referral_code")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (!fallback.error) row = fallback.data;
        }

        if (row) {
          const sessionEmail = (session.user.email || "").trim().toLowerCase();
          const emailUser = usernameFromEmail(sessionEmail);
          const isBiraderAlias = /@birader\.(app|local)$/.test(sessionEmail);
          const rowUsername = String(row.username || "").trim().toLowerCase();

          // Self-heal: if auth alias username changed but profile.username is stale, sync it.
          if (emailUser && isBiraderAlias && rowUsername && emailUser !== rowUsername) {
            const taken = await supabase
              .from("profiles")
              .select("user_id")
              .eq("username", emailUser)
              .neq("user_id", session.user.id)
              .maybeSingle();
            if (!taken.error && !taken.data) {
              const oldDisplay = String(row.display_name || "").trim();
              const shouldSyncDisplay = !oldDisplay || normalizeUsername(oldDisplay.replace(/^@+/, "")) === rowUsername;
              const patch: Record<string, any> = { username: emailUser };
              if (shouldSyncDisplay) patch.display_name = emailUser;
              const syncRes = await supabase.from("profiles").update(patch).eq("user_id", session.user.id);
              if (!syncRes.error) {
                row = { ...row, ...patch };
              }
            }
          }

          // Self-heal: if display_name is old @handle-like value, keep it aligned with current username.
          const rowDisplay = String(row.display_name || "").trim();
          const rowDisplayNorm = normalizeUsername(rowDisplay.replace(/^@+/, ""));
          if (rowDisplay && rowDisplay.startsWith("@") && rowDisplayNorm && rowDisplayNorm !== String(row.username || "").trim().toLowerCase()) {
            const patch = { display_name: String(row.username || "").trim() };
            const syncDisplayRes = await supabase.from("profiles").update(patch).eq("user_id", session.user.id);
            if (!syncDisplayRes.error) {
              row = { ...row, ...patch };
            }
          }

          setIsAdminUser(Boolean(row.is_admin));
          setHeaderProfile({
            username: row.username,
            display_name: row.display_name,
            avatar_path: row.avatar_path,
            is_admin: Boolean(row.is_admin),
            heatmap_color_from: row.heatmap_color_from ?? null,
            heatmap_color_to: row.heatmap_color_to ?? null,
            referral_code: row.referral_code ?? null,
          });
          if (row.heatmap_color_from) setGridColorFrom(String(row.heatmap_color_from));
          if (row.heatmap_color_to) setGridColorTo(String(row.heatmap_color_to));
          void ensureReferralCode();
        } else {
          setIsAdminUser(false);
          setHeaderProfile({
            username: usernameFromEmail(session.user.email) || `user-${session.user.id.slice(0, 6)}`,
            display_name: "",
            avatar_path: "",
            is_admin: false,
            heatmap_color_from: null,
            heatmap_color_to: null,
            referral_code: null,
          });
        }
      })();
    } else {
      setIsAdminUser(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (canManageSuggestions) {
      void loadAdminSuggestions();
      void loadAdminReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageSuggestions]);

  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const seen = localStorage.getItem(ONBOARDING_SEEN_KEY);
      if (!seen) {
        setOnboardingOpen(true);
        trackEvent({
          eventName: "onboarding_impression",
          userId: session.user.id,
          props: { variant: abOnboardingVariant },
        });
      }
    } catch {}
  }, [abOnboardingVariant, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const done = localStorage.getItem(TUTORIAL_DONE_KEY);
      if (!done) {
        setTutorialOpen(true);
        setTutorialStepIdx(0);
      }
    } catch {}
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void supabase.rpc("refresh_my_badges");
    void loadMyBadges();
  }, [session?.user?.id]);

  useEffect(() => {
    if (favorites.length < 3) {
      setReplaceFavoriteRank(null);
      return;
    }
    if (replaceFavoriteRank === null) {
      setReplaceFavoriteRank(Number(favorites[0]?.rank ?? 1));
      return;
    }
    const stillValid = favorites.some((f) => Number(f.rank) === replaceFavoriteRank);
    if (!stillValid) setReplaceFavoriteRank(Number(favorites[0]?.rank ?? 1));
  }, [favorites, replaceFavoriteRank]);

  const topBeerLabelsByFormat = useMemo(() => {
    const countsF: Record<string, number> = {};
    const countsS: Record<string, number> = {};

    for (const c of checkins) {
      const name = c.beer_name || "";
      if (name.includes("— Fici —")) countsF[name] = (countsF[name] || 0) + 1;
      if (name.includes("— Şişe/Kutu —")) countsS[name] = (countsS[name] || 0) + 1;
    }

    const topN = (m: Record<string, number>, n = 6) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k]) => k);

    return {
      Fici: topN(countsF, 6),
      "Şişe/Kutu": topN(countsS, 6),
    } as Record<BeerItem["format"], string[]>;
  }, [checkins]);

  const ratingSteps = useMemo(() => Array.from({ length: 11 }, (_, i) => i * 0.5), []);

  const ratingDistribution = useMemo(() => {
    const buckets = ratingSteps.map((r) => ({ rating: r, count: 0, percent: 0 }));
    const ratedCheckins = checkins.filter((c) => c.rating !== null && c.rating !== undefined);
    const total = ratedCheckins.length;

    for (const c of ratedCheckins) {
      const raw = Number(c.rating ?? 0);
      const normalized = Math.round(clamp(raw, 0, 5) * 2) / 2;
      const idx = Math.round(normalized * 2);
      if (buckets[idx]) buckets[idx].count += 1;
    }

    const max = Math.max(1, ...buckets.map((b) => b.count));
    for (const b of buckets) {
      b.percent = total ? (b.count / total) * 100 : 0;
    }

    return { total, max, buckets };
  }, [checkins, ratingSteps]);

  const behaviorStats = useMemo(() => {
    const dayKeys = new Set<string>();
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    const hourBuckets = { night: 0, day: 0 };
    const cityCounts = new Map<string, number>();
    const locationCounts = new Map<string, number>();

    for (const c of checkins) {
      const d = new Date(c.created_at);
      if (!Number.isNaN(d.getTime())) {
        const key = d.toISOString().slice(0, 10);
        dayKeys.add(key);
        weekdayCounts[d.getDay()] += 1;
        const h = d.getHours();
        if (h >= 22 || h < 4) hourBuckets.night += 1;
        else hourBuckets.day += 1;
      }
      const city = (c.city || "").trim();
      if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      const loc = `${(c.city || "").trim()}::${(c.district || "").trim()}`;
      if (loc !== "::") locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    }

    const keysSorted = Array.from(dayKeys).sort();
    const msDay = 24 * 60 * 60 * 1000;
    let currentStreak = 0;
    if (keysSorted.length) {
      let cursor = new Date();
      while (true) {
        const key = cursor.toISOString().slice(0, 10);
        if (!dayKeys.has(key)) break;
        currentStreak += 1;
        cursor = new Date(cursor.getTime() - msDay);
      }
    }

    let maxStreak = 0;
    let run = 0;
    let prevTs = 0;
    for (const key of keysSorted) {
      const ts = new Date(`${key}T00:00:00Z`).getTime();
      if (prevTs && ts - prevTs === msDay) run += 1;
      else run = 1;
      if (run > maxStreak) maxStreak = run;
      prevTs = ts;
    }

    const saturdayLogs = weekdayCounts[6];
    const weekendLogs = weekdayCounts[0] + weekdayCounts[6];
    const totalLogs = checkins.length;
    const uniqueCities = cityCounts.size;
    const topLocationCount = Math.max(0, ...Array.from(locationCounts.values()));
    const topLocationShare = totalLogs ? topLocationCount / totalLogs : 0;
    const saturdayShare = totalLogs ? saturdayLogs / totalLogs : 0;
    const weekendShare = totalLogs ? weekendLogs / totalLogs : 0;
    const nightShare = totalLogs ? hourBuckets.night / totalLogs : 0;

    const weekdayLabels = ["Pazar", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
    let dominantWeekday = "—";
    let dominantWeekdayCount = 0;
    weekdayCounts.forEach((n, i) => {
      if (n > dominantWeekdayCount) {
        dominantWeekdayCount = n;
        dominantWeekday = weekdayLabels[i] || "—";
      }
    });

    const badges: Array<{ key: string; title: string; detail: string }> = [];
    if (saturdayLogs >= 5 && saturdayShare >= 0.4) {
      badges.push({ key: "sat", title: "Cumartesi Icicisi", detail: `${saturdayLogs} Cumartesi logu` });
    }
    if (currentStreak >= 7) {
      badges.push({ key: "streak7", title: "Her Guncu", detail: `${currentStreak} gun aktif streak` });
    }
    if (weekendLogs >= 8 && weekendShare >= 0.6) {
      badges.push({ key: "weekend", title: "Hafta Sonu Ruhu", detail: `%${Math.round(weekendShare * 100)} hafta sonu` });
    }
    if (hourBuckets.night >= 8 && nightShare >= 0.35) {
      badges.push({ key: "night", title: "Gece Kusu", detail: `${hourBuckets.night} gece logu` });
    }
    if (uniqueCities >= 5) {
      badges.push({ key: "explorer", title: "Sehir Kasifi", detail: `${uniqueCities} farkli sehir` });
    }
    if (topLocationCount >= 8 && topLocationShare >= 0.5) {
      badges.push({ key: "local", title: "Mahalle Muhtari", detail: `%${Math.round(topLocationShare * 100)} ayni bolge` });
    }

    return {
      currentStreak,
      maxStreak,
      uniqueDays: dayKeys.size,
      dominantWeekday,
      dominantWeekdayCount,
      saturdayLogs,
      weekendShare,
      nightShare,
      uniqueCities,
      badges,
    };
  }, [checkins]);

  const topBeersOverall = useMemo(() => {
    const counts = new Map<string, number>();
    const ratingAgg = new Map<string, { sum: number; rated: number }>();
    for (const c of checkins) {
      const key = favoriteBeerName(c.beer_name || "");
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      const current = ratingAgg.get(key) || { sum: 0, rated: 0 };
      if (c.rating !== null && c.rating !== undefined && Number(c.rating) > 0) {
        current.sum += Number(c.rating);
        current.rated += 1;
      }
      ratingAgg.set(key, current);
    }
    return Array.from(counts.entries())
      .map(([beer, logs]) => {
        const r = ratingAgg.get(beer) || { sum: 0, rated: 0 };
        const avg = r.rated ? Math.round((r.sum / r.rated) * 100) / 100 : 0;
        return { beer, logs, avg };
      })
      .sort((a, b) => (b.logs !== a.logs ? b.logs - a.logs : b.avg - a.avg))
      .slice(0, 5);
  }, [checkins]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();
    let currentLogs = 0;
    let previousLogs = 0;
    let currentRated = 0;
    let previousRated = 0;
    let currentRatingSum = 0;
    let previousRatingSum = 0;
    let unrated = 0;
    for (const c of checkins) {
      const d = new Date(c.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const m = d.getMonth();
      const y = d.getFullYear();
      const isRated = c.rating !== null && c.rating !== undefined && Number(c.rating) > 0;
      if (!isRated) unrated += 1;
      if (m === curMonth && y === curYear) {
        currentLogs += 1;
        if (isRated) {
          currentRated += 1;
          currentRatingSum += Number(c.rating);
        }
      } else if (m === prevMonth && y === prevYear) {
        previousLogs += 1;
        if (isRated) {
          previousRated += 1;
          previousRatingSum += Number(c.rating);
        }
      }
    }
    return {
      currentLogs,
      previousLogs,
      deltaLogs: currentLogs - previousLogs,
      currentAvg: currentRated ? Math.round((currentRatingSum / currentRated) * 100) / 100 : 0,
      previousAvg: previousRated ? Math.round((previousRatingSum / previousRated) * 100) / 100 : 0,
      unratedShare: checkins.length ? Math.round((unrated / checkins.length) * 100) : 0,
    };
  }, [checkins]);

  const weeklyRecap = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const weekly = checkins.filter((c) => {
      const dt = new Date(c.created_at);
      return dt >= start && dt <= now;
    });
    const rated = weekly.filter((c) => c.rating !== null && c.rating !== undefined && Number(c.rating) > 0);
    const avg = rated.length
      ? Math.round((rated.reduce((s, c) => s + Number(c.rating || 0), 0) / rated.length) * 100) / 100
      : 0;
    const topBeerMap = new Map<string, number>();
    for (const c of weekly) topBeerMap.set(c.beer_name, (topBeerMap.get(c.beer_name) || 0) + 1);
    const topBeer = Array.from(topBeerMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    return { count: weekly.length, avg, topBeer };
  }, [checkins]);
  const stereotypeBadges = dbBadges;

  const highlightedBucketInfo = useMemo(() => {
    const idx = ratingDistribution.buckets.findIndex((b) => b.count === ratingDistribution.max);
    if (idx < 0) return null;
    return { idx, bucket: ratingDistribution.buckets[idx] };
  }, [ratingDistribution]);

  const activeBucketInfo = useMemo(() => {
    if (activeRatingBucket === null) return highlightedBucketInfo;
    const idx = ratingDistribution.buckets.findIndex((b) => b.rating === activeRatingBucket);
    if (idx < 0) return highlightedBucketInfo;
    return { idx, bucket: ratingDistribution.buckets[idx] };
  }, [activeRatingBucket, highlightedBucketInfo, ratingDistribution.buckets]);

  function ratingToStarsLabel(ratingValue: number) {
    if (ratingValue <= 0) return "0★";
    const full = Math.floor(ratingValue);
    const half = ratingValue % 1 >= 0.5;
    if (half && full === 0) return "½★";
    if (half) return `${full}½★`;
    return `${full}★`;
  }

  const beerLabelsForFormat = useMemo(() => {
    return BEER_CATALOG.filter((b) => b.format === format)
      .map(beerLabel)
      .sort((a, b) => a.localeCompare(b, "tr"));
  }, [format]);

  const allBeerLabels = useMemo(() => {
    return Array.from(new Set(BEER_CATALOG.map(beerStyleLabel))).sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, []);

  useEffect(() => {
    // ensure beerName is valid when format changes
    const pinned = topBeerLabelsByFormat[format] ?? [];
    const all = beerLabelsForFormat;
    const next = pinned[0] || all[0] || "";
    if (!beerName || !all.includes(beerName)) setBeerName(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, beerLabelsForFormat.length]);

  useEffect(() => {
    if (!isBackDate && batchBeerNames.length) setBatchBeerNames([]);
  }, [batchBeerNames.length, isBackDate]);

  useEffect(() => {
    if (!isBackDate) {
      setBatchConfirmed(false);
      return;
    }
    if (batchBeerNames.length <= 1) setBatchConfirmed(false);
  }, [batchBeerNames.length, isBackDate]);

  useEffect(() => {
    if (!districtOptions.length) {
      setDistrict("");
      return;
    }
    if (!district || !districtOptions.includes(district)) {
      setDistrict(districtOptions[0]);
    }
  }, [district, districtOptions]);

  useEffect(() => {
    if (district !== "Diger" && customDistrict) setCustomDistrict("");
  }, [customDistrict, district]);

  async function syncFavoriteAfterCheckin(beer: string) {
    if (!session?.user?.id || !favoriteOnSave) return;
    const trimmed = favoriteBeerName(beer);
    if (!trimmed) return;

    const { data: currentRows, error: currentErr } = await supabase
      .from("favorite_beers")
      .select("beer_name, rank")
      .eq("user_id", session.user.id)
      .order("rank", { ascending: true });
    if (currentErr) {
      alert(currentErr.message);
      return;
    }
    const current = ((currentRows as FavoriteBeer[] | null) ?? []).map((f) => ({
      ...f,
      beer_name: favoriteBeerName(f.beer_name),
    }));
    if (current.some((f) => f.beer_name === trimmed)) {
      setFavorites(current);
      return;
    }

    if (current.length < 3) {
      const used = new Set(current.map((f) => Number(f.rank)));
      let rank = 1;
      while (used.has(rank) && rank <= 3) rank += 1;

      const { error } = await supabase.from("favorite_beers").insert({
        user_id: session.user.id,
        beer_name: trimmed,
        rank,
      });

      if (error) {
        if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
          await loadFavorites();
          return;
        }
        alert(error.message);
        return;
      }

      await loadFavorites();
      trackEvent({
        eventName: "favorite_added",
        userId: session.user.id,
        props: { beer_name: trimmed, rank, source: "checkin_form" },
      });
      return;
    }

    const rankToReplace = replaceFavoriteRank ?? Number(current[0]?.rank ?? 1);
    const target = current.find((f) => Number(f.rank) === rankToReplace);
    if (!target) return;

    const { error } = await supabase
      .from("favorite_beers")
      .update({ beer_name: trimmed })
      .eq("user_id", session.user.id)
      .eq("rank", rankToReplace);

    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        await loadFavorites();
        return;
      }
      alert(error.message);
      return;
    }

    await loadFavorites();
    trackEvent({
      eventName: "favorite_replaced",
      userId: session.user.id,
      props: { old_beer_name: target.beer_name, new_beer_name: trimmed, rank: rankToReplace },
    });
  }

  const favoriteCandidate = useMemo(() => favoriteBeerName(beerName), [beerName]);
  const headerAvatarUrl = useMemo(() => {
    const p = (headerProfile?.avatar_path || "").trim();
    if (!p) return "";
    const { data } = supabase.storage.from("avatars").getPublicUrl(p);
    return data.publicUrl;
  }, [headerProfile?.avatar_path]);
  const headerProfileHref = useMemo(() => {
    const uname = (headerProfile?.username || usernameFromEmail(session?.user?.email) || "").trim();
    return uname ? `/u/${uname}` : "/";
  }, [headerProfile?.username, session?.user?.email]);
  const referralLink = useMemo(() => {
    const code = (headerProfile?.referral_code || "").trim();
    if (!code) return "";
    return `https://birader.app/?ref=${encodeURIComponent(code)}`;
  }, [headerProfile?.referral_code]);
  const tutorialSteps = useMemo<TutorialStep[]>(
    () =>
      lang === "en"
        ? [
            {
              title: "1) Log Wizard",
              desc: "Choose format, select beer, add details, and confirm. First log in 30 seconds.",
              section: "log",
            },
            {
              title: "2) Social Feed",
              desc: "Find users, follow them, and interact in feed with comments/likes.",
              section: "social",
            },
            {
              title: "3) Map",
              desc: "Switch to grid or field mode. Tap a day to open details.",
              section: "heatmap",
            },
            {
              title: "4) Stats",
              desc: "Track streak, badges and weekly recap.",
              section: "stats",
            },
          ]
        : [
            {
              title: "1) Log Wizard",
              desc: "Format sec, bira sec, detay gir, onayla. Ilk logu 30 saniyede at.",
              section: "log",
            },
            {
              title: "2) Sosyal Akis",
              desc: "Kullanici ara, takip et, akista yorum/begeni ile etkilesime gir.",
              section: "social",
            },
            {
              title: "3) Harita",
              desc: "Grid veya saha moduna gec. Gune tiklayip detaylari ac.",
              section: "heatmap",
            },
            {
              title: "4) Istatistik",
              desc: "Streak, rozet ve haftalik recap ile davranisini izle.",
              section: "stats",
            },
          ],
    [lang]
  );
  const activeTutorialStep = tutorialSteps[tutorialStepIdx] || tutorialSteps[0];
  useEffect(() => {
    if (!tutorialOpen) return;
    setActiveSection(activeTutorialStep.section);
  }, [activeTutorialStep.section, tutorialOpen]);
  const recentVisibleCount = useMemo(() => {
    if (recentExpandStep <= 0) return 5;
    if (recentExpandStep === 1) return 10;
    if (recentExpandStep === 2) return 20;
    return checkins.length;
  }, [checkins.length, recentExpandStep]);

  const locationSuggestions = useMemo<LocationSuggestion[]>(() => {
    const staticPairs = TURKEY_CITIES.flatMap((c) =>
      districtsForCity(c)
        .filter((d) => d !== "Diger")
        .map((d) => ({ city: c, district: d, base: 1 }))
    );

    const personalPairCounts = new Map<string, number>();
    for (const c of checkins) {
      const cc = (c.city || "").trim();
      const dd = (c.district || "").trim();
      if (!cc || !dd) continue;
      const key = `${cc}::${dd}`;
      personalPairCounts.set(key, (personalPairCounts.get(key) || 0) + 1);
    }

    const merged = new Map<string, LocationSuggestion>();
    for (const p of staticPairs) {
      const key = `${p.city}::${p.district}`;
      merged.set(key, { city: p.city, district: p.district, score: p.base });
    }
    for (const [key, count] of personalPairCounts.entries()) {
      const [c, d] = key.split("::");
      const prev = merged.get(key);
      merged.set(key, {
        city: c,
        district: d,
        score: (prev?.score || 0) + count * 4,
      });
    }

    const q = normalizeTR(locationSuggestQuery);
    for (const s of remoteLocationSuggestions) {
      const key = `${s.city}::${s.district}`;
      const prev = merged.get(key);
      merged.set(key, {
        city: s.city,
        district: s.district,
        score: Math.max(prev?.score || 0, s.score || 1),
      });
    }

    const rows = Array.from(merged.values());
    if (!q) return rows.sort((a, b) => b.score - a.score).slice(0, 8);

    return rows
      .map((r) => {
        const full = normalizeTR(`${r.city} ${r.district}`);
        const cityOnly = normalizeTR(r.city);
        const districtOnly = normalizeTR(r.district);
        let score = r.score;
        if (full.startsWith(q)) score += 40;
        else if (full.includes(q)) score += 20;
        if (cityOnly.startsWith(q) || districtOnly.startsWith(q)) score += 24;
        else if (cityOnly.includes(q) || districtOnly.includes(q)) score += 12;
        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [checkins, locationSuggestQuery, remoteLocationSuggestions]);

  useEffect(() => {
    const q = locationSuggestQuery.trim();
    if (q.length < 3) {
      setRemoteLocationSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=tr&limit=5&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{ display_name?: string }>;
        const mapped: LocationSuggestion[] = rows
          .map((r) => String(r.display_name || ""))
          .filter(Boolean)
          .map((name) => {
            const parts = name.split(",").map((x) => x.trim()).filter(Boolean);
            const district = parts[0] || "";
            const resolvedCity = parts.find((p) => TURKEY_CITIES.some((c) => c === p)) || city;
            return { city: resolvedCity, district, score: 2 };
          })
          .filter((x) => x.city && x.district);
        setRemoteLocationSuggestions(mapped);
      } catch {}
    }, 280);
    return () => clearTimeout(t);
  }, [locationSuggestQuery, city]);

  function quickLogFromFeed(payload: { beerName: string; rating: number }) {
    const incomingBeer = payload.beerName?.trim();
    if (!incomingBeer) return;

    if (incomingBeer.includes("— Fici —")) setFormat("Fici");
    else if (incomingBeer.includes("— Şişe/Kutu —")) setFormat("Şişe/Kutu");
    setFormatConfirmed(true);

    setBeerName(incomingBeer);
    setBeerQuery(incomingBeer);
    const nextRating = Number(payload.rating || 0);
    setRating(nextRating > 0 ? Math.round(clamp(nextRating, 0, 5) * 2) / 2 : null);
    setActiveSection("log");
    setLogStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitSuggestion() {
    const text = suggestionMessage.trim();
    if (!text || !session?.user?.id) return;
    setSuggestionBusy(true);
    const { error } = await supabase.from("product_suggestions").insert({
      user_id: session.user.id,
      category: suggestionCategory,
      message: text,
    });
    setSuggestionBusy(false);
    if (error) {
      alert(`${tx(lang, "Oneri gonderilemedi", "Suggestion failed")}: ${error.message}`);
      return;
    }
    trackEvent({
      eventName: "suggestion_submitted",
      userId: session.user.id,
      props: { category: suggestionCategory, length: text.length },
    });
    setSuggestionMessage("");
    setSuggestionCategory("general");
    setSuggestionOpen(false);
  }

  async function loadAdminSuggestions() {
    if (!canManageSuggestions) return;
    setAdminSuggestionsBusy(true);
    const { data, error } = await supabase
      .from("product_suggestions")
      .select("id, user_id, category, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setAdminSuggestionsBusy(false);
    if (error) {
      alert(`Oneri listesi yuklenemedi: ${error.message}`);
      return;
    }

    const rows = (data as ProductSuggestionRow[] | null) ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x))));
    if (!userIds.length) {
      setAdminSuggestions(rows);
      return;
    }
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .in("user_id", userIds);
    const profileById = new Map<string, { username?: string | null; display_name?: string | null }>();
    for (const p of ((profileRows as Array<{ user_id: string; username?: string | null; display_name?: string | null }> | null) ?? [])) {
      profileById.set(p.user_id, { username: p.username, display_name: p.display_name });
    }
    setAdminSuggestions(
      rows.map((r) => {
        const p = r.user_id ? profileById.get(r.user_id) : null;
        return { ...r, username: p?.username ?? null, display_name: p?.display_name ?? null };
      })
    );
  }

  async function loadAdminReports() {
    if (!canManageSuggestions) return;
    setAdminReportsBusy(true);
    const { data, error } = await supabase
      .from("content_reports")
      .select("id, reporter_id, target_user_id, target_type, target_id, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setAdminReportsBusy(false);
    if (error) return;
    setAdminReports(
      ((data as Array<any> | null) ?? []).map((r) => ({
        id: Number(r.id),
        reporter_id: r.reporter_id ?? null,
        target_user_id: r.target_user_id ?? null,
        target_type: String(r.target_type || ""),
        target_id: String(r.target_id || ""),
        reason: String(r.reason || ""),
        status: (String(r.status || "open") as "open" | "reviewed" | "resolved"),
        created_at: String(r.created_at || ""),
      }))
    );
  }

  async function updateReportStatus(id: number, status: "open" | "reviewed" | "resolved") {
    if (!canManageSuggestions) return;
    const { error } = await supabase.from("content_reports").update({ status }).eq("id", id);
    if (error) return;
    setAdminReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function loadMyBadges() {
    if (!session?.user?.id) {
      setDbBadges([]);
      return;
    }
    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_key, title_tr, title_en, detail_tr, detail_en, score, computed_at")
      .eq("user_id", session.user.id)
      .order("score", { ascending: false })
      .order("computed_at", { ascending: false })
      .limit(8);
    if (error) return;
    setDbBadges((data as UserBadgeRow[] | null) ?? []);
  }

  async function refreshAllBadgesNow() {
    if (!canManageSuggestions || badgeRefreshBusy) return;
    setBadgeRefreshBusy(true);
    const { error } = await supabase.rpc("refresh_all_user_badges");
    setBadgeRefreshBusy(false);
    if (error) {
      alert(`${tx(lang, "Rozetler yenilenemedi", "Badges refresh failed")}: ${error.message}`);
      return;
    }
    await loadMyBadges();
    alert("Tum rozetler yenilendi.");
  }

  async function saveHeatmapThemeToProfile(nextFrom: string, nextTo: string) {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ heatmap_color_from: nextFrom, heatmap_color_to: nextTo })
      .eq("user_id", session.user.id);
    if (!error) {
      setHeaderProfile((prev) =>
        prev
          ? { ...prev, heatmap_color_from: nextFrom, heatmap_color_to: nextTo }
          : prev
      );
    }
  }

  async function ensureReferralCode() {
    if (!session?.user?.id) return;
    if ((headerProfile?.referral_code || "").trim()) return;
    for (let i = 0; i < 6; i += 1) {
      const candidate = randomReferralCode();
      const { error } = await supabase
        .from("profiles")
        .update({ referral_code: candidate })
        .eq("user_id", session.user.id)
        .is("referral_code", null);
      if (!error) {
        setHeaderProfile((prev) => (prev ? { ...prev, referral_code: candidate } : prev));
        return;
      }
    }
  }

  async function updateSuggestionStatus(id: number, nextStatus: "new" | "in_progress" | "done") {
    if (!canManageSuggestions) return;
    const { error } = await supabase
      .from("product_suggestions")
      .update({ status: nextStatus })
      .eq("id", id);
    if (error) {
      alert(`Durum guncellenemedi: ${error.message}`);
      return;
    }
    setAdminSuggestions((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
  }

  function closeOnboarding(markSeen = true) {
    if (markSeen) {
      try {
        localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
      } catch {}
    }
    setOnboardingOpen(false);
  }

  function closeTutorial(markDone = true) {
    if (markDone) {
      try {
        localStorage.setItem(TUTORIAL_DONE_KEY, "1");
      } catch {}
    }
    setTutorialOpen(false);
  }

async function deleteCheckin(id: string) {
  // Session varsa Supabase dene
  if (session?.user?.id) {
    const { data, error } = await supabase.rpc("delete_own_checkin", { p_id: String(id) });
    if (!error && data === true) {
      trackEvent({
        eventName: "checkin_deleted",
        userId: session.user.id,
        props: { id },
      });
      await loadCheckins();
      return;
    }
    const reason = error?.message || "Kayit bulunamadi ya da yetki yok.";
    alert(`Silme basarisiz: ${reason}`);
    return;
  }

  // Local fallback
  setCheckins((prev) => prev.filter((x) => x.id !== id));
  trackEvent({
    eventName: "checkin_deleted_local",
    userId: session?.user?.id ?? null,
    props: { id },
  });
}

async function updateCheckin(payload: { id: string; beer_name: string; rating: number | null }) {
  const name = payload.beer_name.trim();
  if (!name) return;
  const normalizedRating = sanitizeRating(payload.rating);

  // Session varsa Supabase dene
  if (session?.user?.id) {
    const { error } = await supabase
      .from("checkins")
      .update({ beer_name: name, rating: normalizedRating })
      .eq("id", payload.id)
      .eq("user_id", session.user.id);

    if (!error) {
      trackEvent({
        eventName: "checkin_updated",
        userId: session.user.id,
        props: { id: payload.id, rating: normalizedRating },
      });
      await loadCheckins();
      return;
    }
    alert(`Guncelleme basarisiz: ${error.message}`);
    return;
  }

  // Local fallback
  setCheckins((prev) =>
    prev.map((x) =>
      x.id === payload.id
        ? { ...x, beer_name: name, rating: normalizedRating }
        : x
    )
  );
  trackEvent({
    eventName: "checkin_updated_local",
    userId: session?.user?.id ?? null,
    props: { id: payload.id, rating: normalizedRating },
  });
}
  async function addCheckin() {
    const name = (beerName || "").trim();
    const targets = isBackDate && batchBeerNames.length > 0 ? batchBeerNames : name ? [name] : [];
    if (!targets.length) return;
    if (dateISO > today) {
      alert(tx(lang, "Bugunden sonraki tarihe log atilamaz.", "You cannot log a future date."));
      return;
    }
    if (isBackDate && targets.length > 1 && !batchConfirmed) {
      alert("Toplu kayit icin once onay kutusunu isaretle.");
      return;
    }
    const normalizedRating = sanitizeRating(rating);
    const normalizedPrice = sanitizePrice(priceText);
    const normalizedLocation = locationText.trim();
    const normalizedMediaUrl = mediaUrl.trim();
    const normalizedMediaType = inferMediaType(normalizedMediaUrl);
    const normalizedNote = logNote.trim();
    const normalizedCity = city.trim();
    const normalizedDistrict = resolvedDistrict;
    if (!normalizedDistrict) {
      alert("Ilce sec veya Diger icin ilce adini yaz.");
      return;
    }
    if (!beginLogMutation()) return;

    try {
      const created_at =
        dateISO === today ? new Date().toISOString() : new Date(`${dateISO}T12:00:00.000Z`).toISOString();

      // 1) session varsa supabase dene
      if (session?.user?.id) {
        const rows = targets.map((beer) => ({
          user_id: session.user.id,
          beer_name: beer,
          rating: normalizedRating,
          created_at,
          day_period: dayPeriod,
          country_code: "TR",
          city: normalizedCity,
          district: normalizedDistrict,
          location_text: normalizedLocation || "",
          price_try: normalizedPrice,
          note: normalizedNote || "",
          latitude: null,
          longitude: null,
          media_url: normalizedMediaUrl || "",
          media_type: normalizedMediaType || "",
        }));
        let { error } = await supabase.from("checkins").insert(rows);
        if (error && isMissingMediaColumnError(error)) {
          const rowsWithoutMedia = rows.map(({ media_url, media_type, ...rest }) => rest);
          const retry = await supabase.from("checkins").insert(rowsWithoutMedia);
          error = retry.error;
        }

        if (!error) {
          const favoriteTargets = Array.from(
            new Set(targets.map((beer) => favoriteBeerName(beer)).filter((beer): beer is string => Boolean(beer)))
          );
          for (const beer of favoriteTargets) await syncFavoriteAfterCheckin(beer);
          trackEvent({
            eventName: "checkin_added",
            userId: session.user.id,
            props: { rating: normalizedRating, beer_count: targets.length, date: dateISO },
          });
          setDateISO(today);
          setRating(null);
          setLogStep(1);
          setFormatConfirmed(false);
          setCustomDistrict("");
          setDayPeriod("evening");
          setLocationText("");
          setMediaUrl("");
          setPriceText("");
          setLogNote("");
          setDateOpen(false);
          setBatchBeerNames([]);
          setBatchCountInput("1");
          setBatchConfirmed(false);
          await loadCheckins();
          await supabase.rpc("refresh_my_badges");
          await loadMyBadges();
          return;
        }

        // supabase patladıysa local fallback
        console.error("Supabase insert failed -> local fallback:", error.message);
      }

      // 2) local fallback
      setCheckins((prev) => {
        const next: Checkin[] = [
          ...targets.map((beer) => ({
            id: uuid(),
            beer_name: beer,
            rating: normalizedRating,
            created_at,
            day_period: dayPeriod,
            country_code: "TR",
            city: normalizedCity,
            district: normalizedDistrict,
            location_text: normalizedLocation || "",
            price_try: normalizedPrice,
            note: normalizedNote || "",
            latitude: null,
            longitude: null,
            media_url: normalizedMediaUrl || "",
            media_type: normalizedMediaType || "",
          })),
          ...prev,
        ];
        return next;
      });

      if (session?.user?.id) {
        const created_at =
          dateISO === today ? new Date().toISOString() : new Date(`${dateISO}T12:00:00.000Z`).toISOString();
        const queueRows = targets.map((beer) => ({
          user_id: session.user.id,
          beer_name: beer,
          rating: normalizedRating,
          created_at,
          day_period: dayPeriod,
          country_code: "TR",
          city: normalizedCity,
          district: normalizedDistrict,
          location_text: normalizedLocation || "",
          price_try: normalizedPrice,
          note: normalizedNote || "",
          latitude: null,
          longitude: null,
          media_url: normalizedMediaUrl || "",
          media_type: normalizedMediaType || "",
        }));
        const queued = readOfflineLogQueue();
        writeOfflineLogQueue([...queued, ...queueRows]);
      }

      setDateISO(today);
      setRating(null);
      setLogStep(1);
      setFormatConfirmed(false);
      setCustomDistrict("");
      setDayPeriod("evening");
      setLocationText("");
      setMediaUrl("");
      setPriceText("");
      setLogNote("");
      setDateOpen(false);
      setBatchBeerNames([]);
      setBatchCountInput("1");
      setBatchConfirmed(false);
      await supabase.rpc("refresh_my_badges");
      await loadMyBadges();
      trackEvent({
        eventName: "checkin_added_local",
        userId: session?.user?.id ?? null,
        props: { rating: normalizedRating, beer_count: targets.length, date: dateISO },
      });
    } finally {
      logMutationLockRef.current = false;
      setIsLogMutating(false);
    }
  }

  if (!session) {
    return (
      <main className="min-h-screen p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold">Birader</h1>
        <p className="text-sm opacity-80 mt-1">{tx(lang, "Bugün ne içtin?", "What did you drink today?")}</p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-80">{authMode === "login" ? tx(lang, "Giriş", "Sign in") : tx(lang, "Kayıt ol", "Sign up")}</div>
            <button
              className="text-xs underline opacity-70"
              onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
              type="button"
            >
              {authMode === "login" ? tx(lang, "Kayıt ol", "Sign up") : tx(lang, "Giriş yap", "Sign in")}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={authIdentifier}
              onChange={(e) => setAuthIdentifier(e.target.value)}
              placeholder={
                authMode === "login"
                  ? tx(lang, "kullanıcı adı veya e-posta", "username or e-mail")
                  : tx(lang, "e-posta (ör. ati@birader.app)", "e-mail (e.g. ati@birader.app)")
              }
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete={authMode === "signup" ? "email" : "username"}
            />
            {authMode === "signup" && authEmailSuggestions.length ? (
              <div className="flex flex-wrap gap-2">
                {authEmailSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAuthIdentifier(s)}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] opacity-85"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {authMode === "signup" ? (
              <>
                <input
                  value={signupBirthDate}
                  onChange={(e) => setSignupBirthDate(e.target.value)}
                  type="date"
                  className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
                />
                <label className="flex items-start gap-2 text-xs opacity-80">
                  <input
                    type="checkbox"
                    checked={signupTermsAccepted}
                    onChange={(e) => setSignupTermsAccepted(e.target.checked)}
                  />
                  {tx(lang, "Kullanim kosullarini kabul ediyorum (zorunlu).", "I accept terms of use (required).")}
                </label>
                <label className="flex items-start gap-2 text-xs opacity-80">
                  <input
                    type="checkbox"
                    checked={signupPrivacyAccepted}
                    onChange={(e) => setSignupPrivacyAccepted(e.target.checked)}
                  />
                  {tx(lang, "KVKK / gizlilik aydinlatmasini kabul ediyorum (zorunlu).", "I accept privacy policy (required).")}
                </label>
                <label className="flex items-start gap-2 text-xs opacity-80">
                  <input
                    type="checkbox"
                    checked={signupCommercialAccepted}
                    onChange={(e) => setSignupCommercialAccepted(e.target.checked)}
                  />
                  {tx(lang, "Ticari elektronik ileti onay metnini okudum (zorunlu).", "I accept commercial consent text (required).")}
                </label>
                <label className="flex items-start gap-2 text-xs opacity-75">
                  <input
                    type="checkbox"
                    checked={signupMarketingOptIn}
                    onChange={(e) => setSignupMarketingOptIn(e.target.checked)}
                  />
                  {tx(lang, "Kampanya/duyuru iletisi almak istiyorum (opsiyonel).", "I want marketing messages (optional).")}
                </label>
              </>
            ) : null}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tx(lang, "şifre", "password")}
              type="password"
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
            />
          </div>

          <button
            onClick={authWithUsernamePassword}
            disabled={authBusy}
            className="mt-3 w-full rounded-2xl bg-white text-black py-3 font-semibold active:scale-[0.99] disabled:opacity-50"
          >
            {authBusy ? "..." : authMode === "login" ? tx(lang, "Giriş yap", "Sign in") : tx(lang, "Hesap oluştur", "Create account")}
          </button>

          <p className="mt-3 text-xs opacity-60">
            {tx(
              lang,
              "Not: Kayıt e-posta ile yapılır. Girişte e-posta veya kullanıcı adı kullanabilirsin. Eski @birader.local hesaplar girişte otomatik desteklenir.",
              "Note: Signup uses e-mail. You can sign in with e-mail or username. Legacy @birader.local accounts are auto-supported."
            )}
          </p>
        </div>

        <FieldHeatmap
          year={year}
          checkins={checkins}
          onSelectDay={(d) => setSelectedDay(d)}
          colorFrom={gridColorFrom}
          colorTo={gridColorTo}
          lang={lang}
        />

        <DayModal
          open={selectedDay !== null}
          day={selectedDay ?? ""}
          checkins={dayCheckins}
          beerOptions={allBeerLabels}
          lang={lang}
          onOpenLogForDay={(d) => {
            setDateISO(d);
            setActiveSection("log");
            setFormatConfirmed(true);
            setLogStep(2);
            setSelectedDay(null);
          }}
          onClose={() => setSelectedDay(null)}
          onAdd={async ({ day, beer_name, rating }) => {
            if (day > today) {
              alert(tx(lang, "Bugunden sonraki tarihe log atilamaz.", "You cannot log a future date."));
              return;
            }
            if (!beginLogMutation()) return;
            const created_at = new Date(`${day}T12:00:00.000Z`).toISOString();
            try {
              setCheckins((prev) => [
                {
                  id: uuid(),
                  beer_name,
                  rating: sanitizeRating(rating),
                  created_at,
                  day_period: dayPeriod,
                  country_code: "TR",
                  city,
                  district: resolvedDistrict,
                  location_text: "",
                  price_try: null,
                  note: "",
                  latitude: null,
                  longitude: null,
                },
                ...prev,
              ]);
            } finally {
              setIsLogMutating(false);
            }
        }}
  onDelete={deleteCheckin}
  onUpdate={updateCheckin}
/>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 pb-24 max-w-md mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/favicon.svg" alt="Birader" width={28} height={28} className="rounded-md" />
          <div>
            <h1 className="text-2xl font-bold text-amber-300">Birader</h1>
            <p className="text-sm text-amber-100/80">
            {year} (v0)
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLang("tr")}
              className={`rounded-md border px-2 py-0.5 text-[10px] ${
                lang === "tr" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"
              }`}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-md border px-2 py-0.5 text-[10px] ${
                lang === "en" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/5"
              }`}
            >
              EN
            </button>
          </div>
          <Link
            href={headerProfileHref}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1.5"
          >
            <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-black/40">
              {headerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerAvatarUrl} alt={tx(lang, "profil avatar", "profile avatar")} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] opacity-70">
                  :)
                </div>
              )}
            </div>
            <div className="max-w-[120px] truncate text-xs text-amber-100">
              {`@${headerProfile?.username || usernameFromEmail(session?.user?.email) || tx(lang, "kullanici", "user")}`}
            </div>
          </Link>

          <button
            onClick={logout}
            className="rounded-md border border-red-300/70 bg-red-500/15 px-3 py-1 text-xs font-bold tracking-[0.12em] text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.35)]"
          >
            EXIT ⟶
          </button>
          <Link
            href="/yardim"
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80"
          >
            {t(lang, "nav_help")}
          </Link>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-amber-200/85">Birader Mobile</div>
            <div className="text-[11px] opacity-70">
              {tx(lang, "iOS/Android uygulama linkleri ve web app kurulumu", "iOS/Android app links and web app install")}
            </div>
          </div>
          {pwaPromptEvent ? (
            <button
              type="button"
              onClick={() => void installPwa()}
              className="rounded-lg border border-amber-300/35 bg-amber-500/15 px-2 py-1 text-xs"
            >
              {t(lang, "cta_add_home")}
            </button>
          ) : null}
        </div>
        {pwaInstallOpen || pwaPromptEvent ? (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-center"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-center"
            >
              Google Play
            </a>
          </div>
        ) : null}
        {referralLink ? (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2">
            <div className="text-[11px] opacity-70">{tx(lang, "Davet linkin", "Your invite link")}</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={referralLink}
                readOnly
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(referralLink).catch(() => {});
                  trackEvent({ eventName: "referral_copy_link", userId: session?.user?.id ?? null });
                }}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
              >
                {tx(lang, "Kopyala", "Copy")}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[11px] opacity-70">{lang === "en" ? "App tour" : "Uygulama turu"}</div>
          <button
            type="button"
            onClick={() => {
              setTutorialStepIdx(0);
              setTutorialOpen(true);
            }}
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
          >
            {tx(lang, "Tutorial baslat", "Start tutorial")}
          </button>
        </div>
      </section>

      {activeSection === "log" ? (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-amber-200">{t(lang, "heading_log")}</div>
          <div className="text-xs opacity-70">{tx(lang, "Adim", "Step")} {logStep}/4</div>
        </div>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {["Format", "Bira", "Detay", "Onay"].map((label, idx) => {
            const step = (idx + 1) as 1 | 2 | 3 | 4;
            const active = step === logStep;
            const done = step < logStep;
            const blocked = step > logStep && !canOpenLogStep(step);
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToLogStep(step)}
                disabled={blocked}
                className={`rounded-xl border px-2 py-2 text-[11px] ${
                  active
                    ? "border-amber-300/35 bg-amber-500/15"
                    : done
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-black/20"
                } ${blocked ? "opacity-45" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {logStep === 1 ? (
          <div>
            <div className="mb-2 text-xs opacity-70">{tx(lang, "Sunum tarzini sec", "Choose serving style")}</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormat("Fici");
                  setFormatConfirmed(true);
                }}
                className={`rounded-3xl border p-4 text-left ${
                  format === "Fici" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="text-lg font-semibold">{tx(lang, "Fici", "Draft")}</div>
                <div className="mt-1 text-xs opacity-70">{tx(lang, "Bar / draft deneyimi", "Bar / draft experience")}</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat("Şişe/Kutu");
                  setFormatConfirmed(true);
                }}
                className={`rounded-3xl border p-4 text-left ${
                  format === "Şişe/Kutu" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="text-lg font-semibold">{tx(lang, "Sise / Kutu", "Bottle / Can")}</div>
                <div className="mt-1 text-xs opacity-70">{tx(lang, "Market / paket secimleri", "Market / package options")}</div>
              </button>
            </div>
          </div>
        ) : null}

        {logStep === 2 ? (
          <div>
            <div className="mb-2 text-xs opacity-70">{tx(lang, "Birani sec", "Choose your beer")}</div>
            <ComboboxBeer
              formatLabel={format === "Fici" ? "Fıçı" : "Şişe/Kutu"}
              query={beerQuery}
              setQuery={setBeerQuery}
              pinned={topBeerLabelsByFormat[format] ?? []}
              options={beerLabelsForFormat}
              value={beerName}
              onChange={setBeerName}
              lang={lang}
            />
          </div>
        ) : null}

        {logStep === 3 ? (
          <div>
            <div className="mb-3">
              <label className="block text-xs opacity-70 mb-2">{tx(lang, "Tarih", "Date")}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDateOpen((v) => !v)}
                  className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none text-left"
                >
                  <div className="flex items-center justify-between">
                    <span>{dateISO}</span>
                    <span className="text-white/55">{tx(lang, "Takvim", "Calendar")}</span>
                  </div>
                </button>
                {dateOpen ? (
                  <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dateISO}
                        onChange={(e) => setDateISO(e.target.value)}
                        max={today}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-white/20"
                        onClick={() => {
                          setDateISO(today);
                          setDateOpen(false);
                        }}
                      >
                        {tx(lang, "Bugun", "Today")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-2 block text-xs opacity-70">{tx(lang, "Gunun vakti", "Time of day")}</label>
              <select
                value={dayPeriod}
                onChange={(e) => setDayPeriod(e.target.value as DayPeriod)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none"
              >
                {DAY_PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {lang === "en" ? p.en : p.tr}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs opacity-70 mb-2">{tx(lang, "Puan", "Rating")}</label>
              <button
                type="button"
                onClick={() => setRating((r) => (r === null ? 3.5 : null))}
                className={`mb-2 rounded-xl border px-3 py-1.5 text-xs ${
                  rating === null ? "border-white/30 bg-white/15" : "border-white/10 bg-black/20"
                }`}
              >
                {rating === null ? tx(lang, "Puansiz log (acik)", "Unrated log (on)") : tx(lang, "Puansiz log", "Unrated log")}
              </button>
              <StarRatingHalf value={rating} onChange={setRating} />
            </div>

            <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-80">{tx(lang, "Opsiyonel detaylar", "Optional details")}</div>
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  >
                    {TURKEY_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  >
                    {districtOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                  <input
                    value={locationSuggestQuery}
                    onChange={(e) => setLocationSuggestQuery(e.target.value)}
                    placeholder={tx(lang, "Il/ilce onerisi ara (orn: kadikoy, besiktas)", "Search city/district suggestion (e.g. kadikoy, besiktas)")}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {locationSuggestions.map((s) => (
                      <button
                        key={`${s.city}-${s.district}`}
                        type="button"
                    onClick={() => {
                      setCity(s.city);
                      const opts = districtsForCity(s.city);
                      if (opts.includes(s.district)) {
                        setDistrict(s.district);
                        setCustomDistrict("");
                      } else {
                        setDistrict("Diger");
                        setCustomDistrict(s.district);
                      }
                      setLocationSuggestQuery(`${s.city} / ${s.district}`);
                    }}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                    >
                      {s.city} / {s.district}
                    </button>
                  ))}
                </div>
              </div>
                {district === "Diger" ? (
                  <input
                    value={customDistrict}
                    onChange={(e) => setCustomDistrict(e.target.value)}
                    placeholder={tx(lang, "Ilce adini yaz", "Type district name")}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  />
                ) : null}
                <input
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder={tx(lang, "Mekan/konum notu (opsiyonel)", "Venue/location note (optional)")}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Gorsel/video URL (opsiyonel)"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder={tx(lang, "Fiyat (TL)", "Price (TRY)")}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                />
                <textarea
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value.slice(0, 220))}
                  placeholder={tx(lang, "Yorum (konum/fiyat/atmosfer notu)", "Comment (location/price/atmosphere note)")}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            {isBackDate ? (
              <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs opacity-80">{tx(lang, "Eski tarih icin coklu log", "Bulk log for past dates")}</div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={batchCountInput}
                    onChange={(e) => setBatchCountInput(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder={tx(lang, "Adet", "Count")}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = (beerName || "").trim();
                      if (!n) return;
                      const qty = Math.max(1, Math.min(MAX_BULK_BACKDATE_COUNT, Number(batchCountInput || "1")));
                      setBatchBeerNames((prev) => [...prev, ...Array.from({ length: qty }, () => n)]);
                      setBatchConfirmed(false);
                    }}
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
                  >
                    {`Listeye ekle (${Math.max(1, Math.min(MAX_BULK_BACKDATE_COUNT, Number(batchCountInput || "1")))})`}
                  </button>
                </div>
                <div className="text-[11px] opacity-60">Maksimum {MAX_BULK_BACKDATE_COUNT} adet</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {batchBeerNames.map((b, i) => (
                    <button
                      key={`${b}-${i}`}
                      type="button"
                      onClick={() => {
                        setBatchBeerNames((prev) => prev.filter((_, idx) => idx !== i));
                        setBatchConfirmed(false);
                      }}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                    >
                      {b} ×
                    </button>
                  ))}
                  {!batchBeerNames.length ? <div className="text-xs opacity-60">{tx(lang, "Henuz listede bira yok.", "No beers in list yet.")}</div> : null}
                </div>
                {batchBeerNames.length > 1 ? (
                  <div className="mt-3 text-xs opacity-70">
                    {tx(lang, "Toplu kayit onayi son adimda alinacak.", "Bulk save confirmation will be requested at the final step.")}
                  </div>
                ) : null}
                <div className="mt-2 text-xs opacity-65">
                  {tx(lang, "Not: Toplu kayitlar puansiz birakilip sonradan guncellenebilir.", "Note: Bulk logs can be left unrated and updated later.")}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {logStep === 4 ? (
          <div>
            <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">{tx(lang, "Log ozeti", "Log summary")}</div>
              <div className="mt-1 text-sm font-semibold">{beerName || tx(lang, "Bira secilmedi", "No beer selected")}</div>
              <div className="mt-1 text-xs opacity-75">Format: {format}</div>
              <div className="text-xs opacity-75">{tx(lang, "Tarih", "Date")}: {dateISO}</div>
              <div className="text-xs opacity-75">{tx(lang, "Puan", "Rating")}: {rating === null ? tx(lang, "Puansiz", "Unrated") : `${rating}⭐`}</div>
              <div className="text-xs opacity-75">{tx(lang, "Konum", "Location")}: {city}{resolvedDistrict ? ` / ${resolvedDistrict}` : ""}</div>
            </div>

            <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <label className="flex items-center gap-2 text-xs opacity-85">
                <input
                  type="checkbox"
                  checked={favoriteOnSave}
                  onChange={(e) => setFavoriteOnSave(e.target.checked)}
                />
                {tx(lang, "Bu logdaki birayi favorilere ekle", "Add this beer to favorites")}
              </label>
              {favoriteOnSave &&
              favorites.length >= 3 &&
              !favorites.some((f) => f.beer_name === favoriteCandidate) ? (
                <div className="mt-2">
                  <label className="mb-1 block text-xs opacity-70">{tx(lang, "Degisecek favori", "Favorite to replace")}</label>
                  <select
                    value={replaceFavoriteRank ?? ""}
                    onChange={(e) => setReplaceFavoriteRank(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  >
                    {favorites.map((f) => (
                      <option key={f.rank} value={f.rank}>
                        #{f.rank} {f.beer_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {isBackDate && batchBeerNames.length > 1 ? (
              <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <label className="flex items-center gap-2 text-xs opacity-90">
                  <input
                    type="checkbox"
                    checked={batchConfirmed}
                    onChange={(e) => setBatchConfirmed(e.target.checked)}
                  />
                  {tx(lang, "Eminim", "I'm sure")}, {batchBeerNames.length} {tx(lang, "adet kaydi toplu olarak ekle", "records will be added in bulk")}
                </label>
              </div>
            ) : null}

            <button
              onClick={addCheckin}
              disabled={
                isLogMutating ||
                !(isBackDate ? batchBeerNames.length > 0 || !!beerName : !!beerName) ||
                (isBackDate && batchBeerNames.length > 1 && !batchConfirmed)
              }
              className="w-full rounded-2xl bg-white text-black py-3 font-semibold active:scale-[0.99] disabled:opacity-50"
            >
              {isBackDate && batchBeerNames.length > 0 ? `${batchBeerNames.length} ${tx(lang, "birayi kaydet", "save beers")}` : tx(lang, "Kaydet", "Save")}
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLogStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
            disabled={logStep === 1}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            {tx(lang, "Geri", "Back")}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = (logStep < 4 ? (logStep + 1) : logStep) as 1 | 2 | 3 | 4;
              goToLogStep(next);
            }}
            disabled={
              logStep === 4 ||
              (logStep === 1 && !formatConfirmed) ||
              (logStep === 2 && !(isBackDate ? batchBeerNames.length > 0 || !!beerName : !!beerName))
            }
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            {logStep === 4 ? tx(lang, "Son", "Last") : tx(lang, "Ileri", "Next")}
          </button>
        </div>
      </section>
      ) : null}

      {activeSection === "log" ? (
      <section className="mt-6">
        <div className="text-sm text-amber-200 mb-2">{tx(lang, "Son check-in'ler", "Recent check-ins")}</div>
        <div className="space-y-2">
          {checkins.slice(0, recentVisibleCount).map((c) => (
            <div key={c.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{c.beer_name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm">{c.rating === null ? "—" : `${c.rating}⭐`}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const inferred = inferFormatFromBeerName(c.beer_name);
                      setFormat(inferred);
                      setFormatConfirmed(true);
                      setBeerName(c.beer_name);
                      setBeerQuery(c.beer_name);
                      setRating(c.rating === null || c.rating === undefined ? null : Number(c.rating));
                      setDayPeriod((c.day_period as DayPeriod) || "evening");
                      setMediaUrl((c.media_url || "").trim());
                      setLogStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
                  >
                    {tx(lang, "Tekrar logla", "Log again")}
                  </button>
                </div>
              </div>
              <div className="text-xs opacity-70 mt-1">
                {new Date(c.created_at).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR")} • {dayPeriodLabelTr(c.day_period, c.created_at)} /{" "}
                {dayPeriodLabelEn(c.day_period, c.created_at)}
              </div>
              {c.city ? (
                <div className="text-xs opacity-80 mt-1">
                  📍 {c.city}{c.district ? ` / ${c.district}` : ""}{c.location_text ? ` • ${c.location_text}` : ""}
                </div>
              ) : c.location_text ? <div className="text-xs opacity-80 mt-1">📍 {c.location_text}</div> : null}
              {c.price_try !== null && c.price_try !== undefined ? (
                <div className="text-xs opacity-80 mt-1">💸 {Number(c.price_try).toFixed(2)} TL</div>
              ) : null}
              {c.note ? <div className="text-xs opacity-75 mt-1">{c.note}</div> : null}
              {(c.media_url || "").trim() ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  {(c.media_type || inferMediaType(c.media_url || "")).startsWith("video") ? (
                    <video src={c.media_url || ""} controls className="h-40 w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.media_url || ""} alt={tx(lang, "checkin medya", "check-in media")} className="h-40 w-full object-cover" />
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {checkins.length === 0 ? (
            <div className="text-sm opacity-70">{tx(lang, "Henuz check-in yok. Ilkini gir.", "No check-ins yet. Add your first one.")}</div>
          ) : null}
        </div>

        {checkins.length > recentVisibleCount ? (
          <button
            type="button"
            onClick={() => setRecentExpandStep((s) => Math.min(3, s + 1))}
            className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm"
          >
            {recentExpandStep === 0
              ? tx(lang, "5 tane daha goster", "Show 5 more")
              : recentExpandStep === 1
                ? tx(lang, "10 tane daha goster", "Show 10 more")
                : tx(lang, "Tumunu goster", "Show all")}
          </button>
        ) : null}
      </section>
      ) : null}

      {activeSection === "social" ? (
      <SocialPanel
        userId={session.user.id}
        sessionEmail={session.user.email}
        allBeerOptions={allBeerLabels}
        onQuickLog={quickLogFromFeed}
        lang={lang}
      />
      ) : null}

      {activeSection === "heatmap" ? (
        <>
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm opacity-80">{t(lang, "heading_heatmap")} ({year})</div>
              <div className="flex items-center gap-2">
                <select
                  value={heatmapMode}
                  onChange={(e) => setHeatmapMode(e.target.value as "football" | "grid")}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                >
                  <option value="football">{tx(lang, "Saha", "Field")}</option>
                  <option value="grid">Grid</option>
                </select>
                {heatmapMode === "grid" ? (
                  <>
                    <select
                      value={gridCellMetric}
                      onChange={(e) => setGridCellMetric(e.target.value as "color" | "count" | "avgRating")}
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                    >
                      <option value="color">{tx(lang, "Renk", "Color")}</option>
                      <option value="count">{tx(lang, "Sayi", "Count")}</option>
                      <option value="avgRating">{tx(lang, "Ortalama ⭐", "Average ⭐")}</option>
                    </select>
                    <select
                      value={`${gridColorFrom}|${gridColorTo}`}
                      onChange={(e) => {
                        const [from, to] = String(e.target.value || "").split("|");
                        if (!from || !to) return;
                        setGridColorFrom(from);
                        setGridColorTo(to);
                        void saveHeatmapThemeToProfile(from, to);
                      }}
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                    >
                      {HEATMAP_PALETTES.map((p) => (
                        <option key={p.key} value={`${p.from}|${p.to}`}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="color"
                      value={gridColorFrom}
                      onChange={(e) => {
                        const next = e.target.value;
                        setGridColorFrom(next);
                        void saveHeatmapThemeToProfile(next, gridColorTo);
                      }}
                      title={tx(lang, "Gradient baslangic", "Gradient start")}
                      className="h-8 w-8 rounded border border-white/20 bg-black/20 p-0.5"
                    />
                    <input
                      type="color"
                      value={gridColorTo}
                      onChange={(e) => {
                        const next = e.target.value;
                        setGridColorTo(next);
                        void saveHeatmapThemeToProfile(gridColorFrom, next);
                      }}
                      title={tx(lang, "Gradient bitis", "Gradient end")}
                      className="h-8 w-8 rounded border border-white/20 bg-black/20 p-0.5"
                    />
                  </>
                ) : null}
              </div>
            </div>
            {heatmapMode === "football" ? (
              <FootballHeatmap year={year} checkins={checkins} onSelectDay={(d) => setSelectedDay(d)} lang={lang} />
            ) : (
              <FieldHeatmap
                year={year}
                checkins={checkins}
                onSelectDay={(d) => setSelectedDay(d)}
                cellMetric={gridCellMetric}
                colorFrom={gridColorFrom}
                colorTo={gridColorTo}
                lang={lang}
              />
            )}
          </section>
          <GeoHeatmap year={year} checkins={checkins} lang={lang} />
          <MonthZoom
            open={selectedMonth !== null}
            year={year}
            monthIndex={selectedMonth ?? 0}
            checkins={checkins}
            selectedDay={selectedDay}
            onClose={() => setSelectedMonth(null)}
            onSelectDay={(d) => setSelectedDay(d)}
            lang={lang}
          />
        </>
      ) : null}

      <DayModal
      open={selectedDay !== null}
      day={selectedDay ?? ""}
      checkins={dayCheckins}
      beerOptions={allBeerLabels}
      lang={lang}
      onOpenLogForDay={(d) => {
        setDateISO(d);
        setActiveSection("log");
        setLogStep(2);
        setSelectedDay(null);
      }}
      onClose={() => setSelectedDay(null)}
      onAdd={async ({ day, beer_name, rating }) => {
        if (day > today) {
          alert(tx(lang, "Bugunden sonraki tarihe log atilamaz.", "You cannot log a future date."));
          return;
        }
        if (!beginLogMutation()) return;
        const created_at = new Date(`${day}T12:00:00.000Z`).toISOString();
        const normalizedRating = sanitizeRating(rating);
        try {
          if (session?.user?.id) {
            const { error } = await supabase.from("checkins").insert({
              user_id: session.user.id,
              beer_name,
              rating: normalizedRating,
              created_at,
              day_period: dayPeriod,
              country_code: "TR",
              city,
              district: resolvedDistrict,
              location_text: "",
              price_try: null,
              note: "",
              latitude: null,
              longitude: null,
            });

            if (error) {
              alert(error.message);
              return;
            }

            trackEvent({
              eventName: "checkin_added",
              userId: session.user.id,
              props: { rating: normalizedRating, beer_name },
            });
            await loadCheckins();
            return;
          }

          setCheckins((prev) => [
            {
              id: uuid(),
              beer_name,
              rating: normalizedRating,
              created_at,
              day_period: dayPeriod,
              country_code: "TR",
              city,
              district: resolvedDistrict,
              location_text: "",
              price_try: null,
              note: "",
              latitude: null,
              longitude: null,
            },
            ...prev,
          ]);
          trackEvent({
            eventName: "checkin_added_local",
            userId: session?.user?.id ?? null,
            props: { rating: normalizedRating, beer_name },
          });
        } finally {
          setIsLogMutating(false);
        }
      }}
  onDelete={deleteCheckin}
  onUpdate={updateCheckin}
/>
      {activeSection === "stats" ? (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Son 7g log", "Last 7d logs")}: <span className="font-semibold">{weeklyRecap.count}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Son 7g ort", "Last 7d avg")}: <span className="font-semibold">{weeklyRecap.avg.toFixed(2)}⭐</span>
          </div>
          <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Son 7g top bira", "Top beer in last 7d")}: <span className="font-semibold">{weeklyRecap.topBeer}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Bu ay log", "This month logs")}: <span className="font-semibold">{monthComparison.currentLogs}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Gecen aya gore", "Vs previous month")}:{" "}
            <span className={`font-semibold ${monthComparison.deltaLogs >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {monthComparison.deltaLogs >= 0 ? "+" : ""}
              {monthComparison.deltaLogs}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Bu ay ort.", "This month avg")}: <span className="font-semibold">{monthComparison.currentAvg.toFixed(2)}⭐</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            {tx(lang, "Puansiz oran", "Unrated share")}: <span className="font-semibold">%{monthComparison.unratedShare}</span>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-sm text-amber-200">{tx(lang, "En cok loglanan biralar (Top 5)", "Most logged beers (Top 5)")}</div>
          <div className="mt-2 space-y-2 text-sm">
            {topBeersOverall.map((b, idx) => (
              <div key={b.beer} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
                <div className="truncate">
                  <span className="mr-2 opacity-70">#{idx + 1}</span>
                  {b.beer}
                </div>
                <div className="text-xs opacity-80">
                  {b.logs} {tx(lang, "log", "logs")} • {b.avg.toFixed(2)}⭐
                </div>
              </div>
            ))}
            {!topBeersOverall.length ? <div className="text-xs opacity-60">{tx(lang, "Yeterli veri yok.", "Not enough data.")}</div> : null}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-amber-200">{tx(lang, "Puan dagilimi (0.5 adim)", "Rating distribution (0.5 step)")}</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs">
            {tx(lang, "Toplam log", "Total logs")}: {ratingDistribution.total}
          </div>
        </div>

        <div
          className="relative grid h-44 grid-cols-11 items-end gap-2"
          onMouseLeave={() => setActiveRatingBucket(null)}
        >
          {ratingDistribution.buckets.map((b) => {
            const h = b.count === 0 ? 8 : Math.max(16, Math.round((b.count / ratingDistribution.max) * 120));
            const isActive = activeBucketInfo?.bucket.rating === b.rating;

            return (
              <button
                key={b.rating}
                type="button"
                onMouseEnter={() => setActiveRatingBucket(b.rating)}
                onFocus={() => setActiveRatingBucket(b.rating)}
                onClick={() => setActiveRatingBucket(b.rating)}
                className="flex min-w-0 flex-col items-center justify-end"
                title={`${b.rating.toFixed(1)}⭐ • ${b.count} ${tx(lang, "log", "logs")} (${b.percent.toFixed(1)}%)`}
              >
                <div className={`mb-1 text-[10px] transition-opacity ${isActive ? "opacity-80" : "opacity-0"}`}>
                  {b.count} ({b.percent.toFixed(0)}%)
                </div>

                <div
                  className={`w-full rounded-t-md border transition-all duration-200 ${
                    isActive
                      ? "border-yellow-200/55 from-amber-500/75 via-amber-400/80 to-yellow-100/95 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                      : "border-amber-100/10 from-amber-700/35 via-amber-500/40 to-yellow-200/55 opacity-40"
                  } bg-gradient-to-t hover:border-yellow-200/50 hover:from-amber-500/70 hover:via-amber-400/75 hover:to-yellow-100/95 hover:shadow-[0_0_22px_rgba(245,158,11,0.65),0_0_42px_rgba(251,191,36,0.35)]`}
                  style={{ height: `${h}px` }}
                />

                <div className={`mt-1 text-[10px] transition-opacity ${isActive ? "opacity-80" : "opacity-45"}`}>
                  {ratingToStarsLabel(b.rating)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-sm text-amber-200">{tx(lang, "Streak ve davranis analizi", "Streak and behavior analysis")}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "Aktif streak", "Current streak")}: <span className="font-semibold">{behaviorStats.currentStreak} {tx(lang, "gun", "days")}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "En iyi streak", "Best streak")}: <span className="font-semibold">{behaviorStats.maxStreak} {tx(lang, "gun", "days")}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "Aktif gun", "Active days")}: <span className="font-semibold">{behaviorStats.uniqueDays}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "Favori gun", "Favorite day")}: <span className="font-semibold">{behaviorStats.dominantWeekday}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "Gece orani", "Night ratio")}: <span className="font-semibold">%{Math.round(behaviorStats.nightShare * 100)}</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              {tx(lang, "Sehir cesidi", "City variety")}: <span className="font-semibold">{behaviorStats.uniqueCities}</span>
            </div>
          </div>

          <div className="mt-3 text-xs opacity-70">{tx(lang, "Rozetler (beta)", "Badges (beta)")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {behaviorStats.badges.map((b) => (
              <div
                key={b.key}
                className="rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-1 text-xs text-amber-100"
                title={b.detail}
              >
                {b.title}
              </div>
            ))}
            {behaviorStats.badges.length === 0 ? (
              <div className="text-xs opacity-60">{tx(lang, "Henuz rozet yok. Log arttikca acilacak.", "No badges yet. They unlock as you log.")}</div>
            ) : null}
          </div>

          <div className="mt-4 text-xs opacity-70">Stereotip rozetler / Stereotype badges</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {stereotypeBadges.map((b) => (
              <div
                key={b.badge_key}
                className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                title={`${b.detail_tr} • ${b.detail_en}`}
              >
                <div className="font-semibold">{b.title_tr}</div>
                <div className="opacity-75">{b.title_en}</div>
              </div>
            ))}
            {!stereotypeBadges.length ? <div className="text-xs opacity-60">{tx(lang, "Henuz stereotip rozet yok.", "No stereotype badges yet.")}</div> : null}
          </div>
        </div>

        {canManageSuggestions ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-amber-200">{tx(lang, "Oneri yonetimi", "Suggestion management")}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshAllBadgesNow()}
                  disabled={badgeRefreshBusy}
                  className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-xs disabled:opacity-60"
                >
                  {badgeRefreshBusy ? "Badges..." : "Badges refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadAdminSuggestions()}
                  className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                >
                  {tx(lang, "Yenile", "Refresh")}
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={adminSuggestionStatusFilter}
                onChange={(e) => setAdminSuggestionStatusFilter(e.target.value as "all" | "new" | "in_progress" | "done")}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
              >
                <option value="all">{tx(lang, "Durum: Tum", "Status: All")}</option>
                <option value="new">{tx(lang, "Yeni", "New")}</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <select
                value={adminSuggestionCategoryFilter}
                onChange={(e) => setAdminSuggestionCategoryFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
              >
                <option value="all">{tx(lang, "Kategori: Tum", "Category: All")}</option>
                {Array.from(new Set(adminSuggestions.map((s) => s.category).filter(Boolean)))
                  .sort((a, b) => a.localeCompare(b, "tr"))
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-2 space-y-2">
              {adminSuggestions
                .filter((s) => adminSuggestionStatusFilter === "all" || s.status === adminSuggestionStatusFilter)
                .filter((s) => adminSuggestionCategoryFilter === "all" || s.category === adminSuggestionCategoryFilter)
                .map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] opacity-75">
                      <div className="truncate">
                        {s.display_name?.trim() || (s.username ? `@${s.username}` : "anon")} • {s.category}
                      </div>
                      <div>{new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "tr-TR")}</div>
                    </div>
                    <div className="mt-1 text-xs">{s.message}</div>
                    <div className="mt-2 flex items-center gap-2">
                      {(["new", "in_progress", "done"] as const).map((st) => (
                        <button
                          key={`${s.id}-${st}`}
                          type="button"
                          onClick={() => void updateSuggestionStatus(s.id, st)}
                          className={`rounded-lg border px-2 py-1 text-[11px] ${
                            s.status === st ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/10"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {adminSuggestionsBusy ? <div className="text-xs opacity-60">{tx(lang, "Oneriler yukleniyor...", "Loading suggestions...")}</div> : null}
              {!adminSuggestionsBusy && !adminSuggestions.length ? (
                <div className="text-xs opacity-60">{tx(lang, "Oneri kaydi yok veya yetki bulunmuyor.", "No suggestion records or no permission.")}</div>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs opacity-75">{tx(lang, "Moderasyon raporlari", "Moderation reports")}</div>
                <button
                  type="button"
                  onClick={() => void loadAdminReports()}
                  className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
                >
                  {tx(lang, "Yenile", "Refresh")}
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {adminReports.map((r) => (
                  <div key={`report-${r.id}`} className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <div className="text-[11px] opacity-70">
                      #{r.id} • {r.target_type}:{r.target_id} • {new Date(r.created_at).toLocaleString(lang === "en" ? "en-US" : "tr-TR")}
                    </div>
                    <div className="mt-1 text-xs">Reason: {r.reason || "user_reported"}</div>
                    <div className="mt-1 flex items-center gap-2">
                      {(["open", "reviewed", "resolved"] as const).map((st) => (
                        <button
                          key={`report-${r.id}-${st}`}
                          type="button"
                          onClick={() => void updateReportStatus(r.id, st)}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            r.status === st ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/10"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {adminReportsBusy ? <div className="text-xs opacity-60">{tx(lang, "Raporlar yukleniyor...", "Loading reports...")}</div> : null}
                {!adminReportsBusy && !adminReports.length ? (
                  <div className="text-xs opacity-60">{tx(lang, "Rapor yok.", "No reports.")}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      <button
        type="button"
        onClick={() => setSuggestionOpen(true)}
        className="fixed bottom-20 right-4 z-40 rounded-full border border-amber-300/35 bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
      >
        {tx(lang, "Oneri", "Suggest")}
      </button>

      {suggestionOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSuggestionOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{tx(lang, "Oneri gonder", "Send suggestion")}</div>
                <div className="text-xs opacity-70">{tx(lang, "Yazdiklarin ekibe dusecek.", "Your message goes to the team.")}</div>
              </div>
              <button
                type="button"
                onClick={() => setSuggestionOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs"
              >
                {tx(lang, "Kapat", "Close")}
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <select
                value={suggestionCategory}
                onChange={(e) => setSuggestionCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                <option value="general">{tx(lang, "Genel", "General")}</option>
                <option value="bug">Bug</option>
                <option value="ux">UX/UI</option>
                <option value="feature">{tx(lang, "Yeni Ozellik", "New feature")}</option>
              </select>
              <textarea
                value={suggestionMessage}
                onChange={(e) => setSuggestionMessage(e.target.value.slice(0, 600))}
                placeholder={tx(lang, "Ne ekleyelim, neyi duzeltelim?", "What should we add or fix?")}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              />
              <div className="text-right text-[11px] opacity-60">{suggestionMessage.length}/600</div>
              <button
                type="button"
                onClick={() => void submitSuggestion()}
                disabled={suggestionBusy || !suggestionMessage.trim()}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
              >
                {suggestionBusy ? tx(lang, "Gonderiliyor...", "Sending...") : tx(lang, "Gonder", "Send")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {onboardingOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => closeOnboarding(true)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black p-4">
            <div className="text-lg font-semibold">{abOnboardingVariant === "A" ? tx(lang, "Hizli baslangic", "Quick start") : tx(lang, "2 dakikada basla", "Start in 2 minutes")}</div>
            <div className="mt-3 space-y-2 text-sm opacity-90">
              <div>{tx(lang, "1. `Log` sekmesinde adim adim bira ekle.", "1. Add beer step by step in `Log`.")}</div>
              <div>{tx(lang, "2. Gecmis gun icin `adet` ile toplu log at, sonra puanlari duzenle.", "2. Use bulk count for past dates, then edit ratings.")}</div>
              <div>{tx(lang, "3. `Harita`da gun/konum yogunlugunu gor.", "3. View day/location density in `Map`.")}</div>
              <div>{tx(lang, "4. `Sosyal`de takip et, akis ve leaderboard'u kullan.", "4. Follow people and use feed/leaderboard in `Social`.")}</div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <Link
                href="/yardim"
                onClick={() => closeOnboarding(true)}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs"
              >
                {tx(lang, "Detayli yardim", "Detailed help")}
              </Link>
              <button
                type="button"
                onClick={() => closeOnboarding(true)}
                className="rounded-xl border border-amber-300/35 bg-amber-500/20 px-3 py-2 text-xs text-amber-100"
              >
                {tx(lang, "Basla", "Start")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tutorialOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/75" onClick={() => closeTutorial(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-amber-300/30 bg-black p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-amber-200/85">
                {lang === "en" ? "Tutorial" : "Tutorial"} {tutorialStepIdx + 1}/{tutorialSteps.length}
              </div>
              <button
                type="button"
                onClick={() => closeTutorial(true)}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
              >
                {lang === "en" ? "Finish" : "Bitir"}
              </button>
            </div>
            <div className="mt-2 text-lg font-semibold">{activeTutorialStep.title}</div>
            <div className="mt-2 text-sm opacity-85">{activeTutorialStep.desc}</div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2 text-xs opacity-75">
              {tx(lang, "Bu adim icin otomatik olarak", "Automatically switched to")}{" "}
              <span className="font-semibold">{activeTutorialStep.section}</span>{" "}
              {lang === "en" ? "section." : "sekmesine gecildi."}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={tutorialStepIdx <= 0}
                onClick={() => setTutorialStepIdx((i) => Math.max(0, i - 1))}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
              >
                {lang === "en" ? "Back" : "Geri"}
              </button>
              {tutorialStepIdx < tutorialSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTutorialStepIdx((i) => Math.min(tutorialSteps.length - 1, i + 1))}
                  className="rounded-xl border border-amber-300/35 bg-amber-500/20 px-3 py-2 text-xs text-amber-100"
                >
                  {tx(lang, "Ileri", "Next")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => closeTutorial(true)}
                  className="rounded-xl border border-emerald-300/35 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-100"
                >
                  {lang === "en" ? "Done" : "Tamamladim"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 p-2">
          {[
            { key: "log", label: t(lang, "nav_log") },
            { key: "social", label: t(lang, "nav_social") },
            { key: "heatmap", label: t(lang, "nav_heatmap") },
            { key: "stats", label: t(lang, "nav_stats") },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSection(item.key as HomeSection)}
              className={`rounded-xl border px-2 py-2 text-xs ${
                activeSection === item.key
                  ? "border-amber-200/50 bg-amber-300/15 text-amber-200"
                  : "border-white/10 bg-black/30 text-white/75"
              }`}
            >
              {item.label}
            </button>
          ))}
          <Link
            href="/yardim"
            className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center text-xs text-white/75"
          >
            {t(lang, "nav_help")}
          </Link>
        </div>
      </nav>
    </main>
  );
}
