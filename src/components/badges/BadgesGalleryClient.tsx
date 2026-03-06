"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BadgeDetailSheet from "@/components/badges/BadgeDetailSheet";
import BadgeVisual from "@/components/badges/BadgeVisual";
import { useAppLang } from "@/lib/appLang";
import {
  badgeTiers,
  buildBadgeView,
  evaluateBadges,
  loadUnlockedAt,
  saveUnlockedAt,
  type Badge,
  type BadgeCheckin,
} from "@/lib/badgeSystem";
import { supabase } from "@/lib/supabase";

type CheckinRow = {
  id: string;
  beer_name: string;
  created_at: string;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
  note?: string | null;
};

const SELECT_FIELDS = "id, beer_name, created_at, city, district, location_text, note";

export default function BadgesGalleryClient() {
  const { lang, setLang } = useAppLang("tr");
  const [tier, setTier] = useState<string>("all");
  const [checkins, setCheckins] = useState<BadgeCheckin[]>([]);
  const [unlockedAtById, setUnlockedAtById] = useState<Record<number, string>>({});
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const tiers = useMemo(() => badgeTiers(), []);
  const evaluated = useMemo(() => evaluateBadges(checkins), [checkins]);

  const badges = useMemo(() => {
    const built = buildBadgeView({ checkins, unlockedAtById });
    return built.badges;
  }, [checkins, unlockedAtById]);

  const progressById = evaluated.progressById;
  const filtered = useMemo(
    () => (tier === "all" ? badges : badges.filter((b) => b.tier === tier)),
    [badges, tier]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id || "guest";
      const saved = loadUnlockedAt(uid);
      if (mounted) setUnlockedAtById(saved);

      if (!auth.session?.user?.id) {
        if (mounted) setCheckins([]);
        return;
      }

      const { data } = await supabase
        .from("checkins")
        .select(SELECT_FIELDS)
        .eq("user_id", auth.session.user.id)
        .order("created_at", { ascending: false })
        .limit(6000);

      if (!mounted) return;
      const rows = ((data as CheckinRow[] | null) ?? []).map((r) => ({
        id: String(r.id),
        beer_name: r.beer_name,
        created_at: r.created_at,
        city: r.city,
        district: r.district,
        location_text: r.location_text,
        note: r.note,
      }));
      setCheckins(rows);

      const unlocked = evaluateBadges(rows).badges.filter((b) => b.unlocked);
      if (!unlocked.length) return;
      const next = { ...saved };
      let changed = false;
      const now = new Date().toISOString();
      for (const b of unlocked) {
        if (!next[b.id]) {
          next[b.id] = now;
          changed = true;
        }
      }
      if (changed) {
        saveUnlockedAt(uid, next);
        setUnlockedAtById(next);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#F5EDD8]">{lang === "en" ? "Badge Gallery" : "Rozet Galerisi"}</h1>
          <p className="mt-1 text-sm text-[#A0764A]">
            {lang === "en"
              ? `${unlockedCount} / ${badges.length} unlocked`
              : `${unlockedCount} / ${badges.length} rozet açıldı`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang("tr")}
            className={`rounded-md border px-2 py-1 text-xs ${
              lang === "tr" ? "border-amber-300/40 bg-amber-500/20" : "border-white/15 bg-white/10"
            }`}
          >
            TR
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-md border px-2 py-1 text-xs ${
              lang === "en" ? "border-amber-300/40 bg-amber-500/20" : "border-white/15 bg-white/10"
            }`}
          >
            EN
          </button>
          <Link href="/" className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs">
            {lang === "en" ? "Home" : "Ana sayfa"}
          </Link>
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTier("all")}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            tier === "all" ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/10"
          }`}
        >
          {lang === "en" ? "All" : "Tümü"}
        </button>
        {tiers.map((row) => (
          <button
            key={`tier-${row.tier}`}
            type="button"
            onClick={() => setTier(row.tier)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
              tier === row.tier ? "border-amber-300/35 bg-amber-500/15" : "border-white/15 bg-white/10"
            }`}
          >
            {lang === "en" ? row.tier : row.tierTR}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.map((badge) => (
          <button
            key={`badge-grid-${badge.id}`}
            type="button"
            onClick={() => setSelectedBadge(badge)}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-amber-300/35 hover:bg-white/10"
          >
            <BadgeVisual badge={badge} size={72} unlocked={badge.unlocked} />
            <div className="mt-2 text-sm font-medium text-[#F5EDD8]">{lang === "en" ? badge.name : badge.nameTR}</div>
            <div className="mt-0.5 text-[11px] text-[#A0764A]">{lang === "en" ? badge.tier : badge.tierTR}</div>
          </button>
        ))}
      </section>

      <BadgeDetailSheet
        open={Boolean(selectedBadge)}
        badge={selectedBadge}
        progress={selectedBadge ? progressById[selectedBadge.id] : undefined}
        unlockedAt={selectedBadge ? unlockedAtById[selectedBadge.id] : undefined}
        lang={lang}
        onClose={() => setSelectedBadge(null)}
      />
    </main>
  );
}
