"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameFromEmail } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";

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

type FeedCheckinRow = {
  id: string;
  user_id: string;
  beer_name: string;
  rating: number;
  created_at: string;
};

type FeedItem = FeedCheckinRow & {
  username: string;
};

type FeedWindow = "all" | "24h" | "7d";

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function keyboardNeighborMap() {
  const map = new Map<string, Set<string>>();

  function ensure(ch: string) {
    if (!map.has(ch)) map.set(ch, new Set<string>());
    return map.get(ch)!;
  }

  for (let r = 0; r < KEYBOARD_ROWS.length; r += 1) {
    const row = KEYBOARD_ROWS[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      const bucket = ensure(ch);
      for (let rr = Math.max(0, r - 1); rr <= Math.min(KEYBOARD_ROWS.length - 1, r + 1); rr += 1) {
        const nearRow = KEYBOARD_ROWS[rr];
        for (let cc = Math.max(0, c - 1); cc <= Math.min(nearRow.length - 1, c + 1); cc += 1) {
          const near = nearRow[cc];
          if (near !== ch) bucket.add(near);
        }
      }
    }
  }

  return map;
}

const NEIGHBORS = keyboardNeighborMap();

function substitutionCost(a: string, b: string) {
  if (a === b) return 0;
  const n = NEIGHBORS.get(a);
  if (n?.has(b)) return 0.35;
  return 1;
}

function typoDistance(aRaw: string, bRaw: string) {
  const a = aRaw.toLowerCase();
  const b = bRaw.toLowerCase();
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      const sub = dp[i - 1][j - 1] + substitutionCost(a[i - 1], b[j - 1]);
      dp[i][j] = Math.min(del, ins, sub);
    }
  }

  return dp[a.length][b.length];
}

function averageRating(checkins: CheckinRow[]) {
  if (!checkins.length) return 0;
  const sum = checkins.reduce((acc, c) => acc + Number(c.rating || 0), 0);
  return Math.round((sum / checkins.length) * 100) / 100;
}

