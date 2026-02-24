"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameFromEmail } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";

type ProfileRow = {
  user_id: string;
  username: string;
  bio: string;
  is_public: boolean;
};

type FavoriteBeerRow = {
  beer_name: string;
  rank: number;
};

type FollowRow = { following_id: string };

type SearchProfile = {
  user_id: string;
  username: string;
  bio: string;
  is_public: boolean;
};

type CheckinRow = {
  beer_name: string;
  rating: number;
};

function averageRating(checkins: CheckinRow[]) {
  if (!checkins.length) return 0;
  const sum = checkins.reduce((acc, c) => acc + Number(c.rating || 0), 0);
  return Math.round((sum / checkins.length) * 100) / 100;
}

function topBeers(checkins: CheckinRow[], limit = 12) {
  const counts: Record<string, number> = {};
  for (const c of checkins) {
    const key = (c.beer_name || "").trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export default function SocialPanel({
  userId,
  sessionEmail,
  allBeerOptions,
}: {
  userId: string;
  sessionEmail?: string | null;
  allBeerOptions: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteBeerRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [addingFavorite, setAddingFavorite] = useState<string>("");

  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingProfiles, setFollowingProfiles] = useState<SearchProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  const fallbackBase = useMemo(() => {
    const fromEmail = usernameFromEmail(sessionEmail);
    if (fromEmail) return fromEmail;
    return `user-${userId.slice(0, 6)}`;
  }, [sessionEmail, userId]);

  const avg = useMemo(() => averageRating(checkins), [checkins]);
  const topBeerOptions = useMemo(() => topBeers(checkins, 16), [checkins]);
  const favoriteOptionPool = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...topBeerOptions, ...allBeerOptions];
    const unique: string[] = [];
    for (const name of merged) {
      const key = name.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
    return unique;
  }, [allBeerOptions, topBeerOptions]);
  const favoriteNames = useMemo(() => new Set(favorites.map((f) => f.beer_name)), [favorites]);

  function markDbError(message: string) {
    if (message.toLowerCase().includes("does not exist")) {
      setDbError("Sosyal tablolar eksik. scripts/sql/social_analytics_schema.sql dosyasini Supabase SQL Editor'de calistir.");
      return;
    }
    setDbError(message);
  }

  async function reserveProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, bio, is_public")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      markDbError(error.message);
      return null;
    }
    if (data) return data as ProfileRow;

    const base = normalizeUsername(fallbackBase) || `user-${userId.slice(0, 6)}`;
    for (let i = 0; i < 24; i += 1) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const { error: insertError } = await supabase.from("profiles").insert({
        user_id: userId,
        username: candidate,
        bio: "",
        is_public: true,
      });

      if (!insertError) {
        trackEvent({ eventName: "profile_created", userId, props: { username: candidate } });
        return {
          user_id: userId,
          username: candidate,
          bio: "",
          is_public: true,
        } as ProfileRow;
      }

      if (!insertError.message.toLowerCase().includes("duplicate")) {
        markDbError(insertError.message);
        return null;
      }
    }

    setDbError("Kullanici adi olusturulamadi. Farkli bir ad dene.");
    return null;
  }

  async function loadFollowing() {
    const { data: rows, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (error) {
      markDbError(error.message);
      return;
    }

    const ids = (rows as FollowRow[] | null)?.map((r) => r.following_id) ?? [];
    setFollowingIds(new Set(ids));

    if (!ids.length) {
      setFollowingProfiles([]);
      return;
    }

    const { data: people, error: peopleError } = await supabase
      .from("profiles")
      .select("user_id, username, bio, is_public")
      .in("user_id", ids)
      .order("username", { ascending: true });

    if (peopleError) {
      markDbError(peopleError.message);
      return;
    }

    setFollowingProfiles((people as SearchProfile[] | null) ?? []);
  }

  async function loadAll() {
    setLoading(true);
    setDbError(null);

    const ensured = await reserveProfile();
    if (!ensured) {
      setLoading(false);
      return;
    }

    setProfile(ensured);
    setUsernameInput(ensured.username);
    setBioInput(ensured.bio || "");
    setIsPublic(ensured.is_public);

    const [favoritesRes, checkinsRes] = await Promise.all([
      supabase
        .from("favorite_beers")
        .select("beer_name, rank")
        .eq("user_id", userId)
        .order("rank", { ascending: true }),
      supabase
        .from("checkins")
        .select("beer_name, rating")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1200),
    ]);

    if (favoritesRes.error) {
      markDbError(favoritesRes.error.message);
    } else {
      setFavorites((favoritesRes.data as FavoriteBeerRow[] | null) ?? []);
    }

    if (checkinsRes.error) {
      markDbError(checkinsRes.error.message);
    } else {
      setCheckins((checkinsRes.data as CheckinRow[] | null) ?? []);
    }

    await loadFollowing();
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveProfile() {
    const nextUsername = normalizeUsername(usernameInput);
    if (!nextUsername) {
      alert("Gecerli bir kullanici adi gir.");
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: nextUsername, bio: bioInput.trim(), is_public: isPublic })
      .eq("user_id", userId);

    setSavingProfile(false);

    if (error) {
      markDbError(error.message);
      if (error.message.toLowerCase().includes("duplicate")) {
        alert("Bu kullanici adi alinmis.");
      }
      return;
    }

    const nextProfile: ProfileRow = {
      user_id: userId,
      username: nextUsername,
      bio: bioInput.trim(),
      is_public: isPublic,
    };

    setProfile(nextProfile);
    setUsernameInput(nextUsername);
    trackEvent({ eventName: "profile_updated", userId, props: { is_public: isPublic } });
  }

  async function addFavorite() {
    const beer = addingFavorite.trim();
    if (!beer) return;
    if (favoriteNames.has(beer)) return;
    if (favorites.length >= 3) {
      alert("En fazla 3 favori ekleyebilirsin.");
      return;
    }

    const usedRanks = new Set(favorites.map((f) => Number(f.rank)));
    let rank = 1;
    while (usedRanks.has(rank) && rank <= 3) rank += 1;

    const { error } = await supabase.from("favorite_beers").insert({
      user_id: userId,
      beer_name: beer,
      rank,
    });

    if (error) {
      markDbError(error.message);
      return;
    }

    setFavorites((prev) => [...prev, { beer_name: beer, rank }].sort((a, b) => a.rank - b.rank));
    setAddingFavorite("");
    trackEvent({ eventName: "favorite_added", userId, props: { beer_name: beer, rank } });
  }

  async function removeFavorite(rank: number) {
    const target = favorites.find((f) => Number(f.rank) === rank);

    const { error } = await supabase
      .from("favorite_beers")
      .delete()
      .eq("user_id", userId)
      .eq("rank", rank);

    if (error) {
      markDbError(error.message);
      return;
    }

    setFavorites((prev) => prev.filter((f) => Number(f.rank) !== rank));
    trackEvent({
      eventName: "favorite_removed",
      userId,
      props: { beer_name: target?.beer_name ?? null, rank },
    });
  }

  async function searchUsers() {
    const q = normalizeUsername(searchQuery);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, bio, is_public")
      .ilike("username", `%${q}%`)
      .neq("user_id", userId)
      .eq("is_public", true)
      .order("username", { ascending: true })
      .limit(12);
    setSearchBusy(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    setSearchResults((data as SearchProfile[] | null) ?? []);
    trackEvent({ eventName: "profile_search", userId, props: { query: q } });
  }

  async function follow(target: SearchProfile) {
    const { error } = await supabase.from("follows").insert({
      follower_id: userId,
      following_id: target.user_id,
    });

    if (error) {
      markDbError(error.message);
      return;
    }

    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.add(target.user_id);
      return next;
    });

    await loadFollowing();
    trackEvent({ eventName: "follow_created", userId, props: { target_user_id: target.user_id } });
  }

  async function unfollow(target: SearchProfile) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", target.user_id);

    if (error) {
      markDbError(error.message);
      return;
    }

    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.delete(target.user_id);
      return next;
    });

    await loadFollowing();
    trackEvent({ eventName: "follow_removed", userId, props: { target_user_id: target.user_id } });
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-70">Sosyal panel yukleniyor...</div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">Sosyal</div>
          <div className="text-lg font-semibold">Profil ve takip</div>
        </div>
        {profile ? (
          <Link className="text-xs underline opacity-80" href={`/u/${profile.username}`}>
            Profilini gor
          </Link>
        ) : null}
      </div>

      {dbError ? (
        <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-100">
          {dbError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Profil ayarlari</div>
          <div className="mt-2 grid gap-2">
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="kullanici adi"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <input
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              placeholder="kisa bio (opsiyonel)"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <label className="flex items-center gap-2 text-xs opacity-80">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Profil herkese acik
            </label>
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {savingProfile ? "Kaydediliyor..." : "Profili kaydet"}
            </button>
          </div>
          <div className="mt-2 text-xs opacity-65">
            Ortalama puan: {avg.toFixed(2)} • Toplam log: {checkins.length}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Favoriler (en fazla 3)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {favorites.map((f) => (
              <button
                key={f.rank}
                type="button"
                onClick={() => removeFavorite(Number(f.rank))}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                title="Kaldir"
              >
                #{f.rank} {f.beer_name} ×
              </button>
            ))}
            {!favorites.length ? <div className="text-xs opacity-60">Henuz favori yok.</div> : null}
          </div>

          <div className="mt-3 flex gap-2">
            <select
              value={addingFavorite}
              onChange={(e) => setAddingFavorite(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            >
              <option value="">Bira sec...</option>
              {favoriteOptionPool
                .filter((name) => !favoriteNames.has(name))
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={addFavorite}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              Ekle
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Kullanici ara ve takip et</div>
          <div className="mt-2 flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchUsers();
                }
              }}
              placeholder="nick ara"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void searchUsers()}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {searchBusy ? "..." : "Ara"}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {searchResults.map((p) => {
              const isFollowing = followingIds.has(p.user_id);
              return (
                <div key={p.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-2">
                  <div className="min-w-0">
                    <Link href={`/u/${p.username}`} className="truncate text-sm underline">
                      @{p.username}
                    </Link>
                    {p.bio ? <div className="truncate text-xs opacity-70">{p.bio}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void (isFollowing ? unfollow(p) : follow(p))}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                  >
                    {isFollowing ? "Takibi birak" : "Takip et"}
                  </button>
                </div>
              );
            })}
            {!searchBusy && searchResults.length === 0 ? (
              <div className="text-xs opacity-60">Arama sonucu yok.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Takip ettiklerin</div>
          <div className="mt-2 space-y-2">
            {followingProfiles.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="min-w-0">
                  <Link href={`/u/${p.username}`} className="truncate text-sm underline">
                    @{p.username}
                  </Link>
                  {p.bio ? <div className="truncate text-xs opacity-70">{p.bio}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void unfollow(p)}
                  className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                >
                  Cikar
                </button>
              </div>
            ))}
            {!followingProfiles.length ? (
              <div className="text-xs opacity-60">Henuz kimseyi takip etmiyorsun.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
