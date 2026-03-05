"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import FollowsYouBadge from "@/components/FollowsYouBadge";
import LoadingPulse from "@/components/LoadingPulse";
import { useAppLang } from "@/lib/appLang";
import { trackEvent } from "@/lib/analytics";
import { tx } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type RelationProfile = {
  user_id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  is_public?: boolean | null;
};

type FollowRow = { following_id: string };
type FollowerRow = { follower_id: string };

type RelationTab = "following" | "followers";

function visibleName(p: { username: string; display_name?: string | null }) {
  const d = (p.display_name || "").trim();
  return d || `@${p.username}`;
}

export default function ConnectionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useAppLang("tr");

  const [sessionUserId, setSessionUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RelationTab>("following");
  const [busyUserId, setBusyUserId] = useState("");

  const [followingProfiles, setFollowingProfiles] = useState<RelationProfile[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<RelationProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());

  const highlightUserId = useMemo(() => String(searchParams.get("highlight") || ""), [searchParams]);

  const filteredRows = useMemo(() => {
    const rows = tab === "following" ? followingProfiles : followerProfiles;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const uname = String(p.username || "").toLowerCase();
      const dname = String(p.display_name || "").toLowerCase();
      return uname.includes(q) || dname.includes(q);
    });
  }, [followerProfiles, followingProfiles, query, tab]);

  async function loadRelations(userId: string, initial = false) {
    if (!userId) return;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setErrorText("");

    const { data: followingRows, error: followingErr } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (followingErr) {
      setErrorText(followingErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: followerRows, error: followerErr } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", userId);

    if (followerErr) {
      setErrorText(followerErr.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const followingUserIds = ((followingRows as FollowRow[] | null) ?? []).map((r) => r.following_id);
    const followerUserIds = ((followerRows as FollowerRow[] | null) ?? []).map((r) => r.follower_id);
    setFollowingIds(new Set(followingUserIds));
    setFollowerIds(new Set(followerUserIds));

    const [followingProfilesRes, followerProfilesRes] = await Promise.all([
      followingUserIds.length
        ? supabase
            .from("profiles")
            .select("user_id, username, display_name, bio, is_public")
            .in("user_id", followingUserIds)
            .order("username", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      followerUserIds.length
        ? supabase
            .from("profiles")
            .select("user_id, username, display_name, bio, is_public")
            .in("user_id", followerUserIds)
            .order("username", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (followingProfilesRes.error) setErrorText(followingProfilesRes.error.message);
    if (followerProfilesRes.error) setErrorText(followerProfilesRes.error.message);

    setFollowingProfiles(((followingProfilesRes.data as RelationProfile[] | null) ?? []).filter((p) => Boolean(p.user_id)));
    setFollowerProfiles(((followerProfilesRes.data as RelationProfile[] | null) ?? []).filter((p) => Boolean(p.user_id)));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "followers" || nextTab === "following") {
      setTab(nextTab);
      return;
    }
    setTab("following");
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id || "";
      if (!uid) {
        router.replace("/");
        return;
      }
      setSessionUserId(uid);
      void loadRelations(uid, true);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function follow(profile: RelationProfile) {
    if (!sessionUserId || !profile.user_id || busyUserId) return;
    setBusyUserId(profile.user_id);
    const { error } = await supabase.from("follows").insert({
      follower_id: sessionUserId,
      following_id: profile.user_id,
    });
    if (error) {
      setBusyUserId("");
      setErrorText(error.message);
      return;
    }
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: profile.user_id,
      actor_id: sessionUserId,
      type: "follow",
      ref_id: String(profile.user_id),
      payload: { follower_user_id: sessionUserId },
    });
    if (notifErr) setErrorText(notifErr.message);
    trackEvent({ eventName: "follow_created", userId: sessionUserId, props: { target_user_id: profile.user_id } });
    await loadRelations(sessionUserId);
    setBusyUserId("");
  }

  async function unfollow(profile: RelationProfile) {
    if (!sessionUserId || !profile.user_id || busyUserId) return;
    setBusyUserId(profile.user_id);
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", sessionUserId)
      .eq("following_id", profile.user_id);
    if (error) {
      setBusyUserId("");
      setErrorText(error.message);
      return;
    }
    trackEvent({ eventName: "follow_removed", userId: sessionUserId, props: { target_user_id: profile.user_id } });
    await loadRelations(sessionUserId);
    setBusyUserId("");
  }

  if (loading) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
        <LoadingPulse lang={lang} labelTr="Baglantilar yukleniyor..." labelEn="Loading connections..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs opacity-70">{tx(lang, "Sosyal", "Social")}</div>
          <h1 className="text-2xl font-bold">{tx(lang, "Takip ve takipciler", "Following and followers")}</h1>
        </div>
        <Link href="/?section=social" className="text-xs underline opacity-80">
          {tx(lang, "Sosyal panele don", "Back to social")}
        </Link>
      </div>

      {errorText ? (
        <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-100">{errorText}</div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("following")}
          className={`rounded-xl border px-3 py-2 text-left ${
            tab === "following" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
          }`}
        >
          <div className="text-xs opacity-70">{tx(lang, "Takip edilen", "Following")}</div>
          <div className="text-lg font-semibold">{followingProfiles.length}</div>
        </button>
        <button
          type="button"
          onClick={() => setTab("followers")}
          className={`rounded-xl border px-3 py-2 text-left ${
            tab === "followers" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
          }`}
        >
          <div className="text-xs opacity-70">{tx(lang, "Takipci", "Followers")}</div>
          <div className="text-lg font-semibold">{followerProfiles.length}</div>
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tx(lang, "Takipte ara (nick/isim)", "Search (handle/name)")}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => void loadRelations(sessionUserId)}
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
        >
          {refreshing ? "..." : tx(lang, "Yenile", "Refresh")}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {filteredRows.map((p) => {
          const iFollow = followingIds.has(p.user_id);
          const followsMe = followerIds.has(p.user_id);
          const busy = busyUserId === p.user_id;
          return (
            <div
              key={`${tab}-${p.user_id}`}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                highlightUserId === p.user_id
                  ? "border-amber-300/60 bg-amber-500/15 shadow-[0_0_0_1px_rgba(252,211,77,0.2)]"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <div className="min-w-0">
                <Link href={`/u/${p.username}`} className="truncate text-sm underline">
                  {visibleName(p)}
                </Link>
                <div className="truncate text-[11px] opacity-65">@{p.username}</div>
                {followsMe ? <FollowsYouBadge lang={lang} /> : null}
              </div>

              <div className="shrink-0">
                {tab === "following" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void unfollow(p)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {tx(lang, "Takibi birak", "Unfollow")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void (iFollow ? unfollow(p) : follow(p))}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {iFollow ? tx(lang, "Takiptesin", "Following") : tx(lang, "Takip et", "Follow")}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!filteredRows.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs opacity-70">
            {tab === "following"
              ? tx(lang, "Takip edilen listesi bos.", "Following list is empty.")
              : tx(lang, "Takipci listesi bos.", "Followers list is empty.")}
          </div>
        ) : null}
      </div>
    </main>
  );
}