function topBeers(checkins: CheckinRow[], limit = 12) {
  const counts: Record<string, number> = {};
  for (const c of checkins) {
    const key = favoriteBeerName(c.beer_name || "");
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
  onQuickLog,
}: {
  userId: string;
  sessionEmail?: string | null;
  allBeerOptions: string[];
  onQuickLog?: (payload: { beerName: string; rating: number }) => void;
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
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [favoriteOpen, setFavoriteOpen] = useState(false);

  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingProfiles, setFollowingProfiles] = useState<SearchProfile[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedWindow, setFeedWindow] = useState<FeedWindow>("7d");
  const [feedMinRating, setFeedMinRating] = useState<number>(0);
  const [feedQuery, setFeedQuery] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const followingIdsRef = useRef<Set<string>>(new Set());
  const followingNameRef = useRef<Map<string, string>>(new Map());

  const fallbackBase = useMemo(() => {
    const fromEmail = usernameFromEmail(sessionEmail);
    if (fromEmail) return fromEmail;
    return `user-${userId.slice(0, 6)}`;
  }, [sessionEmail, userId]);

  const avg = useMemo(() => averageRating(checkins), [checkins]);
  const topBeerOptions = useMemo(() => topBeers(checkins, 16), [checkins]);
  const favoriteOptionPool = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...topBeerOptions, ...allBeerOptions].map((name) => favoriteBeerName(name));
    const unique: string[] = [];
    for (const name of merged) {
      const key = name.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
    return unique;
  }, [allBeerOptions, topBeerOptions]);
  const favoriteNames = useMemo(
    () => new Set(favorites.map((f) => favoriteBeerName(f.beer_name))),
    [favorites]
  );
  const filteredFavoriteOptions = useMemo(() => {
    const q = favoriteQuery.trim().toLowerCase();
    const pool = favoriteOptionPool.filter((name) => !favoriteNames.has(name));
    if (!q) return pool.slice(0, 30);
    return pool.filter((name) => name.toLowerCase().includes(q)).slice(0, 30);
  }, [favoriteNames, favoriteOptionPool, favoriteQuery]);
  const filteredFeedItems = useMemo(() => {
    const query = feedQuery.trim().toLowerCase();
    const now = Date.now();
    const windowMs = feedWindow === "24h" ? 24 * 60 * 60 * 1000 : feedWindow === "7d" ? 7 * 24 * 60 * 60 * 1000 : 0;

    return feedItems.filter((item) => {
      if (feedMinRating > 0 && Number(item.rating || 0) < feedMinRating) return false;
      if (windowMs > 0) {
        const ts = new Date(item.created_at).getTime();
        if (!Number.isFinite(ts) || now - ts > windowMs) return false;
      }
      if (!query) return true;
      return (
        item.username.toLowerCase().includes(query) ||
        item.beer_name.toLowerCase().includes(query)
      );
    });
  }, [feedItems, feedMinRating, feedQuery, feedWindow]);

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

  async function loadFeed(ids: string[]) {
    if (!ids.length) {
      setFeedItems([]);
      return;
    }

    setFeedBusy(true);
    const { data: checkinRows, error: checkinErr } = await supabase
      .from("checkins")
      .select("id, user_id, beer_name, rating, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(40);
    setFeedBusy(false);

    if (checkinErr) {
      markDbError(checkinErr.message);
      return;
    }

    const rows = (checkinRows as FeedCheckinRow[] | null) ?? [];
    if (!rows.length) {
      setFeedItems([]);
      return;
    }

    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", ids);

    if (profileErr) {
      markDbError(profileErr.message);
      return;
    }

    const unameById = new Map<string, string>();
    for (const p of (profileRows as Array<{ user_id: string; username: string }> | null) ?? []) {
      unameById.set(p.user_id, p.username);
    }

    setFeedItems(
      rows.map((r) => ({
        ...r,
        username: unameById.get(r.user_id) ?? "kullanici",
      }))
    );
    trackEvent({ eventName: "feed_loaded", userId, props: { count: rows.length } });
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
    await loadFeed(ids);

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
      const normalized = ((favoritesRes.data as FavoriteBeerRow[] | null) ?? []).map((f) => ({
        ...f,
        beer_name: favoriteBeerName(f.beer_name),
      }));
      setFavorites(normalized);
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

  useEffect(() => {
    followingIdsRef.current = followingIds;
    const nameMap = new Map<string, string>();
    for (const p of followingProfiles) nameMap.set(p.user_id, p.username);
    followingNameRef.current = nameMap;
  }, [followingIds, followingProfiles]);

  useEffect(() => {
    const channel = supabase
      .channel(`social-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id || !followingIdsRef.current.has(row.user_id)) return;
          const username = followingNameRef.current.get(row.user_id) ?? "kullanici";
          setFeedItems((prev) => {
            const next = [{ ...row, username }, ...prev.filter((x) => x.id !== row.id)]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 40);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins" },
        (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id || !followingIdsRef.current.has(row.user_id)) return;
          const username = followingNameRef.current.get(row.user_id) ?? "kullanici";
          setFeedItems((prev) =>
            prev
              .map((x) => (x.id === row.id ? { ...row, username } : x))
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "checkins" },
        (payload) => {
          const oldRow = payload.old as { id?: string; user_id?: string };
          if (!oldRow?.id || !oldRow.user_id || !followingIdsRef.current.has(oldRow.user_id)) return;
          setFeedItems((prev) => prev.filter((x) => x.id !== oldRow.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `follower_id=eq.${userId}`,
        },
        () => {
          void loadFollowing();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
    const beer = favoriteBeerName(addingFavorite.trim());
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
    setFavoriteQuery("");
    setFavoriteOpen(false);
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
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, bio, is_public")
      .neq("user_id", userId)
      .eq("is_public", true)
      .order("username", { ascending: true })
      .limit(300);
    setSearchBusy(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    const rows = (data as SearchProfile[] | null) ?? [];
    const scored = rows
      .map((p) => {
        const uname = normalizeUsername(p.username);
        const dist = typoDistance(q, uname);
        const contains = uname.includes(q);
        const starts = uname.startsWith(q);
        const threshold = Math.max(1.4, Math.floor(q.length / 3));
        return { p, dist, contains, starts, pass: contains || dist <= threshold };
      })
      .filter((x) => x.pass)
      .sort((a, b) => {
        if (a.starts !== b.starts) return a.starts ? -1 : 1;
        if (a.contains !== b.contains) return a.contains ? -1 : 1;
        if (a.dist !== b.dist) return a.dist - b.dist;
        return a.p.username.localeCompare(b.p.username, "tr");
      })
      .slice(0, 12)
      .map((x) => x.p);

    setSearchResults(scored);
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
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">Takip akisi</div>
            <button
              type="button"
              onClick={() => void loadFollowing()}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              Yenile
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <select
              value={feedWindow}
              onChange={(e) => setFeedWindow(e.target.value as FeedWindow)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="all">Tum zaman</option>
              <option value="24h">Son 24s</option>
              <option value="7d">Son 7g</option>
            </select>
            <select
              value={feedMinRating}
              onChange={(e) => setFeedMinRating(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value={0}>Her puan</option>
              <option value={2.5}>2.5⭐+</option>
              <option value={3}>3⭐+</option>
              <option value={3.5}>3.5⭐+</option>
              <option value={4}>4⭐+</option>
            </select>
            <input
              value={feedQuery}
              onChange={(e) => setFeedQuery(e.target.value)}
              placeholder="@kisi / bira"
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            />
          </div>

          <div className="mt-2 space-y-2">
            {filteredFeedItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/u/${item.username}`} className="text-xs underline opacity-80">
                    @{item.username}
                  </Link>
                  <div className="text-xs opacity-70">
                    {new Date(item.created_at).toLocaleString("tr-TR")}
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold">{item.beer_name}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-xs opacity-80">{item.rating}⭐</div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickLog?.({ beerName: item.beer_name, rating: Number(item.rating || 0) });
                      trackEvent({
                        eventName: "feed_quicklog_click",
                        userId,
                        props: { source_user_id: item.user_id, beer_name: item.beer_name },
                      });
                    }}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                  >
                    Bunu da logla
                  </button>
                </div>
              </div>
            ))}

            {feedBusy ? <div className="text-xs opacity-60">Akis yukleniyor...</div> : null}
            {!feedBusy && !filteredFeedItems.length ? (
              <div className="text-xs opacity-60">Takip akisinda gosterilecek log yok.</div>
            ) : null}
          </div>
        </div>

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

          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
            <div className="relative">
              <input
                value={favoriteQuery}
                onChange={(e) => {
                  setFavoriteQuery(e.target.value);
                  setFavoriteOpen(true);
                }}
                onFocus={() => setFavoriteOpen(true)}
                placeholder="Favori bira ara..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setFavoriteOpen((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
              >
                {favoriteOpen ? "Kapat" : "Ac"}
              </button>
            </div>

            {favoriteOpen ? (
              <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-black/40 p-1">
                {filteredFavoriteOptions.length === 0 ? (
                  <div className="px-2 py-2 text-xs opacity-60">Sonuc yok.</div>
                ) : (
                  filteredFavoriteOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setAddingFavorite(name);
                        setFavoriteQuery(name);
                        setFavoriteOpen(false);
                      }}
                      className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10 ${
                        addingFavorite === name ? "bg-white/10" : ""
                      }`}
                    >
                      {name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="truncate text-xs opacity-70">
                Secili: <span className="opacity-90">{addingFavorite || "—"}</span>
              </div>
              <button
                type="button"
                onClick={addFavorite}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
              >
                Ekle
              </button>
            </div>
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
