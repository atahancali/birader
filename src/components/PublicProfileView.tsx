"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FootballHeatmap from "@/components/FootballHeatmap";
import FieldHeatmap from "@/components/FieldHeatmap";
import DayModal from "@/components/DayModal";
import { supabase } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";
import { computeStereotypeBadges } from "@/lib/badges";
import { dayPeriodLabelEn, dayPeriodLabelTr, type DayPeriod } from "@/lib/dayPeriod";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  bio: string;
  is_public: boolean;
  avatar_path?: string | null;
};

type CheckinRow = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
  day_period?: DayPeriod | null;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
  price_try?: number | null;
  note?: string | null;
};

type FavoriteBeerRow = {
  beer_name: string;
  rank: number;
};

function avgRating(checkins: CheckinRow[]) {
  const rated = checkins.filter((c) => c.rating !== null && c.rating !== undefined);
  if (!rated.length) return 0;
  const sum = rated.reduce((acc, c) => acc + Number(c.rating ?? 0), 0);
  return Math.round((sum / rated.length) * 100) / 100;
}

export default function PublicProfileView({ username }: { username: string }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBeerRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<"football" | "grid">("football");
  const [gridCellMetric, setGridCellMetric] = useState<"color" | "count" | "avgRating">("color");

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState(currentYear);
  const avg = useMemo(() => avgRating(checkins), [checkins]);
  const stereotypeBadges = useMemo(() => computeStereotypeBadges(checkins), [checkins]);
  const isOwnProfile = sessionUserId === profile?.user_id;
  const favoriteNames = useMemo(
    () => new Set(favorites.map((f) => favoriteBeerName(f.beer_name))),
    [favorites]
  );
  const favoriteOptionPool = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of checkins) {
      const n = favoriteBeerName(c.beer_name || "");
      if (!n) continue;
      counts.set(n, (counts.get(n) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
  }, [checkins]);
  const filteredFavoriteOptions = useMemo(() => {
    const q = favoriteQuery.trim().toLowerCase();
    const pool = favoriteOptionPool.filter((name) => !favoriteNames.has(name));
    if (!q) return pool.slice(0, 20);
    return pool.filter((name) => name.toLowerCase().includes(q)).slice(0, 20);
  }, [favoriteNames, favoriteOptionPool, favoriteQuery]);
  const shownName = useMemo(() => {
    const d = (profile?.display_name || "").trim();
    return d || `@${profile?.username || ""}`;
  }, [profile?.display_name, profile?.username]);
  const dayCheckins = useMemo(() => {
    if (!selectedDay) return [];
    return checkins.filter((c) => {
      const iso = new Date(c.created_at).toISOString().slice(0, 10);
      return iso === selectedDay;
    });
  }, [checkins, selectedDay]);
  const beerOptions = useMemo(
    () => Array.from(new Set(checkins.map((c) => c.beer_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
    [checkins]
  );

  function avatarPublicUrl(path?: string | null) {
    const clean = (path || "").trim();
    if (!clean) return "";
    const { data } = supabase.storage.from("avatars").getPublicUrl(clean);
    return data.publicUrl;
  }

  async function fileToJpegBlob(file: File) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 512;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Gorsel islenemedi.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) throw new Error("Gorsel donusturulemedi.");
    return blob;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorText(null);

      const normalized = normalizeUsername(username);
      const { data: row, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, bio, is_public, avatar_path")
        .eq("username", normalized)
        .maybeSingle();

      if (error) {
        setErrorText(error.message);
        setLoading(false);
        return;
      }

      if (!row) {
        setErrorText("Profil bulunamadi.");
        setLoading(false);
        return;
      }

      const p = row as ProfileRow;
      if (!p.is_public && sessionUserId !== p.user_id) {
        setErrorText("Bu profil gizli.");
        setLoading(false);
        return;
      }

      setProfile(p);
      setEditDisplayName((p.display_name || "").trim() || p.username);
      setEditBio(p.bio || "");
      setEditIsPublic(p.is_public);

      const start = `${year}-01-01T00:00:00.000Z`;
      const end = `${year + 1}-01-01T00:00:00.000Z`;

      const [favoritesRes, checkinsRes, followersRes, followingRes] = await Promise.all([
        supabase
          .from("favorite_beers")
          .select("beer_name, rank")
          .eq("user_id", p.user_id)
          .order("rank", { ascending: true }),
        supabase
          .from("checkins")
          .select("id, beer_name, rating, created_at, day_period, city, district, location_text, price_try, note")
          .eq("user_id", p.user_id)
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false }),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", p.user_id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", p.user_id),
      ]);

      if (favoritesRes.error) setErrorText(favoritesRes.error.message);
      if (checkinsRes.error) setErrorText(checkinsRes.error.message);
      if (followersRes.error) setErrorText(followersRes.error.message);
      if (followingRes.error) setErrorText(followingRes.error.message);

      setFavorites((favoritesRes.data as FavoriteBeerRow[] | null) ?? []);
      setCheckins((checkinsRes.data as CheckinRow[] | null) ?? []);
      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);

      if (sessionUserId && sessionUserId !== p.user_id) {
        const [{ data: followRow }, { data: followsMeRow }] = await Promise.all([
          supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", sessionUserId)
            .eq("following_id", p.user_id)
            .maybeSingle(),
          supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", p.user_id)
            .eq("following_id", sessionUserId)
            .maybeSingle(),
        ]);
        setIsFollowing(Boolean(followRow));
        setFollowsMe(Boolean(followsMeRow));
      } else {
        setIsFollowing(false);
        setFollowsMe(false);
      }

      trackEvent({
        eventName: "profile_view",
        userId: sessionUserId,
        props: { target_user_id: p.user_id, target_username: p.username },
      });

      setLoading(false);
    }

    void loadProfile();
  }, [sessionUserId, username, year]);

  async function toggleFollow() {
    if (!profile || !sessionUserId || sessionUserId === profile.user_id) return;

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", sessionUserId)
        .eq("following_id", profile.user_id);

      if (error) {
        alert(error.message);
        return;
      }

      setIsFollowing(false);
      setFollowers((v) => Math.max(0, v - 1));
      trackEvent({
        eventName: "follow_removed",
        userId: sessionUserId,
        props: { target_user_id: profile.user_id },
      });
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: sessionUserId,
      following_id: profile.user_id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setIsFollowing(true);
    setFollowers((v) => v + 1);
    trackEvent({
      eventName: "follow_created",
      userId: sessionUserId,
      props: { target_user_id: profile.user_id },
    });
  }

  async function saveOwnProfile() {
    if (!profile || !isOwnProfile || !sessionUserId) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editDisplayName.trim().slice(0, 32),
        bio: editBio.trim(),
        is_public: editIsPublic,
      })
      .eq("user_id", sessionUserId);
    setSavingProfile(false);
    if (error) {
      alert(error.message);
      return;
    }
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            display_name: editDisplayName.trim().slice(0, 32),
            bio: editBio.trim(),
            is_public: editIsPublic,
          }
        : prev
    );
    setEditOpen(false);
  }

  async function onAvatarFileChange(file?: File) {
    if (!file || !sessionUserId || !isOwnProfile) return;
    const type = (file.type || "").toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
      alert("Sadece JPG, PNG veya WebP yukleyebilirsin.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Avatar en fazla 2MB olabilir.");
      return;
    }
    try {
      setAvatarUploading(true);
      const blob = await fileToJpegBlob(file);
      const uploadPath = `${sessionUserId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(uploadPath, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) {
        alert(upErr.message);
        return;
      }
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_path: uploadPath })
        .eq("user_id", sessionUserId);
      if (dbErr) {
        alert(dbErr.message);
        return;
      }
      setProfile((prev) => (prev ? { ...prev, avatar_path: uploadPath } : prev));
    } catch (e: any) {
      alert(e?.message || "Avatar islenemedi.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function addFavoriteFromProfile(rawName?: string) {
    if (!isOwnProfile || !sessionUserId) return;
    const beer = favoriteBeerName((rawName ?? favoriteQuery).trim());
    if (!beer) return;
    const { data: rows, error: readErr } = await supabase
      .from("favorite_beers")
      .select("beer_name, rank")
      .eq("user_id", sessionUserId)
      .order("rank", { ascending: true });
    if (readErr) {
      alert(readErr.message);
      return;
    }
    const current = ((rows as FavoriteBeerRow[] | null) ?? []).map((f) => ({
      ...f,
      beer_name: favoriteBeerName(f.beer_name),
    }));
    if (current.some((f) => f.beer_name === beer)) {
      setFavorites(current);
      return;
    }
    if (current.length >= 3) {
      alert("En fazla 3 favori ekleyebilirsin.");
      setFavorites(current);
      return;
    }
    const usedRanks = new Set(current.map((f) => Number(f.rank)));
    let rank = 1;
    while (usedRanks.has(rank) && rank <= 3) rank += 1;
    const { error } = await supabase.from("favorite_beers").insert({ user_id: sessionUserId, beer_name: beer, rank });
    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        const { data: refreshRows } = await supabase
          .from("favorite_beers")
          .select("beer_name, rank")
          .eq("user_id", sessionUserId)
          .order("rank", { ascending: true });
        const refreshed = ((refreshRows as FavoriteBeerRow[] | null) ?? []).map((f) => ({
          ...f,
          beer_name: favoriteBeerName(f.beer_name),
        }));
        setFavorites(refreshed);
        return;
      }
      alert(error.message);
      return;
    }
    setFavorites((prev) => {
      if (prev.some((f) => f.beer_name === beer)) return prev;
      return [...prev, { beer_name: beer, rank }].sort((a, b) => a.rank - b.rank);
    });
    setFavoriteQuery("");
  }

  async function removeFavoriteFromProfile(rank: number) {
    if (!isOwnProfile || !sessionUserId) return;
    const { error } = await supabase
      .from("favorite_beers")
      .delete()
      .eq("user_id", sessionUserId)
      .eq("rank", rank);
    if (error) {
      alert(error.message);
      return;
    }
    setFavorites((prev) => prev.filter((f) => Number(f.rank) !== rank));
  }

  async function addCheckinOnDay(payload: { day: string; beer_name: string; rating: number | null }) {
    if (!sessionUserId || !isOwnProfile) return;
    const created_at = new Date(`${payload.day}T12:00:00.000Z`).toISOString();
    const { error } = await supabase.from("checkins").insert({
      user_id: sessionUserId,
      beer_name: payload.beer_name.trim(),
      rating: payload.rating,
      created_at,
      day_period: "evening",
    });
    if (error) {
      alert(error.message);
      return;
    }
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;
    const { data } = await supabase
      .from("checkins")
      .select("id, beer_name, rating, created_at, day_period, city, district, location_text, price_try, note")
      .eq("user_id", sessionUserId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    setCheckins((data as CheckinRow[] | null) ?? []);
  }

  async function deleteCheckinOnDay(id: string) {
    if (!sessionUserId || !isOwnProfile) return;
    const { error } = await supabase.from("checkins").delete().eq("id", id).eq("user_id", sessionUserId);
    if (error) {
      alert(error.message);
      return;
    }
    setCheckins((prev) => prev.filter((c) => c.id !== id));
  }

  async function updateCheckinOnDay(payload: { id: string; beer_name: string; rating: number | null }) {
    if (!sessionUserId || !isOwnProfile) return;
    const { error } = await supabase
      .from("checkins")
      .update({ beer_name: payload.beer_name.trim(), rating: payload.rating })
      .eq("id", payload.id)
      .eq("user_id", sessionUserId);
    if (error) {
      alert(error.message);
      return;
    }
    setCheckins((prev) =>
      prev.map((c) => (c.id === payload.id ? { ...c, beer_name: payload.beer_name.trim(), rating: payload.rating } : c))
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4">
        <div className="text-sm opacity-70">Profil yukleniyor...</div>
      </main>
    );
  }

  if (errorText || !profile) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4">
        <Link href="/" className="text-xs underline opacity-80">
          Ana sayfaya don
        </Link>
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm">
          {errorText ?? "Profil bulunamadi."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-md mx-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-black/30">
            {profile.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPublicUrl(profile.avatar_path)}
                alt={`${profile.username} avatar`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
          <div className="text-xs opacity-70">Birader Profil</div>
          <h1 className="text-2xl font-bold">{shownName}</h1>
          <div className="text-xs opacity-70">@{profile.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              {editOpen ? "Kapat" : "Edit profile"}
            </button>
          ) : null}
          <Link href="/" className="text-xs underline opacity-80">
            Ana sayfa
          </Link>
        </div>
      </div>

      {profile.bio ? <p className="mt-2 text-sm opacity-80">{profile.bio}</p> : null}

      {isOwnProfile && editOpen ? (
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-80">Profil ayarlari</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-black/30">
              {profile.avatar_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPublicUrl(profile.avatar_path)} alt="avatar" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <label className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs cursor-pointer">
              {avatarUploading ? "Yukleniyor..." : "Avatar yukle"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void onAvatarFileChange(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="mt-2 grid gap-2">
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              maxLength={32}
              placeholder="gorunen isim"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <input
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="kisa bio (opsiyonel)"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <label className="flex items-center gap-2 text-xs opacity-80">
              <input
                type="checkbox"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
              />
              Profil herkese acik
            </label>
            <button
              type="button"
              onClick={() => void saveOwnProfile()}
              disabled={savingProfile}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {savingProfile ? "Kaydediliyor..." : "Profili kaydet"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">Favoriler (en fazla 3)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {favorites.map((f) => (
                <button
                  key={`edit-fav-${f.rank}`}
                  type="button"
                  onClick={() => void removeFavoriteFromProfile(Number(f.rank))}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                  title="Kaldir"
                >
                  #{f.rank} {f.beer_name} ×
                </button>
              ))}
              {!favorites.length ? <div className="text-xs opacity-60">Henuz favori yok.</div> : null}
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2">
              <input
                value={favoriteQuery}
                onChange={(e) => setFavoriteQuery(e.target.value)}
                placeholder="Favori bira ara / yaz..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {filteredFavoriteOptions.map((name) => (
                  <button
                    key={`edit-fav-opt-${name}`}
                    type="button"
                    onClick={() => void addFavoriteFromProfile(name)}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                  >
                    {name}
                  </button>
                ))}
                {filteredFavoriteOptions.length === 0 ? (
                  <div className="text-xs opacity-60">Oneri yok, yazarak ekleyebilirsin.</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void addFavoriteFromProfile()}
                className="mt-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
              >
                Yazdigimi favoriye ekle
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Ortalama: {avg.toFixed(2)}⭐</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">{year} log: {checkins.length}</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Takipci: {followers}</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Takip: {following}</div>
        </div>

        {sessionUserId && sessionUserId !== profile.user_id ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void toggleFollow()}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {isFollowing ? "Takibi birak" : "Takip et"}
            </button>
            {followsMe ? <div className="mt-2 text-xs text-amber-200/85">Seni takip ediyor</div> : null}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">Favoriler</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {favorites.map((f) => (
            <div key={f.rank} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
              #{f.rank} {f.beer_name}
            </div>
          ))}
          {!favorites.length ? <div className="text-xs opacity-60">Favori secilmemis.</div> : null}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm opacity-80">Isi haritasi ({year})</div>
          <div className="flex items-center gap-2">
            <select
              value={heatmapMode}
              onChange={(e) => setHeatmapMode(e.target.value as "football" | "grid")}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
            >
              <option value="football">Saha</option>
              <option value="grid">Grid</option>
            </select>
            {heatmapMode === "grid" ? (
              <select
                value={gridCellMetric}
                onChange={(e) => setGridCellMetric(e.target.value as "color" | "count" | "avgRating")}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
              >
                <option value="color">Renk</option>
                <option value="count">Sayi</option>
                <option value="avgRating">Ortalama ⭐</option>
              </select>
            ) : null}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        {heatmapMode === "football" ? (
          <FootballHeatmap year={year} checkins={checkins} onSelectDay={(d) => isOwnProfile && setSelectedDay(d)} />
        ) : (
          <FieldHeatmap
            year={year}
            checkins={checkins}
            onSelectDay={(d) => isOwnProfile && setSelectedDay(d)}
            readOnly={!isOwnProfile}
            cellMetric={gridCellMetric}
          />
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">Son check-in'ler</div>
        <div className="mt-2 space-y-2">
          {checkins.slice(0, 10).map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">{c.beer_name}</div>
                <div className="text-xs">{c.rating === null ? "—" : `${c.rating}⭐`}</div>
              </div>
              <div className="mt-1 text-xs opacity-70">{new Date(c.created_at).toLocaleString("tr-TR")}</div>
              <div className="mt-1 text-xs opacity-70">
                {dayPeriodLabelTr(c.day_period, c.created_at)} / {dayPeriodLabelEn(c.day_period, c.created_at)}
              </div>
              {c.city ? (
                <div className="mt-1 text-xs opacity-80">
                  📍 {c.city}{c.district ? ` / ${c.district}` : ""}{c.location_text ? ` • ${c.location_text}` : ""}
                </div>
              ) : c.location_text ? <div className="mt-1 text-xs opacity-80">📍 {c.location_text}</div> : null}
              {c.price_try !== null && c.price_try !== undefined ? (
                <div className="mt-1 text-xs opacity-80">💸 {Number(c.price_try).toFixed(2)} TL</div>
              ) : null}
              {c.note ? <div className="mt-1 text-xs opacity-70">{c.note}</div> : null}
            </div>
          ))}
          {!checkins.length ? <div className="text-xs opacity-60">Bu yil check-in yok.</div> : null}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">Stereotip rozetler / Stereotype badges</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {stereotypeBadges.map((b) => (
            <div key={b.key} className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <div className="font-semibold">{b.titleTr}</div>
              <div className="opacity-75">{b.titleEn}</div>
            </div>
          ))}
          {!stereotypeBadges.length ? <div className="text-xs opacity-60">Henüz stereotip rozet yok.</div> : null}
        </div>
      </section>

      {isOwnProfile ? (
        <DayModal
          open={selectedDay !== null}
          day={selectedDay ?? ""}
          checkins={dayCheckins}
          beerOptions={beerOptions}
          onClose={() => setSelectedDay(null)}
          onAdd={addCheckinOnDay}
          onDelete={deleteCheckinOnDay}
          onUpdate={updateCheckinOnDay}
        />
      ) : null}
    </main>
  );
}
