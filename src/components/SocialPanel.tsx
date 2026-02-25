"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameFromEmail } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { favoriteBeerName } from "@/lib/beer";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  bio: string;
  is_public: boolean;
  avatar_path?: string | null;
};

type FavoriteBeerRow = {
  beer_name: string;
  rank: number;
};

type FollowRow = { following_id: string };
type FollowerRow = { follower_id: string };

type SearchProfile = {
  user_id: string;
  username: string;
  display_name?: string | null;
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
  display_name?: string | null;
};

type FeedComment = {
  id: number;
  checkin_id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
  display_name?: string | null;
};

type CommentLikeRow = {
  comment_id: number;
  user_id: string;
};

type NotificationRow = {
  id: number;
  user_id: string;
  actor_id: string | null;
  type: "comment" | "mention" | "comment_like" | "follow";
  ref_id: string;
  payload?: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
};

type NotificationView = NotificationRow & {
  actor_username: string;
  actor_display_name?: string | null;
};

type ShareInviteRow = {
  id: number;
  source_checkin_id: string;
  inviter_id: string;
  invited_user_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at?: string | null;
  accepted_checkin_id?: string | null;
};

type PendingInviteView = ShareInviteRow & {
  source_beer_name: string;
  source_created_at: string;
  inviter_username: string;
  inviter_display_name?: string | null;
};

type OwnCheckinLite = {
  id: string;
  beer_name: string;
  created_at: string;
};

type FeedWindow = "all" | "24h" | "7d";
type FeedScope = "all" | "following";
type LeaderWindow = "7d" | "30d" | "90d" | "365d";
type LeaderScope = "all" | "followed";

type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  logs: number;
  avgRating: number;
};

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
  const rated = checkins.filter((c) => c.rating !== null && c.rating !== undefined);
  if (!rated.length) return 0;
  const sum = rated.reduce((acc, c) => acc + Number(c.rating ?? 0), 0);
  return Math.round((sum / rated.length) * 100) / 100;
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

