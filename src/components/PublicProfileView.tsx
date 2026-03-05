"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import FootballHeatmap from "@/components/FootballHeatmap";
import FieldHeatmap from "@/components/FieldHeatmap";
import DayModal from "@/components/DayModal";
import LoadingPulse from "@/components/LoadingPulse";
import RatingStars from "@/components/RatingStars";
import FollowsYouBadge from "@/components/FollowsYouBadge";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameFromEmail } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";
import { prepareAvatarUpload } from "@/lib/avatar";
import { dayPeriodLabelEn, dayPeriodLabelTr, type DayPeriod } from "@/lib/dayPeriod";
import { HEATMAP_PALETTES } from "@/lib/heatmapTheme";
import { badgeMetaForKey } from "@/lib/badgeMeta";
import { useAppLang } from "@/lib/appLang";
import { tx } from "@/lib/i18n";

type ProfileRow = {
  user_id: string;
  username: string;
  handle?: string | null;
  login_username?: string | null;
  display_name?: string | null;
  bio: string;
  is_public: boolean;
  avatar_path?: string | null;
  heatmap_color_from?: string | null;
  heatmap_color_to?: string | null;
  heatmap_mode?: HeatmapMode | null;
  heatmap_cell_metric?: GridCellMetric | null;
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
  media_url?: string | null;
  media_type?: string | null;
};

type FavoriteBeerRow = {
  beer_name: string;
  rank: number;
};
type HeatmapMode = "football" | "grid";
type GridCellMetric = "color" | "count" | "avgRating";
type UserBadgeRow = {
  badge_key: string;
  title_tr: string;
  title_en: string;
  detail_tr: string;
  detail_en: string;
  score: number;
  computed_at: string;
};

type DeletedCheckinUndo = {
  id: string;
  beer_name: string;
};

type BeerResolveOutcome = {
  canonicalName: string;
  matched: boolean;
  queued: boolean;
};

type IdentityHistoryRow = {
  id: number;
  user_id: string;
  old_username?: string | null;
  new_username?: string | null;
  old_handle?: string | null;
  new_handle?: string | null;
  old_login_username?: string | null;
  new_login_username?: string | null;
  old_display_name?: string | null;
  new_display_name?: string | null;
  source?: string | null;
  created_at: string;
};

const CHECKINS_SELECT_WITH_MEDIA =
  "id, beer_name, rating, created_at, day_period, city, district, location_text, price_try, note, media_url, media_type";
const CHECKINS_SELECT_BASE =
  "id, beer_name, rating, created_at, day_period, city, district, location_text, price_try, note";
const CUSTOM_GRID_THEME_VALUE = "__birader-custom-theme__";

function isMissingMediaColumnError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") && (msg.includes("media_url") || msg.includes("media_type"));
}

function looksLikeEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

function avgRating(checkins: CheckinRow[]) {
  const rated = checkins.filter((c) => c.rating !== null && c.rating !== undefined && Number(c.rating) > 0);
  if (!rated.length) return 0;
  const sum = rated.reduce((acc, c) => acc + Number(c.rating ?? 0), 0);
  return Math.round((sum / rated.length) * 100) / 100;
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isFutureIsoDay(dayIso: string, todayIso = isoTodayLocal()) {
  const normalized = String(dayIso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  return normalized > todayIso;
}

function isFavoriteLimitExceededError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("favorite_limit_exceeded");
}

function isMissingRpcFunctionError(error: any, fnName: string) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("function") && msg.includes(fnName.toLowerCase()) && msg.includes("does not exist");
}

function isMissingColumnError(error: any, columnName: string) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") && msg.includes(String(columnName || "").toLowerCase());
}

function parseHeatmapMode(value: unknown): HeatmapMode | null {
  if (value === "football" || value === "grid") return value;
  return null;
}

function parseGridCellMetric(value: unknown): GridCellMetric | null {
  if (value === "color" || value === "count" || value === "avgRating") return value;
  return null;
}

