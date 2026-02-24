"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import DayModal from "@/components/DayModal";
import MonthZoom from "@/components/MonthZoom";
import FieldHeatmap from "@/components/FieldHeatmap";
import FootballHeatmap from "@/components/FootballHeatmap";
import SocialPanel from "@/components/SocialPanel";
import { usernameFromEmail, usernameToCandidateEmails } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";

type Checkin = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
};

type FavoriteBeer = {
  beer_name: string;
  rank: number;
};

type HeaderProfile = {
  username: string;
  avatar_path?: string | null;
};

type HomeSection = "log" | "social" | "heatmap" | "stats";

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
  { brand: "Hoegaarden", format: "Fici", ml: 500 },
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
  return clamp(v, 0, 5);
}

function looksLikeEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim().toLowerCase());
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
}: {
  formatLabel: string;
  query: string;
  setQuery: (v: string) => void;
  pinned: string[];
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const shownPinned = q ? pinned.filter((x) => x.toLowerCase().includes(q)) : pinned;
  const shownOptions = q ? options.filter((x) => x.toLowerCase().includes(q)) : options;

  const pinnedSet = new Set(shownPinned);
  const merged = [...shownPinned, ...shownOptions.filter((x) => !pinnedSet.has(x))].slice(0, 30);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      {pinned.length > 0 && (
        <div className="mb-2">
          <div className="mb-2 text-[11px] opacity-60">★ En çok içtiklerin</div>
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
          placeholder={`${formatLabel} için ara... (örn. efes, 330)`}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-white/25"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
        >
          {open ? "Kapat" : "Aç"}
        </button>
      </div>

      <div className="mt-2 text-xs opacity-70">
        Seçili: <span className="opacity-90">{value || "—"}</span>
      </div>

      {open && (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/60 p-2">
          {merged.length === 0 ? (
            <div className="px-2 py-2 text-sm opacity-60">Sonuç yok.</div>
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

        const signupEmail = emailCandidates[0];
        const { error } = await supabase.auth.signUp({ email: signupEmail, password: p });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("rate limit")) {
            alert("Çok sık kayıt denemesi yapıldı. 1-2 dakika bekleyip tekrar dene.");
          } else {
            alert(error.message || "Kayıt başarısız.");
          }
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

  // logging state
  const today = useMemo(() => isoTodayLocal(), []);
  const [format, setFormat] = useState<BeerItem["format"]>("Fici");
  const [beerQuery, setBeerQuery] = useState("");
  const [beerName, setBeerName] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [activeRatingBucket, setActiveRatingBucket] = useState<number | null>(null);
  const [dateISO, setDateISO] = useState(today);
  const [dateOpen, setDateOpen] = useState(false);
  const [batchBeerNames, setBatchBeerNames] = useState<string[]>([]);
  const [favoriteOnSave, setFavoriteOnSave] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteBeer[]>([]);
  const [replaceFavoriteRank, setReplaceFavoriteRank] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<HomeSection>("log");
  const [recentExpandStep, setRecentExpandStep] = useState(0);
  const [headerProfile, setHeaderProfile] = useState<HeaderProfile | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);
  const isBackDate = dateISO !== today;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadCheckins() {
    if (!session?.user?.id) return;

    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;

    const { data, error } = await supabase
      .from("checkins")
      .select("id, beer_name, rating, created_at")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setCheckins((data as any) ?? []);
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

  useEffect(() => {
    if (session?.user?.id) {
      loadCheckins();
      loadFavorites();
      supabase
        .from("profiles")
        .select("username, avatar_path")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setHeaderProfile({
              username: (data as any).username,
              avatar_path: (data as any).avatar_path,
            });
          } else {
            setHeaderProfile({
              username: usernameFromEmail(session.user.email) || `user-${session.user.id.slice(0, 6)}`,
              avatar_path: "",
            });
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function syncFavoriteAfterCheckin(beer: string) {
    if (!session?.user?.id || !favoriteOnSave) return;
    const trimmed = favoriteBeerName(beer);
    if (!trimmed) return;

    const alreadyFavorite = favorites.some((f) => f.beer_name === trimmed);
    if (alreadyFavorite) return;

    if (favorites.length < 3) {
      const used = new Set(favorites.map((f) => Number(f.rank)));
      let rank = 1;
      while (used.has(rank) && rank <= 3) rank += 1;

      const { error } = await supabase.from("favorite_beers").insert({
        user_id: session.user.id,
        beer_name: trimmed,
        rank,
      });

      if (error) {
        alert(error.message);
        return;
      }

      setFavorites((prev) => [...prev, { beer_name: trimmed, rank }].sort((a, b) => a.rank - b.rank));
      trackEvent({
        eventName: "favorite_added",
        userId: session.user.id,
        props: { beer_name: trimmed, rank, source: "checkin_form" },
      });
      return;
    }

    const rankToReplace = replaceFavoriteRank ?? Number(favorites[0]?.rank ?? 1);
    const target = favorites.find((f) => Number(f.rank) === rankToReplace);
    if (!target) return;

    const { error } = await supabase
      .from("favorite_beers")
      .update({ beer_name: trimmed })
      .eq("user_id", session.user.id)
      .eq("rank", rankToReplace);

    if (error) {
      alert(error.message);
      return;
    }

    setFavorites((prev) =>
      prev
        .map((f) => (Number(f.rank) === rankToReplace ? { ...f, beer_name: trimmed } : f))
        .sort((a, b) => a.rank - b.rank)
    );
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
  const recentVisibleCount = useMemo(() => {
    if (recentExpandStep <= 0) return 5;
    if (recentExpandStep === 1) return 10;
    if (recentExpandStep === 2) return 20;
    return checkins.length;
  }, [checkins.length, recentExpandStep]);

  function quickLogFromFeed(payload: { beerName: string; rating: number }) {
    const incomingBeer = payload.beerName?.trim();
    if (!incomingBeer) return;

    if (incomingBeer.includes("— Fici —")) setFormat("Fici");
    else if (incomingBeer.includes("— Şişe/Kutu —")) setFormat("Şişe/Kutu");

    setBeerName(incomingBeer);
    setBeerQuery(incomingBeer);
    const nextRating = Number(payload.rating || 0);
    setRating(nextRating > 0 ? Math.round(clamp(nextRating, 0, 5) * 2) / 2 : null);
    setActiveSection("log");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

async function deleteCheckin(id: string) {
  // Session varsa Supabase dene
  if (session?.user?.id) {
    const { error } = await supabase.from("checkins").delete().eq("id", id);
    if (!error) {
      trackEvent({
        eventName: "checkin_deleted",
        userId: session.user.id,
        props: { id },
      });
      await loadCheckins();
      return;
    }
    console.error("Supabase delete failed -> local fallback:", error.message);
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
      .eq("id", payload.id);

    if (!error) {
      trackEvent({
        eventName: "checkin_updated",
        userId: session.user.id,
        props: { id: payload.id, rating: normalizedRating },
      });
      await loadCheckins();
      return;
    }
    console.error("Supabase update failed -> local fallback:", error.message);
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
    const normalizedRating = sanitizeRating(rating);

    const created_at =
      dateISO === today ? new Date().toISOString() : new Date(`${dateISO}T12:00:00.000Z`).toISOString();

    // 1) session varsa supabase dene
    if (session?.user?.id) {
      const rows = targets.map((beer) => ({
        user_id: session.user.id,
        beer_name: beer,
        rating: normalizedRating,
        created_at,
      }));
      const { error } = await supabase.from("checkins").insert(rows);

      if (!error) {
        for (const beer of targets) await syncFavoriteAfterCheckin(beer);
        trackEvent({
          eventName: "checkin_added",
          userId: session.user.id,
          props: { rating: normalizedRating, beer_count: targets.length, date: dateISO },
        });
        setDateISO(today);
        setRating(null);
        setDateOpen(false);
        setBatchBeerNames([]);
        await loadCheckins();
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
        })),
        ...prev,
      ];
      return next;
    });

    setDateISO(today);
    setRating(null);
    setDateOpen(false);
    setBatchBeerNames([]);
    trackEvent({
      eventName: "checkin_added_local",
      userId: session?.user?.id ?? null,
      props: { rating: normalizedRating, beer_count: targets.length, date: dateISO },
    });
  }

  if (!session) {
    return (
      <main className="min-h-screen p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold">Birader</h1>
        <p className="text-sm opacity-80 mt-1">Bugün ne içtin?</p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-80">{authMode === "login" ? "Giriş" : "Kayıt ol"}</div>
            <button
              className="text-xs underline opacity-70"
              onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
              type="button"
            >
              {authMode === "login" ? "Kayıt ol" : "Giriş yap"}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={authIdentifier}
              onChange={(e) => setAuthIdentifier(e.target.value)}
              placeholder={
                authMode === "login" ? "kullanıcı adı veya e-posta" : "e-posta (ör. ati@birader.app)"
              }
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="şifre"
              type="password"
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none"
            />
          </div>

          <button
            onClick={authWithUsernamePassword}
            disabled={authBusy}
            className="mt-3 w-full rounded-2xl bg-white text-black py-3 font-semibold active:scale-[0.99] disabled:opacity-50"
          >
            {authBusy ? "..." : authMode === "login" ? "Giriş yap" : "Hesap oluştur"}
          </button>

          <p className="mt-3 text-xs opacity-60">
            Not: Kayıt e-posta ile yapılır. Girişte e-posta veya kullanıcı adı kullanabilirsin.
            Eski <code>@birader.local</code> hesaplar girişte otomatik desteklenir.
          </p>
        </div>

        <FieldHeatmap year={year} checkins={checkins} onSelectDay={(d) => setSelectedDay(d)} />

        <DayModal
          open={selectedDay !== null}
          day={selectedDay ?? ""}
          checkins={dayCheckins}
          onClose={() => setSelectedDay(null)}
          onAdd={async ({ day, beer_name, rating }) => {
            const created_at = new Date(`${day}T12:00:00.000Z`).toISOString();
            setCheckins((prev) => [
              { id: uuid(), beer_name, rating: sanitizeRating(rating), created_at },
              ...prev,
          ]);
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
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1.5">
            <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-black/40">
              {headerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerAvatarUrl} alt="profil avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] opacity-70">
                  :)
                </div>
              )}
            </div>
            <div className="max-w-[120px] truncate text-xs text-amber-100">
              @{headerProfile?.username || usernameFromEmail(session?.user?.email) || "kullanici"}
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-md border border-red-300/70 bg-red-500/15 px-3 py-1 text-xs font-bold tracking-[0.12em] text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.35)]"
          >
            EXIT ⟶
          </button>
        </div>
      </div>

      {activeSection === "log" ? (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-amber-200 mb-2">Bira logla</div>

        <div className="mb-3">
          <label className="block text-xs opacity-70 mb-2">Format</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat("Fici")}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                format === "Fici" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20"
              }`}
            >
              Fıçı
            </button>
            <button
              type="button"
              onClick={() => setFormat("Şişe/Kutu")}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                format === "Şişe/Kutu" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20"
              }`}
            >
              Şişe / Kutu
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs opacity-70 mb-2">Bira</label>
          <ComboboxBeer
            formatLabel={format === "Fici" ? "Fıçı" : "Şişe/Kutu"}
            query={beerQuery}
            setQuery={setBeerQuery}
            pinned={topBeerLabelsByFormat[format] ?? []}
            options={beerLabelsForFormat}
            value={beerName}
            onChange={setBeerName}
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs opacity-70 mb-2">Tarih</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDateOpen((v) => !v)}
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 outline-none text-left"
            >
              <div className="flex items-center justify-between">
                <span>{dateISO}</span>
                <span className="text-white/55">📅</span>
              </div>
            </button>

            {dateOpen ? (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateISO}
                    onChange={(e) => setDateISO(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-white/20"
                    onClick={() => {
                      setDateISO(today);
                      setDateOpen(false);
                    }}
                    title="Bugün"
                  >
                    Bugün
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDateOpen(false)}
                    className="text-xs opacity-70 hover:opacity-100"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-1 text-xs opacity-60">Önerilen: bugün. Geçmiş için takvimi aç.</div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs opacity-70 mb-2">Puan</label>
          <button
            type="button"
            onClick={() => setRating((r) => (r === null ? 3.5 : null))}
            className={`mb-2 rounded-xl border px-3 py-1.5 text-xs ${
              rating === null ? "border-white/30 bg-white/15" : "border-white/10 bg-black/20"
            }`}
          >
            {rating === null ? "Puansız log (açık)" : "Puansız log"}
          </button>
          <StarRatingHalf value={rating} onChange={setRating} />
          <div className="mt-1 text-xs opacity-60">
            {rating === null
              ? "Bu log puansız kaydedilecek."
              : "Hover → yarım/yıldız seç • Tıkla → set • Aynı puana tıkla → puansız"}
          </div>
        </div>

        {isBackDate ? (
          <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs opacity-80">Eski tarih için çoklu log</div>
              <button
                type="button"
                onClick={() => {
                  const n = (beerName || "").trim();
                  if (!n) return;
                  setBatchBeerNames((prev) => (prev.includes(n) ? prev : [...prev, n]));
                }}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs"
              >
                Listeye ekle
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {batchBeerNames.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBatchBeerNames((prev) => prev.filter((x) => x !== b))}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                  title="Listeden çıkar"
                >
                  {b} ×
                </button>
              ))}
              {!batchBeerNames.length ? <div className="text-xs opacity-60">Henüz listede bira yok.</div> : null}
            </div>
          </div>
        ) : null}

        <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <label className="flex items-center gap-2 text-xs opacity-85">
            <input
              type="checkbox"
              checked={favoriteOnSave}
              onChange={(e) => setFavoriteOnSave(e.target.checked)}
            />
            Bu logdaki birayi favorilere ekle
          </label>

          {favoriteOnSave ? (
            <div className="mt-2 text-xs opacity-70">
              {favorites.some((f) => f.beer_name === favoriteCandidate)
                ? "Bu bira zaten favorilerinde."
                : favorites.length < 3
                  ? `Favori listene eklenecek (${favorites.length}/3).`
                  : "Favori listesi dolu (3/3). Asagidan degisecek favoriyi sec."}
            </div>
          ) : null}

          {favoriteOnSave &&
          favorites.length >= 3 &&
          !favorites.some((f) => f.beer_name === favoriteCandidate) ? (
            <div className="mt-2">
              <label className="mb-1 block text-xs opacity-70">Degisecek favori</label>
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

        <button
          onClick={addCheckin}
          disabled={!(isBackDate ? batchBeerNames.length > 0 || !!beerName : !!beerName)}
          className="mt-2 w-full rounded-2xl bg-white text-black py-3 font-semibold active:scale-[0.99] disabled:opacity-50"
        >
          {isBackDate && batchBeerNames.length > 0 ? `${batchBeerNames.length} birayı kaydet` : "Kaydet"}
        </button>
      </section>
      ) : null}

      {activeSection === "log" ? (
      <section className="mt-6">
        <div className="text-sm text-amber-200 mb-2">Son check-in’ler</div>
        <div className="space-y-2">
          {checkins.slice(0, recentVisibleCount).map((c) => (
            <div key={c.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.beer_name}</div>
                <div className="text-sm">{c.rating === null ? "—" : `${c.rating}⭐`}</div>
              </div>
              <div className="text-xs opacity-70 mt-1">
                {new Date(c.created_at).toLocaleString("tr-TR")}
              </div>
            </div>
          ))}
          {checkins.length === 0 ? (
            <div className="text-sm opacity-70">Henüz check-in yok. İlkini gir.</div>
          ) : null}
        </div>

        {checkins.length > recentVisibleCount ? (
          <button
            type="button"
            onClick={() => setRecentExpandStep((s) => Math.min(3, s + 1))}
            className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm"
          >
            {recentExpandStep === 0
              ? "5 tane daha göster"
              : recentExpandStep === 1
                ? "10 tane daha göster"
                : "Tümünü göster"}
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
      />
      ) : null}

      {activeSection === "heatmap" ? (
        <>
          <FootballHeatmap year={year} checkins={checkins} onSelectDay={(d) => setSelectedDay(d)} />
          <MonthZoom
            open={selectedMonth !== null}
            year={year}
            monthIndex={selectedMonth ?? 0}
            checkins={checkins}
            selectedDay={selectedDay}
            onClose={() => setSelectedMonth(null)}
            onSelectDay={(d) => setSelectedDay(d)}
          />
        </>
      ) : null}

      <DayModal
      open={selectedDay !== null}
      day={selectedDay ?? ""}
      checkins={dayCheckins}
      onClose={() => setSelectedDay(null)}
      onAdd={async ({ day, beer_name, rating }) => {
        const created_at = new Date(`${day}T12:00:00.000Z`).toISOString();
        const normalizedRating = sanitizeRating(rating);

    if (session?.user?.id) {
      const { error } = await supabase.from("checkins").insert({
        user_id: session.user.id,
        beer_name,
        rating: normalizedRating,
        created_at,
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
      { id: uuid(), beer_name, rating: normalizedRating, created_at },
      ...prev,
    ]);
  }}
  onDelete={deleteCheckin}
  onUpdate={updateCheckin}
/>
      {activeSection === "stats" ? (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-amber-200">Puan dağılımı (0.5 adım)</div>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs">
            Toplam log: {ratingDistribution.total}
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
                title={`${b.rating.toFixed(1)}⭐ • ${b.count} log (${b.percent.toFixed(1)}%)`}
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
      </section>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1 p-2">
          {[
            { key: "log", label: "Logla" },
            { key: "social", label: "Sosyal" },
            { key: "heatmap", label: "Harita" },
            { key: "stats", label: "İstat" },
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
        </div>
      </nav>
    </main>
  );
}