function visibleName(p: { username: string; display_name?: string | null }) {
  const d = (p.display_name || "").trim();
  return d || `@${p.username}`;
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteBeerRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [addingFavorite, setAddingFavorite] = useState<string>("");
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [favoriteOpen, setFavoriteOpen] = useState(false);

  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingProfiles, setFollowingProfiles] = useState<SearchProfile[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<SearchProfile[]>([]);
  const [relationView, setRelationView] = useState<"following" | "followers">("following");
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [relationHighlightUserId, setRelationHighlightUserId] = useState("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedWindow, setFeedWindow] = useState<FeedWindow>("24h");
  const [feedScope, setFeedScope] = useState<FeedScope>("all");
  const [feedMinRating, setFeedMinRating] = useState<number>(0);
  const [feedQuery, setFeedQuery] = useState("");
  const [feedCommentsByCheckin, setFeedCommentsByCheckin] = useState<Record<string, FeedComment[]>>({});
  const [commentLikeCountById, setCommentLikeCountById] = useState<Record<number, number>>({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<Record<number, boolean>>({});
  const [commentDraftByCheckin, setCommentDraftByCheckin] = useState<Record<string, string>>({});
  const [commentSendingFor, setCommentSendingFor] = useState<string>("");
  const [commentLikeBusyId, setCommentLikeBusyId] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(true);
  const [notifActionBusyId, setNotifActionBusyId] = useState<number>(0);
  const [highlightCheckinId, setHighlightCheckinId] = useState("");
  const [highlightCommentId, setHighlightCommentId] = useState<number>(0);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteView[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<number>(0);
  const [ownRecentCheckins, setOwnRecentCheckins] = useState<OwnCheckinLite[]>([]);
  const [inviteSourceCheckinId, setInviteSourceCheckinId] = useState("");
  const [inviteTargetUserId, setInviteTargetUserId] = useState("");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [leaderWindow, setLeaderWindow] = useState<LeaderWindow>("7d");
  const [leaderScope, setLeaderScope] = useState<LeaderScope>("all");
  const [leaderRows, setLeaderRows] = useState<LeaderboardRow[]>([]);
  const [leaderBusy, setLeaderBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const followingIdsRef = useRef<Set<string>>(new Set());
  const followingNameRef = useRef<Map<string, { username: string; display_name?: string | null }>>(new Map());
  const leaderboardReloadRef = useRef<(() => Promise<void>) | null>(null);
  const feedIdsRef = useRef<string[]>([]);

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
      if (feedScope === "following" && item.user_id !== userId && !followingIds.has(item.user_id)) return false;
      if (feedMinRating > 0 && Number(item.rating || 0) < feedMinRating) return false;
      if (windowMs > 0) {
        const ts = new Date(item.created_at).getTime();
        if (!Number.isFinite(ts) || now - ts > windowMs) return false;
      }
      if (!query) return true;
      return (
        item.username.toLowerCase().includes(query) ||
        (item.display_name || "").toLowerCase().includes(query) ||
        item.beer_name.toLowerCase().includes(query)
      );
    });
  }, [feedItems, feedMinRating, feedQuery, feedScope, feedWindow, followingIds, userId]);
  const followerIds = useMemo(() => new Set(followerProfiles.map((p) => p.user_id)), [followerProfiles]);
  const unreadNotifCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  function markDbError(message: string) {
    const lower = message.toLowerCase();
    if (
      lower.includes("does not exist") ||
      lower.includes("relation") ||
      lower.includes("column") ||
      lower.includes("policy")
    ) {
      setDbError(
        "Supabase sosyal semasi guncel degil. SQL Editor'de scripts/sql/main.sql dosyasini calistirip sayfayi yenile."
      );
      return;
    }
    setDbError(message);
  }

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

  async function reserveProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, bio, is_public, avatar_path")
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
        display_name: candidate,
        bio: "",
        is_public: true,
        avatar_path: "",
      });

      if (!insertError) {
        trackEvent({ eventName: "profile_created", userId, props: { username: candidate } });
        return {
          user_id: userId,
          username: candidate,
          display_name: candidate,
          bio: "",
          is_public: true,
          avatar_path: "",
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

  async function loadFeed() {
    setFeedBusy(true);
    const { data: checkinRows, error: checkinErr } = await supabase
      .from("checkins")
      .select("id, user_id, beer_name, rating, created_at")
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
      setFeedCommentsByCheckin({});
      setCommentLikeCountById({});
      setCommentLikedByMe({});
      return;
    }

    const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .in("user_id", ownerIds);

    if (profileErr) {
      markDbError(profileErr.message);
      return;
    }

    const profileById = new Map<string, { username: string; display_name?: string | null }>();
    for (const p of (profileRows as Array<{ user_id: string; username: string; display_name?: string | null }> | null) ?? []) {
      profileById.set(p.user_id, { username: p.username, display_name: p.display_name });
    }

    setFeedItems(
      rows.map((r) => ({
        ...r,
        username: profileById.get(r.user_id)?.username ?? "kullanici",
        display_name: profileById.get(r.user_id)?.display_name ?? "",
      }))
    );
    await loadCommentsForCheckins(rows.map((r) => String(r.id)));
    trackEvent({ eventName: "feed_loaded", userId, props: { count: rows.length } });
  }

  async function loadCommentsForCheckins(checkinIds: string[]) {
    const ids = Array.from(new Set(checkinIds.filter(Boolean)));
    if (!ids.length) {
      setFeedCommentsByCheckin({});
      return;
    }

    const { data, error } = await supabase
      .from("checkin_comments")
      .select("id, checkin_id, user_id, body, created_at")
      .in("checkin_id", ids)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      markDbError(error.message);
      return;
    }

    const commentRows = (data as Array<Omit<FeedComment, "username" | "display_name">> | null) ?? [];
    const userIds = Array.from(new Set(commentRows.map((x) => x.user_id)));
    let profileByUserId = new Map<string, { username: string; display_name?: string | null }>();

    if (userIds.length) {
      const { data: profileRows, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);

      if (profileErr) {
        markDbError(profileErr.message);
        return;
      }

      profileByUserId = new Map(
        ((profileRows as Array<{ user_id: string; username: string; display_name?: string | null }> | null) ?? []).map(
          (p) => [p.user_id, { username: p.username, display_name: p.display_name }]
        )
      );
    }

    const grouped: Record<string, FeedComment[]> = {};
    for (const id of ids) grouped[id] = [];
    for (const c of commentRows) {
      const ref = profileByUserId.get(c.user_id);
      const enriched: FeedComment = {
        ...c,
        username: ref?.username ?? "kullanici",
        display_name: ref?.display_name ?? "",
      };
      if (!grouped[c.checkin_id]) grouped[c.checkin_id] = [];
      grouped[c.checkin_id].push(enriched);
    }

    setFeedCommentsByCheckin((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = grouped[id] ?? [];
      return next;
    });

    const commentIds = commentRows.map((x) => Number(x.id)).filter((x) => Number.isFinite(x));
    if (!commentIds.length) {
      return;
    }

    const { data: likeRows, error: likeErr } = await supabase
      .from("checkin_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds)
      .limit(5000);

    if (likeErr) {
      markDbError(likeErr.message);
      return;
    }

    const counts: Record<number, number> = {};
    const likedMap: Record<number, boolean> = {};
    for (const cid of commentIds) {
      counts[cid] = 0;
      likedMap[cid] = false;
    }
    for (const row of ((likeRows as CommentLikeRow[] | null) ?? [])) {
      const cid = Number(row.comment_id);
      counts[cid] = (counts[cid] || 0) + 1;
      if (row.user_id === userId) likedMap[cid] = true;
    }
    setCommentLikeCountById((prev) => ({ ...prev, ...counts }));
    setCommentLikedByMe((prev) => ({ ...prev, ...likedMap }));
  }

  async function loadPendingInvites() {
    const { data, error } = await supabase
      .from("checkin_share_invites")
      .select("id, source_checkin_id, inviter_id, invited_user_id, status, created_at, responded_at, accepted_checkin_id")
      .eq("invited_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      markDbError(error.message);
      return;
    }

    const invites = (data as ShareInviteRow[] | null) ?? [];
    if (!invites.length) {
      setPendingInvites([]);
      return;
    }

    const sourceIds = Array.from(new Set(invites.map((x) => x.source_checkin_id)));
    const inviterIds = Array.from(new Set(invites.map((x) => x.inviter_id)));

    const [{ data: sourceRows, error: sourceErr }, { data: inviterRows, error: inviterErr }] = await Promise.all([
      supabase
        .from("checkins")
        .select("id, beer_name, created_at")
        .in("id", sourceIds)
        .limit(200),
      supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", inviterIds),
    ]);

    if (sourceErr) {
      markDbError(sourceErr.message);
      return;
    }
    if (inviterErr) {
      markDbError(inviterErr.message);
      return;
    }

    const sourceById = new Map<string, { beer_name: string; created_at: string }>();
    for (const row of (sourceRows as Array<{ id: string; beer_name: string; created_at: string }> | null) ?? []) {
      sourceById.set(String(row.id), { beer_name: row.beer_name, created_at: row.created_at });
    }

    const inviterById = new Map<string, { username: string; display_name?: string | null }>();
    for (const row of
      (inviterRows as Array<{ user_id: string; username: string; display_name?: string | null }> | null) ?? []) {
      inviterById.set(row.user_id, { username: row.username, display_name: row.display_name });
    }

    const viewRows: PendingInviteView[] = [];
    for (const inv of invites) {
      const src = sourceById.get(inv.source_checkin_id);
      if (!src) continue;
      const inviter = inviterById.get(inv.inviter_id);
      viewRows.push({
        ...inv,
        source_beer_name: src.beer_name,
        source_created_at: src.created_at,
        inviter_username: inviter?.username ?? "kullanici",
        inviter_display_name: inviter?.display_name ?? "",
      });
    }

    setPendingInvites(viewRows);
  }

  async function loadOwnRecentCheckins() {
    const { data, error } = await supabase
      .from("checkins")
      .select("id, beer_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      markDbError(error.message);
      return;
    }

    const rows = (data as OwnCheckinLite[] | null) ?? [];
    setOwnRecentCheckins(rows);
    if (!inviteSourceCheckinId && rows.length > 0) setInviteSourceCheckinId(String(rows[0].id));
  }

  async function loadNotifications() {
    setNotifBusy(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, ref_id, payload, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifBusy(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    const rows = (data as NotificationRow[] | null) ?? [];
    const actorIds = Array.from(new Set(rows.map((x) => x.actor_id).filter((x): x is string => Boolean(x))));
    let actorById = new Map<string, { username: string; display_name?: string | null }>();
    if (actorIds.length) {
      const { data: actorRows, error: actorErr } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", actorIds);
      if (actorErr) {
        markDbError(actorErr.message);
        return;
      }
      actorById = new Map(
        ((actorRows as Array<{ user_id: string; username: string; display_name?: string | null }> | null) ?? []).map(
          (x) => [x.user_id, { username: x.username, display_name: x.display_name }]
        )
      );
    }

    const viewRows: NotificationView[] = rows.map((n) => {
      const actor = (n.actor_id && actorById.get(n.actor_id)) || null;
      return {
        ...n,
        actor_username: actor?.username || "kullanici",
        actor_display_name: actor?.display_name || "",
      };
    });
    setNotifications(viewRows);
  }

  async function ensureFeedCheckinLoaded(checkinId: string) {
    const exists = feedIdsRef.current.includes(checkinId);
    if (exists) return true;

    const { data: row, error } = await supabase
      .from("checkins")
      .select("id, user_id, beer_name, rating, created_at")
      .eq("id", checkinId)
      .maybeSingle();
    if (error || !row) return false;

    const checkin = row as FeedCheckinRow;
    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .eq("user_id", checkin.user_id)
      .maybeSingle();
    if (pErr) return false;

    const username = (p as any)?.username || "kullanici";
    const displayName = (p as any)?.display_name || "";
    setFeedItems((prev) =>
      [
        { ...checkin, username, display_name: displayName },
        ...prev.filter((x) => String(x.id) !== String(checkin.id)),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 40)
    );
    await loadCommentsForCheckins([String(checkin.id)]);
    return true;
  }

  async function markNotificationRead(id: number) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    }
  }

  async function loadLeaderboard() {
    const now = new Date();
    const start = new Date(now);
    if (leaderWindow === "7d") start.setDate(now.getDate() - 7);
    if (leaderWindow === "30d") start.setDate(now.getDate() - 30);
    if (leaderWindow === "90d") start.setDate(now.getDate() - 90);
    if (leaderWindow === "365d") start.setDate(now.getDate() - 365);

    const followedIds = Array.from(new Set([...followingIdsRef.current, userId]));

    setLeaderBusy(true);
    let query = supabase
      .from("checkins")
      .select("user_id, rating, created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(10000);

    if (leaderScope === "followed") {
      query = query.in("user_id", followedIds);
    }

    const { data: checkinRows, error: checkinErr } = await query;
    setLeaderBusy(false);

    if (checkinErr) {
      markDbError(checkinErr.message);
      return;
    }

    const rows = (checkinRows as Array<{ user_id: string; rating: number | null }> | null) ?? [];
    if (!rows.length) {
      setLeaderRows([]);
      return;
    }

    const agg = new Map<string, { logs: number; ratedCount: number; ratingSum: number }>();
    for (const row of rows) {
      const entry = agg.get(row.user_id) ?? { logs: 0, ratedCount: 0, ratingSum: 0 };
      entry.logs += 1;
      if (row.rating !== null && row.rating !== undefined) {
        entry.ratedCount += 1;
        entry.ratingSum += Number(row.rating);
      }
      agg.set(row.user_id, entry);
    }

    const ids = Array.from(agg.keys());
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, is_public")
      .in("user_id", ids);

    if (profileErr) {
      markDbError(profileErr.message);
      return;
    }

    const visible = new Map<string, { username: string; display_name?: string | null }>();
    for (const p of (profileRows as Array<{ user_id: string; username: string; display_name?: string | null; is_public: boolean }> | null) ?? []) {
      if (leaderScope === "all" && !p.is_public) continue;
      visible.set(p.user_id, { username: p.username, display_name: p.display_name });
    }

    const result: LeaderboardRow[] = [];
    for (const [uid, stats] of agg.entries()) {
      const profileRef = visible.get(uid);
      if (!profileRef) continue;
      result.push({
        user_id: uid,
        username: profileRef.username,
        display_name: profileRef.display_name,
        logs: stats.logs,
        avgRating: Math.round((stats.ratingSum / Math.max(1, stats.ratedCount)) * 100) / 100,
      });
    }

    result.sort((a, b) => {
      if (a.logs !== b.logs) return b.logs - a.logs;
      if (a.avgRating !== b.avgRating) return b.avgRating - a.avgRating;
      return a.username.localeCompare(b.username, "tr");
    });

    setLeaderRows(result.slice(0, 25));
    trackEvent({
      eventName: "leaderboard_loaded",
      userId,
      props: { scope: leaderScope, window: leaderWindow, count: result.length },
    });
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
    await loadFeed();

    if (!ids.length) {
      setFollowingProfiles([]);
      return;
    }

    const { data: people, error: peopleError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, bio, is_public")
      .in("user_id", ids)
      .order("username", { ascending: true });

    if (peopleError) {
      markDbError(peopleError.message);
      return;
    }

    setFollowingProfiles((people as SearchProfile[] | null) ?? []);

    const { data: followerRows, error: followerErr } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", userId);

    if (followerErr) {
      markDbError(followerErr.message);
      return;
    }

    const followerIds = (followerRows as FollowerRow[] | null)?.map((r) => r.follower_id) ?? [];
    if (!followerIds.length) {
      setFollowerProfiles([]);
      return;
    }

    const { data: followerPeople, error: followerPeopleErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, bio, is_public")
      .in("user_id", followerIds)
      .order("username", { ascending: true });

    if (followerPeopleErr) {
      markDbError(followerPeopleErr.message);
      return;
    }

    setFollowerProfiles((followerPeople as SearchProfile[] | null) ?? []);
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
    setDisplayNameInput((ensured.display_name || "").trim() || ensured.username);
    setBioInput(ensured.bio || "");
    setIsPublic(ensured.is_public);
    setAvatarPath(ensured.avatar_path || "");

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
    await Promise.all([loadOwnRecentCheckins(), loadPendingInvites(), loadNotifications()]);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    followingIdsRef.current = followingIds;
    const nameMap = new Map<string, { username: string; display_name?: string | null }>();
    for (const p of followingProfiles) nameMap.set(p.user_id, { username: p.username, display_name: p.display_name });
    followingNameRef.current = nameMap;
    const hasCurrentTarget = followingProfiles.some((p) => p.user_id === inviteTargetUserId);
    if (!hasCurrentTarget) setInviteTargetUserId(followingProfiles[0]?.user_id || "");
  }, [followingIds, followingProfiles]);

  useEffect(() => {
    leaderboardReloadRef.current = loadLeaderboard;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  useEffect(() => {
    feedIdsRef.current = feedItems.map((x) => String(x.id));
  }, [feedItems]);

  useEffect(() => {
    void loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderScope, leaderWindow, followingIds]);

  useEffect(() => {
    const channel = supabase
      .channel(`social-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        async (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id) return;
          let profileRef = followingNameRef.current.get(row.user_id);
          if (!profileRef) {
            const { data: p } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("user_id", row.user_id)
              .maybeSingle();
            if (p) {
              profileRef = { username: (p as any).username, display_name: (p as any).display_name };
            }
          }
          setFeedItems((prev) => {
            const next = [
              {
                ...row,
                username: profileRef?.username ?? "kullanici",
                display_name: profileRef?.display_name ?? "",
              },
              ...prev.filter((x) => x.id !== row.id),
            ]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 40);
            return next;
          });
          void leaderboardReloadRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins" },
        async (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id) return;
          let profileRef = followingNameRef.current.get(row.user_id);
          if (!profileRef) {
            const { data: p } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("user_id", row.user_id)
              .maybeSingle();
            if (p) {
              profileRef = { username: (p as any).username, display_name: (p as any).display_name };
            }
          }
          setFeedItems((prev) =>
            prev
              .map((x) =>
                x.id === row.id
                  ? {
                      ...row,
                      username: profileRef?.username ?? "kullanici",
                      display_name: profileRef?.display_name ?? "",
                    }
                  : x
              )
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          );
          void leaderboardReloadRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "checkins" },
        (payload) => {
          const oldRow = payload.old as { id?: string; user_id?: string };
          if (!oldRow?.id) return;
          setFeedItems((prev) => prev.filter((x) => x.id !== oldRow.id));
          void leaderboardReloadRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_comment_likes" },
        () => {
          const ids = feedIdsRef.current;
          if (!ids.length) return;
          void loadCommentsForCheckins(ids);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${userId}`,
        },
        () => {
          void loadFollowing();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_comments" },
        () => {
          const ids = feedIdsRef.current;
          if (!ids.length) return;
          void loadCommentsForCheckins(ids);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkin_share_invites",
          filter: `invited_user_id=eq.${userId}`,
        },
        () => {
          void loadPendingInvites();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveProfile() {
    const nextDisplayName = displayNameInput.trim().slice(0, 32);

    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nextDisplayName, bio: bioInput.trim(), is_public: isPublic })
      .eq("user_id", userId);

    setSavingProfile(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    const nextProfile: ProfileRow = {
      user_id: userId,
      username: profile?.username || fallbackBase,
      display_name: nextDisplayName,
      bio: bioInput.trim(),
      is_public: isPublic,
    };

    setProfile(nextProfile);
    setDisplayNameInput(nextDisplayName);
    trackEvent({ eventName: "profile_updated", userId, props: { is_public: isPublic } });
  }

  async function onAvatarFileChange(file?: File) {
    if (!file) return;
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
      const uploadPath = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(uploadPath, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) {
        console.error("avatar upload error:", upErr.message);
        markDbError(upErr.message);
        alert(`Avatar yuklenemedi: ${upErr.message}`);
        return;
      }

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_path: uploadPath })
        .eq("user_id", userId);
      if (dbErr) {
        console.error("avatar profile update error:", dbErr.message);
        markDbError(dbErr.message);
        alert(`Profil avatari guncellenemedi: ${dbErr.message}`);
        return;
      }

      setAvatarPath(uploadPath);
      setProfile((prev) => (prev ? { ...prev, avatar_path: uploadPath } : prev));
      trackEvent({ eventName: "avatar_uploaded", userId, props: { path: uploadPath } });
    } catch (e: any) {
      alert(e?.message || "Avatar islenemedi.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function addFavorite() {
    const beer = favoriteBeerName(addingFavorite.trim());
    if (!beer) return;
    const { data: rows, error: readErr } = await supabase
      .from("favorite_beers")
      .select("beer_name, rank")
      .eq("user_id", userId)
      .order("rank", { ascending: true });
    if (readErr) {
      markDbError(readErr.message);
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

    const { error } = await supabase.from("favorite_beers").insert({
      user_id: userId,
      beer_name: beer,
      rank,
    });

    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        const { data: refreshRows } = await supabase
          .from("favorite_beers")
          .select("beer_name, rank")
          .eq("user_id", userId)
          .order("rank", { ascending: true });
        const refreshed = ((refreshRows as FavoriteBeerRow[] | null) ?? []).map((f) => ({
          ...f,
          beer_name: favoriteBeerName(f.beer_name),
        }));
        setFavorites(refreshed);
        return;
      }
      markDbError(error.message);
      return;
    }

    setFavorites((prev) => {
      if (prev.some((f) => f.beer_name === beer)) return prev;
      return [...prev, { beer_name: beer, rank }].sort((a, b) => a.rank - b.rank);
    });
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
      .select("user_id, username, display_name, bio, is_public")
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
        const dname = normalizeUsername(p.display_name || "");
        const dist = typoDistance(q, uname);
        const dDist = dname ? typoDistance(q, dname) : dist;
        const contains = uname.includes(q) || dname.includes(q);
        const starts = uname.startsWith(q) || dname.startsWith(q);
        const threshold = Math.max(1.4, Math.floor(q.length / 3));
        const scoreDist = Math.min(dist, dDist);
        return { p, dist: scoreDist, contains, starts, pass: contains || scoreDist <= threshold };
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

    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: target.user_id,
      actor_id: userId,
      type: "follow",
      ref_id: String(target.user_id),
      payload: { follower_user_id: userId },
    });
    if (notifErr) markDbError(notifErr.message);

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

  async function addComment(checkinId: string) {
    const body = (commentDraftByCheckin[checkinId] || "").trim();
    if (!body) return;
    if (body.length > 240) {
      alert("Yorum en fazla 240 karakter olabilir.");
      return;
    }

    setCommentSendingFor(checkinId);
    const { data: inserted, error } = await supabase
      .from("checkin_comments")
      .insert({
        checkin_id: checkinId,
        user_id: userId,
        body,
      })
      .select("id")
      .single();
    setCommentSendingFor("");

    if (error) {
      markDbError(error.message);
      alert(error.message);
      return;
    }

    const commentId = Number((inserted as { id: number } | null)?.id || 0);
    const feedRef = feedItems.find((x) => String(x.id) === String(checkinId));
    const recipients = new Set<string>();
    if (feedRef?.user_id && feedRef.user_id !== userId) recipients.add(feedRef.user_id);

    const mentionHandles = Array.from(
      new Set(
        Array.from(body.matchAll(/@([a-zA-Z0-9._-]{3,32})/g))
          .map((m) => normalizeUsername(m[1]))
          .filter((x) => x.length >= 3)
      )
    );
    if (mentionHandles.length) {
      const { data: mentionUsers, error: mentionErr } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("username", mentionHandles)
        .limit(40);
      if (!mentionErr) {
        for (const u of ((mentionUsers as Array<{ user_id: string; username: string }> | null) ?? [])) {
          if (u.user_id !== userId) recipients.add(u.user_id);
        }
      }
    }

    if (recipients.size) {
      const mentionSet = new Set<string>();
      if (mentionHandles.length) {
        const { data: mentionUsers } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("username", mentionHandles)
          .limit(40);
        for (const u of ((mentionUsers as Array<{ user_id: string; username: string }> | null) ?? [])) {
          mentionSet.add(u.user_id);
        }
      }

      const rows = Array.from(recipients).map((rid) => ({
        user_id: rid,
        actor_id: userId,
        type: mentionSet.has(rid) ? "mention" : "comment",
        ref_id: checkinId,
        payload: {
          checkin_id: checkinId,
          comment_id: commentId || null,
          beer_name: feedRef?.beer_name || "",
        },
      }));
      const { error: notifErr } = await supabase.from("notifications").insert(rows);
      if (notifErr) markDbError(notifErr.message);
    }

    setCommentDraftByCheckin((prev) => ({ ...prev, [checkinId]: "" }));
    await loadCommentsForCheckins([checkinId]);
    trackEvent({ eventName: "checkin_comment_added", userId, props: { checkin_id: checkinId } });
  }

  async function toggleCommentLike(comment: FeedComment) {
    const liked = Boolean(commentLikedByMe[comment.id]);
    setCommentLikeBusyId(comment.id);
    if (liked) {
      const { error } = await supabase
        .from("checkin_comment_likes")
        .delete()
        .eq("comment_id", comment.id)
        .eq("user_id", userId);
      setCommentLikeBusyId(0);
      if (error) {
        markDbError(error.message);
        return;
      }
      setCommentLikedByMe((prev) => ({ ...prev, [comment.id]: false }));
      setCommentLikeCountById((prev) => ({ ...prev, [comment.id]: Math.max(0, Number(prev[comment.id] || 1) - 1) }));
      return;
    }

    const { error } = await supabase.from("checkin_comment_likes").insert({
      comment_id: comment.id,
      user_id: userId,
    });
    setCommentLikeBusyId(0);
    if (error) {
      markDbError(error.message);
      return;
    }

    setCommentLikedByMe((prev) => ({ ...prev, [comment.id]: true }));
    setCommentLikeCountById((prev) => ({ ...prev, [comment.id]: Number(prev[comment.id] || 0) + 1 }));
    if (comment.user_id !== userId) {
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: comment.user_id,
        actor_id: userId,
        type: "comment_like",
        ref_id: comment.checkin_id,
        payload: { comment_id: comment.id, checkin_id: comment.checkin_id },
      });
      if (notifErr) markDbError(notifErr.message);
    }
  }

  async function openNotification(item: NotificationView) {
    setNotifActionBusyId(item.id);
    if (!item.is_read) await markNotificationRead(item.id);
    if (item.type === "follow") {
      const actorUsername = String(item.actor_username || "");
      if (actorUsername && actorUsername !== "kullanici") {
        router.push(`/u/${encodeURIComponent(actorUsername)}`);
      } else {
        setRelationView("followers");
        setRelationsOpen(true);
        const targetUserId = String(item.actor_id || "");
        if (targetUserId) {
          setRelationHighlightUserId(targetUserId);
          setTimeout(() => setRelationHighlightUserId(""), 2600);
        }
      }
      setNotifActionBusyId(0);
      return;
    }
    const payload = (item.payload || {}) as Record<string, any>;
    const checkinId = String(payload.checkin_id || item.ref_id || "");
    if (checkinId) {
      setFeedWindow("all");
      setFeedMinRating(0);
      setFeedQuery("");
      await ensureFeedCheckinLoaded(checkinId);
      await loadCommentsForCheckins([checkinId]);
      setHighlightCheckinId(checkinId);
      setTimeout(() => setHighlightCheckinId(""), 2600);
      const commentId = Number(payload.comment_id || 0);
      if (commentId > 0) {
        setHighlightCommentId(commentId);
        setTimeout(() => setHighlightCommentId(0), 2600);
        setTimeout(() => {
          document.getElementById(`comment-${commentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    }
    setNotifActionBusyId(0);
  }

  async function createShareInvite() {
    if (!inviteSourceCheckinId || !inviteTargetUserId) return;
    if (inviteTargetUserId === userId) {
      alert("Kendine davet gonderemezsin.");
      return;
    }

    setInviteCreating(true);
    const { error } = await supabase.from("checkin_share_invites").upsert(
      {
        source_checkin_id: inviteSourceCheckinId,
        inviter_id: userId,
        invited_user_id: inviteTargetUserId,
        status: "pending",
        responded_at: null,
        accepted_checkin_id: null,
      },
      { onConflict: "source_checkin_id,invited_user_id" }
    );
    setInviteCreating(false);

    if (error) {
      markDbError(error.message);
      alert(error.message);
      return;
    }

    trackEvent({
      eventName: "checkin_share_invite_created",
      userId,
      props: { source_checkin_id: inviteSourceCheckinId, invited_user_id: inviteTargetUserId },
    });
    alert("Davet gonderildi.");
  }

  async function acceptInvite(inviteId: number) {
    setInviteBusyId(inviteId);
    const { data, error } = await supabase.rpc("accept_checkin_share_invite", { p_invite_id: inviteId });
    setInviteBusyId(0);

    if (error) {
      markDbError(error.message);
      alert(error.message);
      return;
    }

    if (data !== true) {
      alert("Davet kabul edilemedi.");
      return;
    }

    setPendingInvites((prev) => prev.filter((x) => x.id !== inviteId));
    await loadOwnRecentCheckins();
    trackEvent({ eventName: "checkin_share_invite_accepted", userId, props: { invite_id: inviteId } });
  }

  async function declineInvite(inviteId: number) {
    setInviteBusyId(inviteId);
    const { error } = await supabase
      .from("checkin_share_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("invited_user_id", userId)
      .eq("status", "pending");
    setInviteBusyId(0);

    if (error) {
      markDbError(error.message);
      alert(error.message);
      return;
    }

    setPendingInvites((prev) => prev.filter((x) => x.id !== inviteId));
    trackEvent({ eventName: "checkin_share_invite_declined", userId, props: { invite_id: inviteId } });
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
        <div className="sticky top-2 z-20 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur">
          <div className="text-xs opacity-70">Baglantilar</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setRelationView("following");
                setRelationsOpen((v) => !v || relationView !== "following");
              }}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                relationView === "following" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
              }`}
            >
              <div className="text-xs opacity-70">Takip edilen</div>
              <div className="text-lg font-semibold">{followingProfiles.length}</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setRelationView("followers");
                setRelationsOpen((v) => !v || relationView !== "followers");
              }}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                relationView === "followers" ? "border-amber-300/35 bg-amber-500/10" : "border-white/10 bg-black/20"
              }`}
            >
              <div className="text-xs opacity-70">Takipci</div>
              <div className="text-lg font-semibold">{followerProfiles.length}</div>
            </button>
          </div>

          {relationsOpen ? (
            <div className="mt-3 space-y-2">
              {(relationView === "following" ? followingProfiles : followerProfiles).map((p) => {
                const isFollowing = followingIds.has(p.user_id);
                const isFollowersView = relationView === "followers";
                return (
                  <div
                    key={`${relationView}-top-${p.user_id}`}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-2 ${
                      relationHighlightUserId === p.user_id
                        ? "border-amber-300/45 bg-amber-500/10 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    <div className="min-w-0">
                      <Link href={`/u/${p.username}`} className="truncate text-sm underline">
                        {visibleName(p)}
                      </Link>
                      <div className="truncate text-[11px] opacity-65">@{p.username}</div>
                      {followerIds.has(p.user_id) ? (
                        <div className="text-[11px] text-amber-200/85">Seni takip ediyor</div>
                      ) : null}
                    </div>
                    {isFollowersView ? (
                      <button
                        type="button"
                        onClick={() => void (isFollowing ? unfollow(p) : follow(p))}
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                      >
                        {isFollowing ? "Takiptesin" : "Takip et"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void unfollow(p)}
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                      >
                        Cikar
                      </button>
                    )}
                  </div>
                );
              })}
              {(relationView === "following" ? followingProfiles.length : followerProfiles.length) === 0 ? (
                <div className="text-xs opacity-60">
                  {relationView === "following" ? "Henuz kimseyi takip etmiyorsun." : "Henuz takipcin yok."}
                </div>
              ) : null}
            </div>
          ) : null}
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
              placeholder="handle veya isim ara"
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
                      {visibleName(p)}
                    </Link>
                    <div className="truncate text-[11px] opacity-65">@{p.username}</div>
                    {followerIds.has(p.user_id) ? (
                      <div className="text-[11px] text-amber-200/85">Seni takip ediyor</div>
                    ) : null}
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

        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-amber-200/90">
              Bildirimler {unreadNotifCount ? `(${unreadNotifCount} yeni)` : ""}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotifPanelOpen((v) => !v)}
                className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[11px]"
              >
                {notifPanelOpen ? "Kapat" : "Ac"}
              </button>
              <button
                type="button"
                onClick={() => void loadNotifications()}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
              >
                Yenile
              </button>
            </div>
          </div>
          {notifPanelOpen ? (
            <div className="mt-2 space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openNotification(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void openNotification(n);
                    }
                  }}
                  className={`w-full rounded-xl border p-2 text-left ${
                    n.is_read
                      ? "border-white/10 bg-black/20"
                      : "border-amber-300/40 bg-amber-400/10 shadow-[0_0_0_1px_rgba(252,211,77,0.15)]"
                  } ${notifActionBusyId === n.id ? "pointer-events-none opacity-70" : ""}`}
                >
                  <div className="text-xs">
                    <Link
                      href={`/u/${encodeURIComponent(n.actor_username)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline"
                    >
                      {visibleName({ username: n.actor_username, display_name: n.actor_display_name })}
                    </Link>
                    {n.type === "comment" ? " loguna yorum yazdi." : null}
                    {n.type === "mention" ? " seni yorumda etiketledi." : null}
                    {n.type === "comment_like" ? " yorumunu begendi." : null}
                    {n.type === "follow" ? " seni takip etmeye basladi." : null}
                  </div>
                  <div className="mt-1 text-[11px] opacity-65">{new Date(n.created_at).toLocaleString("tr-TR")}</div>
                </div>
              ))}
              {notifBusy ? <div className="text-xs opacity-60">Bildirimler yukleniyor...</div> : null}
              {!notifBusy && !notifications.length ? (
                <div className="text-xs opacity-60">Bildirim yok.</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Birlikte icildi davetleri</div>
          <div className="mt-2 space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/u/${inv.inviter_username}`} className="truncate text-xs underline opacity-80">
                      {visibleName({ username: inv.inviter_username, display_name: inv.inviter_display_name })}
                    </Link>
                    <div className="truncate text-sm font-semibold">{inv.source_beer_name}</div>
                    <div className="text-[11px] opacity-65">
                      {new Date(inv.source_created_at).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void declineInvite(inv.id)}
                      className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs"
                    >
                      Ret
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void acceptInvite(inv.id)}
                      className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-xs"
                    >
                      Kabul et
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!pendingInvites.length ? (
              <div className="text-xs opacity-60">Bekleyen davet yok.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">Kendi loguna kisi ekle</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <select
              value={inviteSourceCheckinId}
              onChange={(e) => setInviteSourceCheckinId(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              {ownRecentCheckins.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.beer_name} - {new Date(c.created_at).toLocaleString("tr-TR")}
                </option>
              ))}
            </select>
            <select
              value={inviteTargetUserId}
              onChange={(e) => setInviteTargetUserId(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              {followingProfiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {visibleName(p)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!inviteSourceCheckinId || !inviteTargetUserId || inviteCreating}
              onClick={() => void createShareInvite()}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-xs disabled:opacity-50"
            >
              {inviteCreating ? "Gonderiliyor..." : "Davet gonder"}
            </button>
          </div>
          {!ownRecentCheckins.length ? (
            <div className="mt-2 text-xs opacity-60">Davet icin once en az bir logun olmasi gerekiyor.</div>
          ) : null}
          {!followingProfiles.length ? (
            <div className="mt-2 text-xs opacity-60">Davet icin once birini takip etmen gerekiyor.</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">Leaderboard</div>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              Yenile
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
              {[
                { key: "7d", label: "Hft" },
                { key: "30d", label: "Ay" },
                { key: "90d", label: "3Ay" },
                { key: "365d", label: "Yıl" },
              ].map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setLeaderWindow(x.key as LeaderWindow)}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] ${
                    leaderWindow === x.key ? "bg-white/15" : "bg-black/20"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <select
              value={leaderScope}
              onChange={(e) => setLeaderScope(e.target.value as LeaderScope)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="all">All users</option>
              <option value="followed">Followed</option>
            </select>
          </div>

          <div className="mt-2 space-y-2">
            {leaderRows.map((row, idx) => (
              <div
                key={row.user_id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  row.user_id === userId
                    ? "border-amber-300/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                    : "border-white/10 bg-black/25"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">
                    <span className="mr-2 opacity-70">#{idx + 1}</span>
                    <span>{visibleName(row)}</span>
                    {row.user_id === userId ? <span className="ml-2 text-[11px] text-amber-200">(sen)</span> : null}
                  </div>
                  <Link href={`/u/${row.username}`} className="text-xs underline opacity-70">
                    @{row.username}
                  </Link>
                  <div className="text-xs opacity-70">{row.logs} log</div>
                </div>
                <div className="text-sm">{row.avgRating.toFixed(2)}⭐</div>
              </div>
            ))}
            {leaderBusy ? <div className="text-xs opacity-60">Leaderboard yukleniyor...</div> : null}
            {!leaderBusy && !leaderRows.length ? (
              <div className="text-xs opacity-60">Bu filtrede leaderboard verisi yok.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">Sosyal akis</div>
            <button
              type="button"
              onClick={() => void loadFollowing()}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              Yenile
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <select
              value={feedScope}
              onChange={(e) => setFeedScope(e.target.value as FeedScope)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="all">Tum akış</option>
              <option value="following">Takip ettiklerim</option>
            </select>
            <select
              value={feedWindow}
              onChange={(e) => setFeedWindow(e.target.value as FeedWindow)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="24h">Son 24s</option>
              <option value="7d">Son 7g</option>
              <option value="all">Tum zaman</option>
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
              <div
                key={item.id}
                className={`rounded-xl border p-3 ${
                  highlightCheckinId === String(item.id)
                    ? "border-amber-300/45 bg-amber-500/10 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]"
                    : "border-white/10 bg-black/25"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/u/${item.username}`} className="text-xs underline opacity-80">
                    {visibleName(item)}
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

                <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-[11px] opacity-70">
                    Yorumlar ({feedCommentsByCheckin[item.id]?.length || 0})
                  </div>
                  <div className="mt-1 max-h-28 space-y-1 overflow-auto">
                    {(feedCommentsByCheckin[item.id] || []).map((c) => (
                      <div
                        id={`comment-${c.id}`}
                        key={c.id}
                        className={`rounded-md border px-2 py-1 text-[11px] ${
                          highlightCommentId === c.id
                            ? "border-amber-300/45 bg-amber-500/15 shadow-[0_0_0_1px_rgba(252,211,77,0.2)]"
                            : "border-white/10 bg-black/25"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/u/${c.username}`} className="mr-1 underline opacity-80">
                              {visibleName(c)}
                            </Link>
                            <span className="opacity-90">{c.body}</span>
                          </div>
                          <button
                            type="button"
                            disabled={commentLikeBusyId === c.id}
                            onClick={() => void toggleCommentLike(c)}
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] ${
                              commentLikedByMe[c.id]
                                ? "border-amber-300/35 bg-amber-500/15"
                                : "border-white/15 bg-white/5"
                            }`}
                          >
                            ♥ {commentLikeCountById[c.id] || 0}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!(feedCommentsByCheckin[item.id] || []).length ? (
                      <div className="text-[11px] opacity-55">Henuz yorum yok.</div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={commentDraftByCheckin[item.id] || ""}
                      onChange={(e) =>
                        setCommentDraftByCheckin((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Yorum yaz... (mention: @kullanici)"
                      maxLength={240}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                    />
                    <button
                      type="button"
                      disabled={commentSendingFor === item.id}
                      onClick={() => void addComment(item.id)}
                      className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                    >
                      {commentSendingFor === item.id ? "..." : "Gonder"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {feedBusy ? <div className="text-xs opacity-60">Akis yukleniyor...</div> : null}
            {!feedBusy && !filteredFeedItems.length ? (
              <div className="text-xs opacity-60">Akista gosterilecek log yok.</div>
            ) : null}
          </div>
        </div>

      </div>
    </section>
  );
}
