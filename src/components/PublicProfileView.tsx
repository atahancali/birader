"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FieldHeatmap from "@/components/FieldHeatmap";
import { supabase } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";

type ProfileRow = {
  user_id: string;
  username: string;
  bio: string;
  is_public: boolean;
};

type CheckinRow = {
  id: string;
  beer_name: string;
  rating: number;
  created_at: string;
};

type FavoriteBeerRow = {
  beer_name: string;
  rank: number;
};

function avgRating(checkins: CheckinRow[]) {
  if (!checkins.length) return 0;
  const sum = checkins.reduce((acc, c) => acc + Number(c.rating || 0), 0);
  return Math.round((sum / checkins.length) * 100) / 100;
}

export default function PublicProfileView({ username }: { username: string }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBeerRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);
  const avg = useMemo(() => avgRating(checkins), [checkins]);

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
        .select("user_id, username, bio, is_public")
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

      const start = new Date(year, 0, 1).toISOString();
      const end = new Date(year + 1, 0, 1).toISOString();

      const [favoritesRes, checkinsRes, followersRes, followingRes] = await Promise.all([
        supabase
          .from("favorite_beers")
          .select("beer_name, rank")
          .eq("user_id", p.user_id)
          .order("rank", { ascending: true }),
        supabase
          .from("checkins")
          .select("id, beer_name, rating, created_at")
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
        const { data: followRow } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", sessionUserId)
          .eq("following_id", p.user_id)
          .maybeSingle();
        setIsFollowing(Boolean(followRow));
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
        <div>
          <div className="text-xs opacity-70">Birader Profil</div>
          <h1 className="text-2xl font-bold">@{profile.username}</h1>
        </div>
        <Link href="/" className="text-xs underline opacity-80">
          Ana sayfa
        </Link>
      </div>

      {profile.bio ? <p className="mt-2 text-sm opacity-80">{profile.bio}</p> : null}

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Ortalama: {avg.toFixed(2)}⭐</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">{year} log: {checkins.length}</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Takipci: {followers}</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">Takip: {following}</div>
        </div>

        {sessionUserId && sessionUserId !== profile.user_id ? (
          <button
            type="button"
            onClick={() => void toggleFollow()}
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
          >
            {isFollowing ? "Takibi birak" : "Takip et"}
          </button>
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
        <div className="text-sm opacity-80">Isi haritasi ({year})</div>
        <FieldHeatmap year={year} checkins={checkins} onSelectDay={() => {}} readOnly />
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">Son check-in'ler</div>
        <div className="mt-2 space-y-2">
          {checkins.slice(0, 10).map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">{c.beer_name}</div>
                <div className="text-xs">{c.rating}⭐</div>
              </div>
              <div className="mt-1 text-xs opacity-70">{new Date(c.created_at).toLocaleString("tr-TR")}</div>
            </div>
          ))}
          {!checkins.length ? <div className="text-xs opacity-60">Bu yil check-in yok.</div> : null}
        </div>
      </section>
    </main>
  );
}