export default function PublicProfileView({ username }: { username: string }) {
  const router = useRouter();
  const { lang, setLang } = useAppLang("tr");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState("");
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
  const [editUsername, setEditUsername] = useState("");
  const [editLoginEmail, setEditLoginEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [identityHistory, setIdentityHistory] = useState<IdentityHistoryRow[]>([]);
  const [identityHistoryLoading, setIdentityHistoryLoading] = useState(false);
  const [dbBadges, setDbBadges] = useState<UserBadgeRow[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("football");
  const [gridCellMetric, setGridCellMetric] = useState<GridCellMetric>("color");
  const [gridColorFrom, setGridColorFrom] = useState<string>("#f59e0b");
  const [gridColorTo, setGridColorTo] = useState<string>("#ef4444");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pendingUndoCheckin, setPendingUndoCheckin] = useState<DeletedCheckinUndo | null>(null);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState(currentYear);
  const avg = useMemo(() => avgRating(checkins), [checkins]);
  const stereotypeBadges = dbBadges;
  const isOwnProfile = sessionUserId === profile?.user_id;
  const selectedGridPaletteValue = useMemo(() => {
    const from = gridColorFrom.trim().toLowerCase();
    const to = gridColorTo.trim().toLowerCase();
    const preset = HEATMAP_PALETTES.find(
      (p) => p.from.toLowerCase() === from && p.to.toLowerCase() === to
    );
    return preset ? `${preset.from}|${preset.to}` : CUSTOM_GRID_THEME_VALUE;
  }, [gridColorFrom, gridColorTo]);
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
  const shownHandle = useMemo(
    () => (profile?.handle || profile?.username || "").trim(),
    [profile?.handle, profile?.username]
  );
  const shownLoginUsername = useMemo(
    () =>
      (profile?.login_username || "").trim() ||
      usernameFromEmail(sessionEmail || "") ||
      shownHandle,
    [profile?.login_username, sessionEmail, shownHandle]
  );
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
  const knownBeerNamesLower = useMemo(
    () => new Set(beerOptions.map((name) => name.trim().toLowerCase())),
    [beerOptions]
  );

  async function fetchYearCheckins(userId: string, yearValue: number) {
    const start = `${yearValue}-01-01T00:00:00.000Z`;
    const end = `${yearValue + 1}-01-01T00:00:00.000Z`;
    const withMedia = await supabase
      .from("checkins")
      .select(CHECKINS_SELECT_WITH_MEDIA)
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (!withMedia.error) return { data: (withMedia.data as CheckinRow[] | null) ?? [], error: null as any };
    if (!isMissingMediaColumnError(withMedia.error)) return { data: [] as CheckinRow[], error: withMedia.error };
    const fallback = await supabase
      .from("checkins")
      .select(CHECKINS_SELECT_BASE)
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    return {
      data: (((fallback.data as any[] | null) ?? []).map((c) => ({ ...c, media_url: null, media_type: null })) as CheckinRow[]),
      error: fallback.error,
    };
  }

  async function loadBadgesForUser(userId: string) {
    const { data } = await supabase
      .from("user_badges")
      .select("badge_key, title_tr, title_en, detail_tr, detail_en, score, computed_at")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .order("computed_at", { ascending: false })
      .limit(8);
    setDbBadges((data as UserBadgeRow[] | null) ?? []);
  }

  async function loadProfileRowByUserId(userId: string) {
    const withIdentity = await supabase
      .from("profiles")
      .select(
        "user_id, username, handle, login_username, display_name, bio, is_public, avatar_path, heatmap_color_from, heatmap_color_to, heatmap_mode, heatmap_cell_metric"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (!withIdentity.error) return { data: withIdentity.data as ProfileRow | null, error: null as any };

    const withTheme = await supabase
      .from("profiles")
      .select(
        "user_id, username, display_name, bio, is_public, avatar_path, heatmap_color_from, heatmap_color_to, heatmap_mode, heatmap_cell_metric"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (!withTheme.error) {
      const row = withTheme.data
        ? ({
            ...(withTheme.data as any),
            handle: (withTheme.data as any)?.username ?? null,
            login_username: usernameFromEmail(sessionEmail || "") || (withTheme.data as any)?.username || null,
          } as ProfileRow)
        : null;
      return { data: row, error: null as any };
    }
    return { data: null as ProfileRow | null, error: withTheme.error };
  }

  async function loadIdentityHistoryForUser(userId: string) {
    setIdentityHistoryLoading(true);
    try {
      const viaRpc = await supabase.rpc("get_my_identity_history", { p_limit: 20 });
      if (!viaRpc.error) {
        setIdentityHistory((viaRpc.data as IdentityHistoryRow[] | null) ?? []);
        return;
      }
      if (!isMissingRpcFunctionError(viaRpc.error, "get_my_identity_history")) {
        console.error(viaRpc.error);
      }

      const withIdentityCols = await supabase
        .from("profile_identity_history")
        .select(
          "id, user_id, old_username, new_username, old_handle, new_handle, old_login_username, new_login_username, old_display_name, new_display_name, source, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!withIdentityCols.error) {
        setIdentityHistory((withIdentityCols.data as IdentityHistoryRow[] | null) ?? []);
        return;
      }

      if (
        !isMissingColumnError(withIdentityCols.error, "old_handle") &&
        !isMissingColumnError(withIdentityCols.error, "old_login_username")
      ) {
        console.error(withIdentityCols.error);
      }

      const fallback = await supabase
        .from("profile_identity_history")
        .select("id, user_id, old_username, new_username, old_display_name, new_display_name, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!fallback.error) {
        setIdentityHistory((fallback.data as IdentityHistoryRow[] | null) ?? []);
      }
    } finally {
      setIdentityHistoryLoading(false);
    }
  }

  function avatarPublicUrl(path?: string | null) {
    const clean = (path || "").trim();
    if (!clean) return "";
    const { data } = supabase.storage.from("avatars").getPublicUrl(clean);
    return data.publicUrl;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null);
      setSessionEmail((data.session?.user?.email || "").trim().toLowerCase());
    });
  }, []);

  useEffect(() => {
    if (!pendingUndoCheckin) return;
    const timer = setTimeout(() => setPendingUndoCheckin(null), 15_000);
    return () => clearTimeout(timer);
  }, [pendingUndoCheckin]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorText(null);

      const normalized = normalizeUsername(username);
      let row: ProfileRow | null = null;
      let error: any = null;
      const withIdentity = await supabase
        .from("profiles")
        .select(
          "user_id, username, handle, login_username, display_name, bio, is_public, avatar_path, heatmap_color_from, heatmap_color_to, heatmap_mode, heatmap_cell_metric"
        )
        .eq("username", normalized)
        .maybeSingle();
      if (!withIdentity.error) {
        row = withIdentity.data as ProfileRow | null;
      } else {
        const fallback = await supabase
          .from("profiles")
          .select(
            "user_id, username, display_name, bio, is_public, avatar_path, heatmap_color_from, heatmap_color_to, heatmap_mode, heatmap_cell_metric"
          )
          .eq("username", normalized)
          .maybeSingle();
        row = fallback.data
          ? ({
              ...(fallback.data as any),
              handle: (fallback.data as any)?.username ?? null,
              login_username: usernameFromEmail(sessionEmail || "") || (fallback.data as any)?.username || null,
            } as ProfileRow)
          : null;
        error = fallback.error;
      }

      // Resolve stale handle via identity history (public redirects keep working after rename).
      if (!row && !error) {
        const histRes = await supabase
          .from("profile_identity_history")
          .select("user_id, new_username")
          .eq("old_username", normalized)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!histRes.error && histRes.data?.user_id) {
          const byUser = await loadProfileRowByUserId(String(histRes.data.user_id));
          if (!byUser.error && byUser.data) row = byUser.data;
        }
      }

      // If URL username is stale or missing, allow own profile fallback by user_id.
      if (!row && !error && sessionUserId) {
        const own = await loadProfileRowByUserId(sessionUserId);
        if (!own.error && own.data) row = own.data;
      }

      // If user has no profile row yet, bootstrap from current session and continue.
      if (!row && !error && sessionUserId) {
        const emailUser = usernameFromEmail(sessionEmail) || normalized || `user-${sessionUserId.slice(0, 6)}`;
        const boot = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: sessionUserId,
              username: emailUser,
              display_name: emailUser,
              bio: "",
              is_public: true,
            },
            { onConflict: "user_id" }
          );
        if (!boot.error) {
          const ownCreated = await loadProfileRowByUserId(sessionUserId);
          if (!ownCreated.error && ownCreated.data) row = ownCreated.data;
        }
      }

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
      const resolvedHandle = (p.handle || p.username || "").trim();
      if (resolvedHandle && normalizeUsername(resolvedHandle) !== normalized) {
        router.replace(`/u/${encodeURIComponent(resolvedHandle)}`);
      }
      if (!p.is_public && sessionUserId !== p.user_id) {
        setErrorText("Bu profil gizli.");
        setLoading(false);
        return;
      }

      setProfile({
        ...p,
        handle: resolvedHandle || p.username,
        login_username: (p.login_username || "").trim() || usernameFromEmail(sessionEmail || "") || resolvedHandle || p.username,
      });
      setEditUsername(resolvedHandle || p.username);
      if (p.heatmap_color_from) setGridColorFrom(p.heatmap_color_from);
      if (p.heatmap_color_to) setGridColorTo(p.heatmap_color_to);
      {
        const mode = parseHeatmapMode(p.heatmap_mode);
        if (mode) setHeatmapMode(mode);
      }
      {
        const metric = parseGridCellMetric(p.heatmap_cell_metric);
        if (metric) setGridCellMetric(metric);
      }
      setEditDisplayName((p.display_name || "").trim() || resolvedHandle || p.username);
      setEditBio(p.bio || "");
      setEditIsPublic(p.is_public);
      setEditLoginEmail(sessionEmail || "");
      if (sessionUserId === p.user_id) void loadIdentityHistoryForUser(p.user_id);
      else setIdentityHistory([]);

      const [favoritesRes, checkinsRes, followersRes, followingRes, badgesRes] = await Promise.all([
        supabase
          .from("favorite_beers")
          .select("beer_name, rank")
          .eq("user_id", p.user_id)
          .order("rank", { ascending: true }),
        fetchYearCheckins(p.user_id, year),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", p.user_id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", p.user_id),
        supabase
          .from("user_badges")
          .select("badge_key, title_tr, title_en, detail_tr, detail_en, score, computed_at")
          .eq("user_id", p.user_id)
          .order("score", { ascending: false })
          .order("computed_at", { ascending: false })
          .limit(8),
      ]);

      if (favoritesRes.error) setErrorText(favoritesRes.error.message);
      if ((checkinsRes as any).error) setErrorText((checkinsRes as any).error.message);
      if (followersRes.error) setErrorText(followersRes.error.message);
      if (followingRes.error) setErrorText(followingRes.error.message);
      if (badgesRes.error) setErrorText(badgesRes.error.message);

      setFavorites((favoritesRes.data as FavoriteBeerRow[] | null) ?? []);
      setCheckins(((checkinsRes as any).data as CheckinRow[] | null) ?? []);
      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);
      setDbBadges((badgesRes.data as UserBadgeRow[] | null) ?? []);

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
  }, [sessionEmail, sessionUserId, username, year]);

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

  async function saveHeatmapPrefs(nextMode: HeatmapMode, nextMetric: GridCellMetric) {
    if (!profile || !isOwnProfile || !sessionUserId) return;
    const withPrefs = await supabase
      .from("profiles")
      .update({ heatmap_mode: nextMode, heatmap_cell_metric: nextMetric })
      .eq("user_id", sessionUserId);
    if (withPrefs.error) {
      const msg = String(withPrefs.error.message || "").toLowerCase();
      if (!(msg.includes("does not exist") && (msg.includes("heatmap_mode") || msg.includes("heatmap_cell_metric")))) {
        console.error(withPrefs.error);
      }
      return;
    }
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            heatmap_mode: nextMode,
            heatmap_cell_metric: nextMetric,
          }
        : prev
    );
  }

  async function saveOwnProfile() {
    if (!profile || !isOwnProfile || !sessionUserId) return;
    const currentHandle = (profile.handle || profile.username || "").trim();
    const nextHandle = normalizeUsername(editUsername || "");
    const rawDisplayName = (editDisplayName || "").trim().slice(0, 32);
    const normalizedRawDisplay = normalizeUsername(rawDisplayName.replace(/^@+/, ""));
    const shouldSyncDisplayWithHandle = !rawDisplayName || normalizedRawDisplay === normalizeUsername(currentHandle);
    const nextDisplayName = shouldSyncDisplayWithHandle ? nextHandle : rawDisplayName;
    const nextBio = (editBio || "").trim();
    const currentEmail = (sessionEmail || "").trim().toLowerCase();
    const typedEmail = (editLoginEmail || "").trim().toLowerCase();
    const targetEmail = typedEmail || currentEmail;
    let finalEmail = currentEmail;

    if (nextHandle.length < 3) {
      alert(tx(lang, "Profil handle en az 3 karakter olmali.", "Profile handle must be at least 3 characters."));
      return;
    }
    if (typedEmail && !looksLikeEmail(typedEmail)) {
      alert(tx(lang, "Gecerli bir e-posta gir.", "Enter a valid e-mail."));
      return;
    }

    if (nextHandle !== normalizeUsername(currentHandle)) {
      const { data: takenRow, error: takenErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", nextHandle)
        .maybeSingle();
      if (takenErr) {
        alert(takenErr.message);
        return;
      }
      if (takenRow && String((takenRow as any).user_id || "") !== sessionUserId) {
        alert(tx(lang, "Bu handle zaten kullaniliyor.", "This handle is already in use."));
        return;
      }
    }

    setSavingProfile(true);
    if (targetEmail && targetEmail !== currentEmail) {
      const { data: authData, error: authErr } = await supabase.auth.updateUser({ email: targetEmail });
      if (authErr) {
        setSavingProfile(false);
        alert(authErr.message);
        return;
      }
      finalEmail = (authData.user?.email || targetEmail).trim().toLowerCase();
      setSessionEmail(finalEmail);
    }

    const nextLoginUsername =
      usernameFromEmail(finalEmail) ||
      (profile.login_username || "").trim() ||
      nextHandle;

    let error: any = null;
    const withTheme = await supabase
      .from("profiles")
      .update({
        username: nextHandle,
        handle: nextHandle,
        login_username: nextLoginUsername,
        display_name: nextDisplayName || nextHandle,
        bio: nextBio,
        is_public: editIsPublic,
        heatmap_color_from: gridColorFrom,
        heatmap_color_to: gridColorTo,
        heatmap_mode: heatmapMode,
        heatmap_cell_metric: gridCellMetric,
      })
      .eq("user_id", sessionUserId);
    if (!withTheme.error) {
      error = null;
    } else {
      const fallback = await supabase
        .from("profiles")
        .update({
          username: nextHandle,
          display_name: nextDisplayName || nextHandle,
          bio: nextBio,
          is_public: editIsPublic,
        })
        .eq("user_id", sessionUserId);
      error = fallback.error;
    }
    if (error) {
      setSavingProfile(false);
      alert(error.message);
      return;
    }

    setSavingProfile(false);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            username: nextHandle,
            handle: nextHandle,
            login_username: nextLoginUsername,
            display_name: nextDisplayName || nextHandle,
            bio: nextBio,
            is_public: editIsPublic,
            heatmap_color_from: gridColorFrom,
            heatmap_color_to: gridColorTo,
            heatmap_mode: heatmapMode,
            heatmap_cell_metric: gridCellMetric,
          }
        : prev
    );
    setEditUsername(nextHandle);
    setEditDisplayName(nextDisplayName || nextHandle);
    setEditBio(nextBio);
    setEditLoginEmail(finalEmail || "");
    await loadIdentityHistoryForUser(sessionUserId);
    setEditOpen(false);
    if (nextHandle !== normalizeUsername(currentHandle)) {
      router.replace(`/u/${encodeURIComponent(nextHandle)}`);
    }
  }

  async function onAvatarFileChange(file?: File) {
    if (!file || !sessionUserId || !isOwnProfile) return;
    const prepared = await prepareAvatarUpload(file);
    if (!prepared.ok) {
      alert(lang === "en" ? prepared.errorEn : prepared.errorTr);
      return;
    }
    try {
      setAvatarUploading(true);
      const uploadPath = `${sessionUserId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(uploadPath, prepared.blob, { upsert: true, contentType: "image/jpeg" });
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
      const queueRes = await supabase.rpc("queue_avatar_moderation", {
        p_avatar_path: uploadPath,
        p_flags: prepared.moderationFlags as any,
      });
      if (queueRes.error && !isMissingRpcFunctionError(queueRes.error, "queue_avatar_moderation")) {
        console.error("queue_avatar_moderation failed:", queueRes.error.message);
      }
      setProfile((prev) => (prev ? { ...prev, avatar_path: uploadPath } : prev));
      trackEvent({ eventName: "avatar_uploaded", userId: sessionUserId, props: { path: uploadPath } });
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
      if (isFavoriteLimitExceededError(error)) {
        alert("En fazla 3 favori ekleyebilirsin.");
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

  async function resolveBeerNameForProfileInsert(
    rawBeer: string,
    context: Record<string, unknown> = {}
  ): Promise<BeerResolveOutcome> {
    const raw = String(rawBeer || "").trim();
    if (!raw) return { canonicalName: "", matched: false, queued: false };

    const { data, error } = await supabase.rpc("resolve_beer_name", { p_input: raw });
    if (error) {
      if (!isMissingRpcFunctionError(error, "resolve_beer_name")) {
        console.error("resolve_beer_name failed:", error.message);
      }
      return {
        canonicalName: raw,
        matched: knownBeerNamesLower.has(raw.toLowerCase()),
        queued: false,
      };
    }

    const row = Array.isArray(data)
      ? (data[0] as { canonical_name?: string | null; matched?: boolean } | undefined)
      : undefined;
    const canonicalName = String(row?.canonical_name || raw).trim() || raw;
    const matched = Boolean(row?.matched);

    if (matched || !sessionUserId) {
      return { canonicalName, matched, queued: false };
    }

    const { data: queuedId, error: queueError } = await supabase.rpc("queue_custom_beer_name", {
      p_raw: raw,
      p_context: {
        source: "profile_day_modal",
        lang,
        ...context,
      } as any,
    });
    if (queueError) {
      if (!isMissingRpcFunctionError(queueError, "queue_custom_beer_name")) {
        console.error("queue_custom_beer_name failed:", queueError.message);
      }
      return { canonicalName, matched: false, queued: false };
    }

    return {
      canonicalName,
      matched: false,
      queued: queuedId !== null && queuedId !== undefined,
    };
  }

  async function addCheckinOnDay(payload: { day: string; beer_name: string; rating: number | null }) {
    if (!sessionUserId || !isOwnProfile) return;
    if (isFutureIsoDay(payload.day, isoTodayLocal())) {
      alert(tx(lang, "Bugunden sonraki tarihe log atilamaz.", "You cannot log a future date."));
      return;
    }
    const rawBeer = payload.beer_name.trim();
    if (!rawBeer) return;
    const resolved = await resolveBeerNameForProfileInsert(rawBeer, {
      day: payload.day,
      year,
    });
    const canonicalBeerName = String(resolved.canonicalName || rawBeer).trim() || rawBeer;
    const created_at = new Date(`${payload.day}T12:00:00.000Z`).toISOString();
    const { error } = await supabase.from("checkins").insert({
      user_id: sessionUserId,
      beer_name: canonicalBeerName,
      rating: payload.rating,
      created_at,
      day_period: "evening",
    });
    if (error) {
      alert(error.message);
      return;
    }
    const refreshed = await fetchYearCheckins(sessionUserId, year);
    setCheckins((refreshed.data as CheckinRow[] | null) ?? []);
    await supabase.rpc("refresh_my_badges");
    await loadBadgesForUser(sessionUserId);
    if (resolved.queued) {
      alert(
        tx(
          lang,
          "Listede olmayan bira adi inceleme sirasina alindi.",
          "Unknown beer name was sent to moderation review."
        )
      );
    }
  }

  async function deleteCheckinOnDay(id: string) {
    if (!sessionUserId || !isOwnProfile) return;
    const deleted = checkins.find((c) => String(c.id) === String(id));
    const { data, error } = await supabase.rpc("delete_own_checkin", { p_id: String(id) });
    if (error || data !== true) {
      alert(error?.message || "Kayit bulunamadi.");
      return;
    }
    setCheckins((prev) => prev.filter((c) => c.id !== id));
    setPendingUndoCheckin({
      id: String(id),
      beer_name: deleted?.beer_name || tx(lang, "Bilinmeyen bira", "Unknown beer"),
    });
    await supabase.rpc("refresh_my_badges");
    await loadBadgesForUser(sessionUserId);
  }

  async function undoDeletedCheckinOnProfile() {
    if (!sessionUserId || !isOwnProfile || !pendingUndoCheckin) return;
    const { data, error } = await supabase.rpc("undo_delete_own_checkin", { p_id: String(pendingUndoCheckin.id) });
    if (error || data !== true) {
      alert(
        tx(
          lang,
          "Geri alma suresi dolmus olabilir veya kayit bulunamadi.",
          "Undo window may be over or the record was not found."
        )
      );
      setPendingUndoCheckin(null);
      return;
    }
    const refreshed = await fetchYearCheckins(sessionUserId, year);
    setCheckins((refreshed.data as CheckinRow[] | null) ?? []);
    await supabase.rpc("refresh_my_badges");
    await loadBadgesForUser(sessionUserId);
    setPendingUndoCheckin(null);
  }

  async function updateCheckinOnDay(payload: { id: string; beer_name: string; rating: number | null }) {
    if (!sessionUserId || !isOwnProfile) return;
    const rawBeer = payload.beer_name.trim();
    if (!rawBeer) return;
    const resolved = await resolveBeerNameForProfileInsert(rawBeer, {
      source: "profile_day_modal_edit",
      checkin_id: payload.id,
      year,
    });
    const canonicalBeerName = String(resolved.canonicalName || rawBeer).trim() || rawBeer;
    const { error } = await supabase
      .from("checkins")
      .update({ beer_name: canonicalBeerName, rating: payload.rating })
      .eq("id", payload.id)
      .eq("user_id", sessionUserId);
    if (error) {
      alert(error.message);
      return;
    }
    setCheckins((prev) =>
      prev.map((c) => (c.id === payload.id ? { ...c, beer_name: canonicalBeerName, rating: payload.rating } : c))
    );
    await supabase.rpc("refresh_my_badges");
    await loadBadgesForUser(sessionUserId);
    if (resolved.queued) {
      alert(
        tx(
          lang,
          "Listede olmayan bira adi inceleme sirasina alindi.",
          "Unknown beer name was sent to moderation review."
        )
      );
    }
  }

  async function deleteOwnAccount() {
    if (!sessionUserId || !isOwnProfile || deletingAccount) return;
    setDeletingAccount(true);
    const { data, error } = await supabase.rpc("delete_my_account");
    if (error || data !== true) {
      setDeletingAccount(false);
      alert(error?.message || "Hesap silme islemi basarisiz.");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/?account_deleted=1");
  }

  if (loading) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
        <LoadingPulse lang={lang} labelTr="Profil yukleniyor..." labelEn="Loading profile..." />
      </main>
    );
  }

  if (errorText || !profile) {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
        <Link href="/" className="text-xs underline opacity-80">
          {tx(lang, "Ana sayfaya don", "Back to home")}
        </Link>
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm">
          {errorText ?? "Profil bulunamadi."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-black/30">
            {profile.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPublicUrl(profile.avatar_path)}
                alt={`${shownHandle} avatar`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
          <div className="text-xs opacity-70">{tx(lang, "Birader Profil", "Birader Profile")}</div>
          <h1 className="text-2xl font-bold">{shownName}</h1>
          <div className="text-xs opacity-70">@{shownHandle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              {editOpen ? tx(lang, "Kapat", "Close") : tx(lang, "Edit profile", "Edit profile")}
            </button>
          ) : null}
          <Link href="/" className="text-xs underline opacity-80">
            {tx(lang, "Ana sayfa", "Home")}
          </Link>
        </div>
      </div>

      {profile.bio ? <p className="mt-2 text-sm opacity-80">{profile.bio}</p> : null}

      {isOwnProfile && pendingUndoCheckin ? (
        <section className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <div className="truncate">
                {tx(lang, "Log silindi:", "Log deleted:")} <span className="font-semibold">{pendingUndoCheckin.beer_name}</span>
              </div>
              <div className="text-xs opacity-75">
                {tx(lang, "15 saniye icinde geri alabilirsin.", "You can undo within 15 seconds.")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void undoDeletedCheckinOnProfile()}
                className="rounded-xl border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100"
              >
                {tx(lang, "Geri al", "Undo")}
              </button>
              <button
                type="button"
                onClick={() => setPendingUndoCheckin(null)}
                className="rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-xs"
              >
                ×
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isOwnProfile && editOpen ? (
        <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm opacity-80">{tx(lang, "Profil ayarlari", "Profile settings")}</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-black/30">
              {profile.avatar_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPublicUrl(profile.avatar_path)} alt="avatar" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <label className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs cursor-pointer">
              {avatarUploading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-white/30 border-t-amber-300 animate-spin" />
                  {tx(lang, "Aktariliyor...", "Uploading...")}
                </span>
              ) : (
                tx(lang, "Avatar yukle", "Upload avatar")
              )}
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
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              maxLength={24}
              placeholder={tx(lang, "profil handle (benzersiz)", "profile handle (unique)")}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <input
              value={editLoginEmail}
              onChange={(e) => setEditLoginEmail(e.target.value)}
              placeholder={tx(lang, "login e-posta", "login e-mail")}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <div className="text-[11px] opacity-65">
              {tx(
                lang,
                "E-posta degisimi Supabase tarafinda dogrulama isteyebilir.",
                "E-mail change may require confirmation on Supabase side."
              )}
            </div>
            <div className="text-[11px] opacity-70">
              {tx(lang, "Giris kullanici adi", "Login username")}: <span className="font-semibold">@{shownLoginUsername}</span>
            </div>
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              maxLength={32}
              placeholder={tx(lang, "gorunen nick", "display nick")}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <input
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder={tx(lang, "kisa bio (opsiyonel)", "short bio (optional)")}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <label className="flex items-center gap-2 text-xs opacity-80">
              <input
                type="checkbox"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
              />
              {tx(lang, "Profil herkese acik", "Public profile")}
            </label>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="text-xs opacity-70">{tx(lang, "Grid renk gecisi", "Grid color gradient")}</div>
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={selectedGridPaletteValue}
                  onChange={(e) => {
                    const raw = String(e.target.value || "");
                    if (raw === CUSTOM_GRID_THEME_VALUE) return;
                    const [from, to] = raw.split("|");
                    if (!from || !to) return;
                    setGridColorFrom(from);
                    setGridColorTo(to);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                >
                  {HEATMAP_PALETTES.map((p) => (
                    <option key={`profile-theme-${p.key}`} value={`${p.from}|${p.to}`}>
                      {p.label}
                    </option>
                  ))}
                  <option value={CUSTOM_GRID_THEME_VALUE}>{tx(lang, "Birader Atolye (Ozel)", "Birader Atelier (Custom)")}</option>
                </select>
                {selectedGridPaletteValue === CUSTOM_GRID_THEME_VALUE ? (
                  <>
                    <input
                      type="color"
                      value={gridColorFrom}
                      onChange={(e) => setGridColorFrom(e.target.value)}
                      className="h-8 w-8 rounded border border-white/20 bg-black/20 p-0.5"
                    />
                    <input
                      type="color"
                      value={gridColorTo}
                      onChange={(e) => setGridColorTo(e.target.value)}
                      className="h-8 w-8 rounded border border-white/20 bg-black/20 p-0.5"
                    />
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveOwnProfile()}
              disabled={savingProfile}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {savingProfile ? tx(lang, "Kaydediliyor...", "Saving...") : tx(lang, "Profili kaydet", "Save profile")}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">{tx(lang, "Nick degisim gecmisi", "Handle change history")}</div>
            {identityHistoryLoading ? (
              <div className="mt-2 text-xs opacity-60">{tx(lang, "Yukleniyor...", "Loading...")}</div>
            ) : identityHistory.length ? (
              <div className="mt-2 space-y-2">
                {identityHistory.slice(0, 8).map((h) => {
                  const oldHandle = (h.old_handle || h.old_username || "").trim();
                  const newHandle = (h.new_handle || h.new_username || "").trim();
                  const oldDisplay = (h.old_display_name || "").trim();
                  const newDisplay = (h.new_display_name || "").trim();
                  const oldLogin = (h.old_login_username || "").trim();
                  const newLogin = (h.new_login_username || "").trim();
                  const handleChanged = oldHandle && newHandle && oldHandle !== newHandle;
                  const displayChanged = oldDisplay && newDisplay && oldDisplay !== newDisplay;
                  const loginChanged = oldLogin && newLogin && oldLogin !== newLogin;
                  return (
                    <div key={h.id} className="rounded-xl border border-white/10 bg-black/30 p-2 text-xs">
                      <div className="opacity-65">{new Date(h.created_at).toLocaleString("tr-TR")}</div>
                      {handleChanged ? <div>@{oldHandle} → <span className="font-semibold">@{newHandle}</span></div> : null}
                      {displayChanged ? <div>{tx(lang, "Gorunen ad", "Display name")}: {oldDisplay} → <span className="font-semibold">{newDisplay}</span></div> : null}
                      {loginChanged ? <div>{tx(lang, "Giris kullanici adi", "Login username")}: @{oldLogin} → <span className="font-semibold">@{newLogin}</span></div> : null}
                      {!handleChanged && !displayChanged && !loginChanged ? (
                        <div className="opacity-70">{tx(lang, "Profil kimlik bilgileri guncellendi.", "Profile identity fields updated.")}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-xs opacity-60">
                {tx(lang, "Henuz bir degisim kaydi yok.", "No identity changes yet.")}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">{tx(lang, "Favoriler (en fazla 3)", "Favorites (max 3)")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {favorites.map((f) => (
                <button
                  key={`edit-fav-${f.rank}`}
                  type="button"
                  onClick={() => void removeFavoriteFromProfile(Number(f.rank))}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs"
                  title={tx(lang, "Kaldir", "Remove")}
                >
                  #{f.rank} {f.beer_name} ×
                </button>
              ))}
              {!favorites.length ? <div className="text-xs opacity-60">{tx(lang, "Henuz favori yok.", "No favorites yet.")}</div> : null}
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
                  <div className="text-xs opacity-60">{tx(lang, "Oneri yok, yazarak ekleyebilirsin.", "No suggestions, you can type and add.")}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void addFavoriteFromProfile()}
                className="mt-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
              >
                {tx(lang, "Yazdigimi favoriye ekle", "Add typed value to favorites")}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3">
            <div className="text-xs opacity-80">KVKK / GDPR</div>
            <div className="mt-1 text-sm">Hesabını ve tüm verilerini kalıcı olarak silebilirsin.</div>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="mt-3 rounded-xl border border-red-300/45 bg-red-500/20 px-3 py-2 text-sm text-red-100"
            >
              Hesabımı Sil
            </button>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">{tx(lang, "Ortalama", "Average")}: {avg.toFixed(2)}⭐</div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">{year} {tx(lang, "log", "logs")}: {checkins.length}</div>
          {isOwnProfile ? (
            <Link href="/connections?tab=followers" className="rounded-xl border border-white/10 bg-black/20 p-2 underline">
              {tx(lang, "Takipci", "Followers")}: {followers}
            </Link>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">{tx(lang, "Takipci", "Followers")}: {followers}</div>
          )}
          {isOwnProfile ? (
            <Link href="/connections?tab=following" className="rounded-xl border border-white/10 bg-black/20 p-2 underline">
              {tx(lang, "Takip", "Following")}: {following}
            </Link>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">{tx(lang, "Takip", "Following")}: {following}</div>
          )}
        </div>

        {sessionUserId && sessionUserId !== profile.user_id ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void toggleFollow()}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {isFollowing ? tx(lang, "Takibi birak", "Unfollow") : tx(lang, "Takip et", "Follow")}
            </button>
            {followsMe ? <FollowsYouBadge lang={lang} className="mt-2 text-xs" /> : null}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">{tx(lang, "Favoriler", "Favorites")}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {favorites.map((f) => (
            <div key={f.rank} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
              #{f.rank} {f.beer_name}
            </div>
          ))}
          {!favorites.length ? <div className="text-xs opacity-60">{tx(lang, "Favori secilmemis.", "No favorites selected.")}</div> : null}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm opacity-80">{tx(lang, "Isi haritasi", "Heatmap")} ({year})</div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-[repeat(4,minmax(0,auto))] md:items-center">
            <select
              value={heatmapMode}
              onChange={(e) => {
                const nextMode = parseHeatmapMode(e.target.value);
                if (!nextMode) return;
                setHeatmapMode(nextMode);
                void saveHeatmapPrefs(nextMode, gridCellMetric);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none md:min-w-[88px]"
            >
              <option value="football">{tx(lang, "Saha", "Field")}</option>
              <option value="grid">Grid</option>
            </select>
            {heatmapMode === "grid" ? (
              <>
                <select
                  value={gridCellMetric}
                  onChange={(e) => {
                    const nextMetric = parseGridCellMetric(e.target.value);
                    if (!nextMetric) return;
                    setGridCellMetric(nextMetric);
                    void saveHeatmapPrefs(heatmapMode, nextMetric);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none md:min-w-[88px]"
                >
                <option value="color">{tx(lang, "Renk", "Color")}</option>
                <option value="count">{tx(lang, "Sayi", "Count")}</option>
                <option value="avgRating">{tx(lang, "Ortalama ⭐", "Average ⭐")}</option>
                </select>
                <select
                  value={selectedGridPaletteValue}
                  onChange={(e) => {
                    const raw = String(e.target.value || "");
                    if (raw === CUSTOM_GRID_THEME_VALUE) return;
                    const [from, to] = raw.split("|");
                    if (!from || !to) return;
                    setGridColorFrom(from);
                    setGridColorTo(to);
                  }}
                  className="col-span-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none md:col-span-1 md:min-w-[132px]"
                >
                  {HEATMAP_PALETTES.map((p) => (
                    <option key={`hm-theme-${p.key}`} value={`${p.from}|${p.to}`}>
                      {p.label}
                    </option>
                  ))}
                  <option value={CUSTOM_GRID_THEME_VALUE}>{tx(lang, "Birader Atolye (Ozel)", "Birader Atelier (Custom)")}</option>
                </select>
              </>
            ) : null}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none md:min-w-[88px]"
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
          <FootballHeatmap year={year} checkins={checkins} onSelectDay={(d) => isOwnProfile && setSelectedDay(d)} lang={lang} />
        ) : (
          <FieldHeatmap
            year={year}
            checkins={checkins}
            onSelectDay={(d) => isOwnProfile && setSelectedDay(d)}
            readOnly={!isOwnProfile}
            cellMetric={gridCellMetric}
            colorFrom={gridColorFrom}
            colorTo={gridColorTo}
            lang={lang}
          />
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">{tx(lang, "Son check-in'ler", "Recent check-ins")}</div>
        <div className="mt-2 space-y-2">
          {checkins.slice(0, 10).map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">{c.beer_name}</div>
                <RatingStars value={c.rating} size="xs" />
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
              {(c.media_url || "").trim() ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  {(c.media_type || "").startsWith("video") ? (
                    <video src={c.media_url || ""} controls className="h-40 w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.media_url || ""} alt="checkin medya" className="h-40 w-full object-cover" />
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {!checkins.length ? <div className="text-xs opacity-60">{tx(lang, "Bu yil check-in yok.", "No check-ins this year.")}</div> : null}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">{tx(lang, "Stereotip rozetler", "Stereotype badges")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {stereotypeBadges.map((b) => {
            const meta = badgeMetaForKey(b.badge_key);
            return (
              <div
                key={b.badge_key}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs"
                style={{
                  backgroundImage: `linear-gradient(140deg, ${meta.colorFrom}33, ${meta.colorTo}22)`,
                }}
              >
                <div className="font-semibold">
                  {meta.icon} {lang === "en" ? b.title_en : b.title_tr}
                </div>
                <div className="mt-1 opacity-75">{lang === "en" ? b.detail_en : b.detail_tr}</div>
                <div className="mt-1 text-[10px] opacity-60">{lang === "en" ? meta.ruleEn : meta.ruleTr}</div>
              </div>
            );
          })}
          {!stereotypeBadges.length ? <div className="text-xs opacity-60">{tx(lang, "Henüz stereotip rozet yok.", "No stereotype badges yet.")}</div> : null}
        </div>
      </section>

      {isOwnProfile ? (
        <DayModal
          open={selectedDay !== null}
          day={selectedDay ?? ""}
          checkins={dayCheckins}
          beerOptions={beerOptions}
          lang={lang}
          onClose={() => setSelectedDay(null)}
          onAdd={addCheckinOnDay}
          onDelete={deleteCheckinOnDay}
          onUpdate={updateCheckinOnDay}
        />
      ) : null}

      {deleteModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/90 p-4">
            <div className="text-base font-semibold text-amber-200">Hesabımı Sil</div>
            <p className="mt-2 text-sm">
              Tüm verileriniz kalıcı olarak silinecektir. Emin misiniz?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void deleteOwnAccount()}
                disabled={deletingAccount}
                className="rounded-lg border border-red-300/45 bg-red-500/20 px-3 py-1.5 text-sm text-red-100 disabled:opacity-60"
              >
                {deletingAccount ? "Siliniyor..." : "Evet, sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
