"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import LoadingPulse from "@/components/LoadingPulse";
import RatingStars from "@/components/RatingStars";
import WeeklyTickerBar, { type WeeklyTickerItem } from "@/components/WeeklyTickerBar";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameFromEmail } from "@/lib/identity";
import { trackEvent } from "@/lib/analytics";
import { measurePerf, trackPerfEvent } from "@/lib/perf";
import { favoriteBeerName } from "@/lib/beer";
import type { AppLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n";
import { BADGE_THRESHOLDS, badgeMetaForKey } from "@/lib/badgeMeta";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  bio: string;
  is_public: boolean;
  is_admin?: boolean | null;
  avatar_path?: string | null;
};

type ServerPreferenceRow = {
  notif_pref_follow?: boolean | null;
  notif_pref_comment?: boolean | null;
  notif_pref_mention?: boolean | null;
  notif_pref_comment_like?: boolean | null;
  notif_pref_checkin_like?: boolean | null;
  feed_pref_scope?: string | null;
  feed_pref_window?: string | null;
  feed_pref_min_rating?: number | null;
  feed_pref_format?: string | null;
  feed_pref_only_my_city?: boolean | null;
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

type DiscoverProfile = SearchProfile & {
  follower_count: number;
  recent_logs_30d: number;
};

type CheckinRow = {
  beer_name: string;
  rating: number | null;
  created_at: string;
  day_period?: string | null;
  city?: string | null;
  district?: string | null;
};

type FeedCheckinRow = {
  id: string;
  user_id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
  city?: string | null;
  district?: string | null;
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
  type: "comment" | "mention" | "comment_like" | "checkin_like" | "follow" | "system";
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
type NotificationFilter = "all" | "unread" | "comment" | "mention" | "comment_like" | "checkin_like" | "follow" | "system";
type LeaderWindow = "7d" | "30d" | "90d" | "365d";
type LeaderScope = "all" | "followed";
type FeedFormat = "all" | "draft" | "bottle";
type NotifTypeKey = "follow" | "comment" | "mention" | "comment_like" | "checkin_like";

type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  logs: number;
  avgRating: number;
};

type CheckinLikeRow = {
  checkin_id: string;
  user_id: string;
};

type WeeklyHighlightRow = {
  item_key: string;
  label_tr: string;
  label_en: string;
  value_tr: string;
  value_en: string;
  meta_tr: string;
  meta_en: string;
  href: string;
  priority: number;
};

type LeaderboardRpcRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  logs: number;
  avg_rating: number | null;
};

type PerfOverviewRow = {
  metric_key: string;
  total_calls: number;
  failed_calls: number;
  fail_rate_pct: number | null;
  avg_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
  unique_users: number;
  last_seen_at: string | null;
};

type DiscoverRpcRow = {
  user_id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  follower_count: number;
  recent_logs_30d: number;
};

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const FEED_PAGE_SIZE = 25;
const NOTIF_PAGE_SIZE = 30;
const CHECKIN_STATS_LIMIT = 320;
const SEARCH_SCAN_LIMIT = 120;
const DISCOVER_SCAN_LIMIT = 40;
const FEED_ENRICH_EAGER_COUNT = 8;
const REALTIME_REFRESH_THROTTLE_MS = 2000;

const NOTIF_PREFS_KEY = "birader:notif-prefs:v1";
const FEED_PREFS_KEY = "birader:feed-prefs:v1";

type BadgeProgressItem = {
  key: string;
  titleTr: string;
  titleEn: string;
  progress: number;
  hintTr: string;
  hintEn: string;
  done: boolean;
};

function ratio(a: number, b: number) {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(1, a / b));
}

function badgeProgress(checkins: CheckinRow[]) {
  const total = checkins.length;
  const weekdaySat = checkins.filter((c) => new Date(c.created_at).getDay() === 6).length;
  const nightLogs = checkins.filter((c) => {
    if (c.day_period === "night") return true;
    const h = new Date(c.created_at).getHours();
    return Number.isFinite(h) && (h >= 22 || h < 4);
  }).length;
  const draftLogs = checkins.filter((c) => c.beer_name.includes("— Fici —")).length;
  const bottleLogs = checkins.filter((c) => c.beer_name.includes("— Şişe/Kutu —") || c.beer_name.includes("— Sise/Kutu —"))
    .length;
  const uniqueCities = new Set(checkins.map((c) => String(c.city || "").trim()).filter(Boolean)).size;
  const spotMap = new Map<string, number>();
  for (const c of checkins) {
    const spot = `${String(c.city || "").trim()}::${String(c.district || "").trim()}`;
    if (spot === "::") continue;
    spotMap.set(spot, (spotMap.get(spot) || 0) + 1);
  }
  const topSpot = Math.max(0, ...Array.from(spotMap.values()));
  const satShare = total ? weekdaySat / total : 0;
  const nightShare = total ? nightLogs / total : 0;
  const draftShare = total ? draftLogs / total : 0;
  const bottleShare = total ? bottleLogs / total : 0;
  const topSpotShare = total ? topSpot / total : 0;

  const rows: BadgeProgressItem[] = [
    {
      key: "sat_committee",
      titleTr: "Cumartesi Komitesi",
      titleEn: "Saturday Committee",
      progress: Math.min(
        ratio(total, BADGE_THRESHOLDS.sat_committee.minTotal),
        ratio(weekdaySat, BADGE_THRESHOLDS.sat_committee.minSpecific),
        ratio(satShare, BADGE_THRESHOLDS.sat_committee.minShare || 0)
      ),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.sat_committee.minTotal - total)} toplam log + ${Math.max(
        0,
        BADGE_THRESHOLDS.sat_committee.minSpecific - weekdaySat
      )} Cumartesi logu daha gerekiyor.`,
      hintEn: `${Math.max(0, BADGE_THRESHOLDS.sat_committee.minTotal - total)} more logs + ${Math.max(
        0,
        BADGE_THRESHOLDS.sat_committee.minSpecific - weekdaySat
      )} more Saturday logs needed.`,
      done:
        total >= BADGE_THRESHOLDS.sat_committee.minTotal &&
        weekdaySat >= BADGE_THRESHOLDS.sat_committee.minSpecific &&
        satShare >= (BADGE_THRESHOLDS.sat_committee.minShare || 0),
    },
    {
      key: "night_owl",
      titleTr: "Gece Baykusu",
      titleEn: "Night Owl",
      progress: Math.min(
        ratio(total, BADGE_THRESHOLDS.night_owl.minTotal),
        ratio(nightLogs, BADGE_THRESHOLDS.night_owl.minSpecific),
        ratio(nightShare, BADGE_THRESHOLDS.night_owl.minShare || 0)
      ),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.night_owl.minTotal - total)} toplam log + ${Math.max(
        0,
        BADGE_THRESHOLDS.night_owl.minSpecific - nightLogs
      )} gece logu daha gerekiyor.`,
      hintEn: `${Math.max(0, BADGE_THRESHOLDS.night_owl.minTotal - total)} more logs + ${Math.max(
        0,
        BADGE_THRESHOLDS.night_owl.minSpecific - nightLogs
      )} more night logs needed.`,
      done:
        total >= BADGE_THRESHOLDS.night_owl.minTotal &&
        nightLogs >= BADGE_THRESHOLDS.night_owl.minSpecific &&
        nightShare >= (BADGE_THRESHOLDS.night_owl.minShare || 0),
    },
    {
      key: "draft_loyalist",
      titleTr: "Fıçıcı",
      titleEn: "Draft Loyalist",
      progress: Math.min(
        ratio(total, BADGE_THRESHOLDS.draft_loyalist.minTotal),
        ratio(draftLogs, BADGE_THRESHOLDS.draft_loyalist.minSpecific),
        ratio(draftShare, BADGE_THRESHOLDS.draft_loyalist.minShare || 0)
      ),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.draft_loyalist.minTotal - total)} toplam log + ${Math.max(
        0,
        BADGE_THRESHOLDS.draft_loyalist.minSpecific - draftLogs
      )} fici logu daha gerekiyor.`,
      hintEn: `${Math.max(0, BADGE_THRESHOLDS.draft_loyalist.minTotal - total)} more logs + ${Math.max(
        0,
        BADGE_THRESHOLDS.draft_loyalist.minSpecific - draftLogs
      )} more draft logs needed.`,
      done:
        total >= BADGE_THRESHOLDS.draft_loyalist.minTotal &&
        draftLogs >= BADGE_THRESHOLDS.draft_loyalist.minSpecific &&
        draftShare >= (BADGE_THRESHOLDS.draft_loyalist.minShare || 0),
    },
    {
      key: "bottle_lover",
      titleTr: "Siseci",
      titleEn: "Bottle Lover",
      progress: Math.min(
        ratio(total, BADGE_THRESHOLDS.bottle_lover.minTotal),
        ratio(bottleLogs, BADGE_THRESHOLDS.bottle_lover.minSpecific),
        ratio(bottleShare, BADGE_THRESHOLDS.bottle_lover.minShare || 0)
      ),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.bottle_lover.minTotal - total)} toplam log + ${Math.max(
        0,
        BADGE_THRESHOLDS.bottle_lover.minSpecific - bottleLogs
      )} sise/kutu logu daha gerekiyor.`,
      hintEn: `${Math.max(0, BADGE_THRESHOLDS.bottle_lover.minTotal - total)} more logs + ${Math.max(
        0,
        BADGE_THRESHOLDS.bottle_lover.minSpecific - bottleLogs
      )} more bottle/can logs needed.`,
      done:
        total >= BADGE_THRESHOLDS.bottle_lover.minTotal &&
        bottleLogs >= BADGE_THRESHOLDS.bottle_lover.minSpecific &&
        bottleShare >= (BADGE_THRESHOLDS.bottle_lover.minShare || 0),
    },
    {
      key: "nomad",
      titleTr: "Pub Nomadi",
      titleEn: "Pub Nomad",
      progress: ratio(uniqueCities, BADGE_THRESHOLDS.nomad.minSpecific),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.nomad.minSpecific - uniqueCities)} farkli sehir daha logla.`,
      hintEn: `Log from ${Math.max(0, BADGE_THRESHOLDS.nomad.minSpecific - uniqueCities)} more cities.`,
      done: uniqueCities >= BADGE_THRESHOLDS.nomad.minSpecific,
    },
    {
      key: "regular",
      titleTr: "Sadik Mudavim",
      titleEn: "Local Regular",
      progress: Math.min(
        ratio(total, BADGE_THRESHOLDS.regular.minTotal),
        ratio(topSpot, BADGE_THRESHOLDS.regular.minSpecific),
        ratio(topSpotShare, BADGE_THRESHOLDS.regular.minShare || 0)
      ),
      hintTr: `${Math.max(0, BADGE_THRESHOLDS.regular.minTotal - total)} toplam log + ayni bolgede ${Math.max(
        0,
        BADGE_THRESHOLDS.regular.minSpecific - topSpot
      )} log daha gerekiyor.`,
      hintEn: `${Math.max(0, BADGE_THRESHOLDS.regular.minTotal - total)} more logs + ${Math.max(
        0,
        BADGE_THRESHOLDS.regular.minSpecific - topSpot
      )} more logs in same area needed.`,
      done:
        total >= BADGE_THRESHOLDS.regular.minTotal &&
        topSpot >= BADGE_THRESHOLDS.regular.minSpecific &&
        topSpotShare >= (BADGE_THRESHOLDS.regular.minShare || 0),
    },
  ];

  return rows.sort((a, b) => Number(b.done) - Number(a.done) || b.progress - a.progress);
}

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
  const rated = checkins.filter((c) => c.rating !== null && c.rating !== undefined && Number(c.rating) > 0);
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
  lang = "tr",
}: {
  userId: string;
  sessionEmail?: string | null;
  allBeerOptions: string[];
  onQuickLog?: (payload: { beerName: string; rating: number }) => void;
  lang?: AppLang;
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
  const [connectionsMenuOpen, setConnectionsMenuOpen] = useState(false);
  const [relationHighlightUserId, setRelationHighlightUserId] = useState("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedCursorCreatedAt, setFeedCursorCreatedAt] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedWindow, setFeedWindow] = useState<FeedWindow>("24h");
  const [feedScope, setFeedScope] = useState<FeedScope>("all");
  const [feedFormat, setFeedFormat] = useState<FeedFormat>("all");
  const [feedOnlyMyCity, setFeedOnlyMyCity] = useState(false);
  const [feedMinRating, setFeedMinRating] = useState<number>(0);
  const [feedQuery, setFeedQuery] = useState("");
  const [feedCommentsByCheckin, setFeedCommentsByCheckin] = useState<Record<string, FeedComment[]>>({});
  const [commentPanelOpenByCheckin, setCommentPanelOpenByCheckin] = useState<Record<string, boolean>>({});
  const [commentPanelLoadingByCheckin, setCommentPanelLoadingByCheckin] = useState<Record<string, boolean>>({});
  const [checkinLikeCountById, setCheckinLikeCountById] = useState<Record<string, number>>({});
  const [checkinLikedByMe, setCheckinLikedByMe] = useState<Record<string, boolean>>({});
  const [commentLikeCountById, setCommentLikeCountById] = useState<Record<number, number>>({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<Record<number, boolean>>({});
  const [commentDraftByCheckin, setCommentDraftByCheckin] = useState<Record<string, string>>({});
  const [commentSendingFor, setCommentSendingFor] = useState<string>("");
  const [checkinLikeBusyId, setCheckinLikeBusyId] = useState<string>("");
  const [commentLikeBusyId, setCommentLikeBusyId] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [notifUnreadCountServer, setNotifUnreadCountServer] = useState(0);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifLimit, setNotifLimit] = useState(NOTIF_PAGE_SIZE);
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>("all");
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifTypeKey, boolean>>({
    follow: true,
    comment: true,
    mention: true,
    comment_like: true,
    checkin_like: true,
  });
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifSummaryMode, setNotifSummaryMode] = useState(false);
  const [notifActionBusyId, setNotifActionBusyId] = useState<number>(0);
  const [reportBusyKey, setReportBusyKey] = useState("");
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
  const [perfRows, setPerfRows] = useState<PerfOverviewRow[]>([]);
  const [perfBusy, setPerfBusy] = useState(false);
  const [weeklyScope, setWeeklyScope] = useState<"all" | "followed">("all");
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [weeklyItems, setWeeklyItems] = useState<WeeklyTickerItem[]>([]);
  const locale = lang === "en" ? "en-US" : "tr-TR";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [discoverProfiles, setDiscoverProfiles] = useState<DiscoverProfile[]>([]);
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const followingIdsRef = useRef<Set<string>>(new Set());
  const followingNameRef = useRef<Map<string, { username: string; display_name?: string | null }>>(new Map());
  const notifPanelOpenRef = useRef(false);
  const feedCommentsByCheckinRef = useRef<Record<string, FeedComment[]>>({});
  const commentPanelOpenByCheckinRef = useRef<Record<string, boolean>>({});
  const commentToCheckinIdRef = useRef<Map<number, string>>(new Map());
  const leaderboardReloadRef = useRef<(() => Promise<void>) | null>(null);
  const feedIdsRef = useRef<string[]>([]);
  const feedFilterSigRef = useRef("");
  const feedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const weeklyRefreshTimerRef = useRef<number | null>(null);
  const leaderboardRefreshTimerRef = useRef<number | null>(null);

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
  const primaryCity = useMemo(() => {
    const cityCounts = new Map<string, number>();
    for (const c of checkins) {
      const city = String(c.city || "").trim();
      if (!city) continue;
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    }
    return Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [checkins]);
  const badgeProgressRows = useMemo(() => badgeProgress(checkins), [checkins]);
  const filteredFeedItems = useMemo(() => {
    const query = feedQuery.trim().toLowerCase();
    const now = Date.now();
    const windowMs = feedWindow === "24h" ? 24 * 60 * 60 * 1000 : feedWindow === "7d" ? 7 * 24 * 60 * 60 * 1000 : 0;

    return feedItems.filter((item) => {
      if (feedScope === "following" && item.user_id !== userId && !followingIds.has(item.user_id)) return false;
      if (feedOnlyMyCity && primaryCity) {
        const city = String(item.city || "").trim().toLowerCase();
        if (!city || city !== primaryCity.toLowerCase()) return false;
      }
      if (feedFormat === "draft" && !item.beer_name.includes("— Fici —")) return false;
      if (
        feedFormat === "bottle" &&
        !item.beer_name.includes("— Şişe/Kutu —") &&
        !item.beer_name.includes("— Sise/Kutu —")
      ) {
        return false;
      }
      if (feedMinRating > 0 && (item.rating === null || Number(item.rating) < feedMinRating)) return false;
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
  }, [feedFormat, feedItems, feedMinRating, feedOnlyMyCity, feedQuery, feedScope, feedWindow, followingIds, primaryCity, userId]);
  const followerIds = useMemo(() => new Set(followerProfiles.map((p) => p.user_id)), [followerProfiles]);
  const unreadNotifCount = useMemo(
    () => {
      if (!notifLoaded) return notifUnreadCountServer;
      return notifications.filter((n) => {
        if (!n.is_read) {
          if (n.type === "follow" && !notifPrefs.follow) return false;
          if (n.type === "comment" && !notifPrefs.comment) return false;
          if (n.type === "mention" && !notifPrefs.mention) return false;
          if (n.type === "comment_like" && !notifPrefs.comment_like) return false;
          if (n.type === "checkin_like" && !notifPrefs.checkin_like) return false;
          return true;
        }
        return false;
      }).length;
    },
    [notifLoaded, notifPrefs, notifications, notifUnreadCountServer]
  );
  const perfRiskRows = useMemo(
    () =>
      perfRows.filter((row) => {
        const failRate = Number(row.fail_rate_pct || 0);
        const p95 = Number(row.p95_ms || 0);
        return failRate >= 5 || p95 >= 900;
      }),
    [perfRows]
  );
  const filteredNotifications = useMemo(() => {
    const prefFiltered = notifications.filter((n) => {
      if (n.type === "follow") return notifPrefs.follow;
      if (n.type === "comment") return notifPrefs.comment;
      if (n.type === "mention") return notifPrefs.mention;
      if (n.type === "comment_like") return notifPrefs.comment_like;
      if (n.type === "checkin_like") return notifPrefs.checkin_like;
      return true;
    });
    if (notifFilter === "all") return prefFiltered;
    if (notifFilter === "unread") return prefFiltered.filter((n) => !n.is_read);
    return prefFiltered.filter((n) => n.type === notifFilter);
  }, [notifPrefs, notifications, notifFilter]);
  const notificationSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; count: number; latest: NotificationView; type: NotificationView["type"]; actor: string }
    >();
    for (const n of filteredNotifications) {
      const dateBucket = new Date(n.created_at).toISOString().slice(0, 10);
      const key = `${n.type}|${n.actor_username}|${dateBucket}`;
      const prev = grouped.get(key);
      if (!prev) {
        grouped.set(key, {
          key,
          count: 1,
          latest: n,
          type: n.type,
          actor:
            n.actor_username === "system"
              ? tx(lang, "Birader", "Birader")
              : visibleName({ username: n.actor_username, display_name: n.actor_display_name }),
        });
        continue;
      }
      if (new Date(n.created_at).getTime() > new Date(prev.latest.created_at).getTime()) prev.latest = n;
      prev.count += 1;
      grouped.set(key, prev);
    }
    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
    );
  }, [filteredNotifications, lang]);

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

  function isMissingFunctionError(message: string, fnName: string) {
    const lower = String(message || "").toLowerCase();
    return lower.includes("function") && lower.includes(fnName.toLowerCase());
  }

  function isFavoriteLimitExceededError(message: string) {
    return String(message || "").toLowerCase().includes("favorite_limit_exceeded");
  }

  function scheduleWeeklyHighlightsRefresh() {
    if (weeklyRefreshTimerRef.current !== null) return;
    weeklyRefreshTimerRef.current = window.setTimeout(() => {
      weeklyRefreshTimerRef.current = null;
      void loadWeeklyHighlights();
    }, REALTIME_REFRESH_THROTTLE_MS);
  }

  function scheduleLeaderboardRefresh() {
    if (leaderboardRefreshTimerRef.current !== null) return;
    leaderboardRefreshTimerRef.current = window.setTimeout(() => {
      leaderboardRefreshTimerRef.current = null;
      void leaderboardReloadRef.current?.();
    }, REALTIME_REFRESH_THROTTLE_MS);
  }

  function hasCommentsLoaded(checkinId: string) {
    return Object.prototype.hasOwnProperty.call(feedCommentsByCheckinRef.current, checkinId);
  }

  async function ensureCommentsLoaded(checkinId: string) {
    if (!checkinId || hasCommentsLoaded(checkinId)) return;
    setCommentPanelLoadingByCheckin((prev) => ({ ...prev, [checkinId]: true }));
    try {
      await loadCommentsForCheckins([checkinId]);
    } finally {
      setCommentPanelLoadingByCheckin((prev) => ({ ...prev, [checkinId]: false }));
    }
  }

  function toggleCommentPanel(checkinId: string) {
    setCommentPanelOpenByCheckin((prev) => {
      const nextOpen = !prev[checkinId];
      const next = { ...prev, [checkinId]: nextOpen };
      if (nextOpen) void ensureCommentsLoaded(checkinId);
      return next;
    });
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
      .select("user_id, username, display_name, bio, is_public, is_admin, avatar_path")
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
          is_admin: false,
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

  async function loadFeed(reset = true) {
    if (!reset && !feedHasMore) return;
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finishPerf = (ok: boolean, rowCount = 0, errorText = "") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.feed.load",
        durationMs: ended - started,
        rowCount,
        ok,
        context: {
          reset,
          scope: feedScope,
          window: feedWindow,
          format: feedFormat,
          minRating: feedMinRating,
          error: errorText || undefined,
        },
      });
    };
    if (reset) setFeedBusy(true);
    else setFeedLoadingMore(true);

    let scopeUserIds: string[] | null = null;
    if (feedScope === "following") {
      const seed = Array.from(followingIdsRef.current);
      if (!seed.includes(userId)) seed.push(userId);
      if (seed.length <= 1) {
        const { data: followRows, error: followErr } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);
        if (followErr) {
          if (reset) setFeedBusy(false);
          else setFeedLoadingMore(false);
          markDbError(followErr.message);
          finishPerf(false, 0, followErr.message);
          return;
        }
        const fetched = ((followRows as FollowRow[] | null) ?? []).map((x) => x.following_id);
        scopeUserIds = Array.from(new Set([userId, ...fetched]));
      } else {
        scopeUserIds = seed;
      }

      if (!scopeUserIds.length) {
        if (reset) {
          setFeedItems([]);
          setFeedCommentsByCheckin({});
          setCommentPanelOpenByCheckin({});
          setCommentPanelLoadingByCheckin({});
          setCheckinLikeCountById({});
          setCheckinLikedByMe({});
          setCommentLikeCountById({});
          setCommentLikedByMe({});
        }
        if (reset) setFeedBusy(false);
        else setFeedLoadingMore(false);
        setFeedHasMore(false);
        finishPerf(true, 0);
        return;
      }
    }

    const lookbackHours = feedWindow === "24h" ? 24 : feedWindow === "7d" ? 24 * 7 : 0;
    const windowStartIso = lookbackHours > 0 ? new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString() : "";

    let query = supabase
      .from("checkins")
      .select("id, user_id, beer_name, rating, created_at, city, district")
      .order("created_at", { ascending: false })
      .limit(FEED_PAGE_SIZE);

    if (scopeUserIds) query = query.in("user_id", scopeUserIds);
    if (windowStartIso) query = query.gte("created_at", windowStartIso);
    if (feedMinRating > 0) query = query.gte("rating", feedMinRating);
    if (feedOnlyMyCity && primaryCity) query = query.eq("city", primaryCity);
    if (feedFormat === "draft") {
      query = query.ilike("beer_name", "%— Fici —%");
    } else if (feedFormat === "bottle") {
      query = query.or("beer_name.ilike.%— Şişe/Kutu —%,beer_name.ilike.%— Sise/Kutu —%");
    }

    if (!reset && feedCursorCreatedAt) {
      query = query.lt("created_at", feedCursorCreatedAt);
    }

    const { data: checkinRows, error: checkinErr } = await query;
    if (reset) setFeedBusy(false);
    else setFeedLoadingMore(false);

    if (checkinErr) {
      markDbError(checkinErr.message);
      finishPerf(false, 0, checkinErr.message);
      return;
    }

    const rows = (checkinRows as FeedCheckinRow[] | null) ?? [];
    if (!rows.length) {
      if (reset) {
        setFeedItems([]);
        setFeedCommentsByCheckin({});
        setCommentPanelOpenByCheckin({});
        setCommentPanelLoadingByCheckin({});
        setCheckinLikeCountById({});
        setCheckinLikedByMe({});
        setCommentLikeCountById({});
        setCommentLikedByMe({});
      }
      setFeedHasMore(false);
      finishPerf(true, 0);
      return;
    }

    const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .in("user_id", ownerIds);

    if (profileErr) {
      markDbError(profileErr.message);
      finishPerf(false, rows.length, profileErr.message);
      return;
    }

    const profileById = new Map<string, { username: string; display_name?: string | null }>();
    for (const p of (profileRows as Array<{ user_id: string; username: string; display_name?: string | null }> | null) ?? []) {
      profileById.set(p.user_id, { username: p.username, display_name: p.display_name });
    }

    const mapped = rows.map((r) => ({
      ...r,
      username: profileById.get(r.user_id)?.username ?? "kullanici",
      display_name: profileById.get(r.user_id)?.display_name ?? "",
    }));
    setFeedItems((prev) => {
      if (reset) return mapped;
      const existing = new Set(prev.map((x) => String(x.id)));
      const merged = [...prev, ...mapped.filter((x) => !existing.has(String(x.id)))];
      return merged;
    });
    if (reset) {
      setFeedCommentsByCheckin({});
      setCommentPanelOpenByCheckin({});
      setCommentPanelLoadingByCheckin({});
      setCommentLikeCountById({});
      setCommentLikedByMe({});
    }
    setFeedCursorCreatedAt(rows[rows.length - 1]?.created_at ?? null);
    setFeedHasMore(rows.length === FEED_PAGE_SIZE);
    const rowIds = rows.map((r) => String(r.id));
    const eagerIds = reset ? rowIds.slice(0, FEED_ENRICH_EAGER_COUNT) : rowIds;
    if (eagerIds.length) {
      void loadCheckinLikes(eagerIds);
    }
    if (reset && rowIds.length > eagerIds.length) {
      window.setTimeout(() => {
        void loadCheckinLikes(rowIds);
      }, 350);
    }
    trackEvent({ eventName: "feed_loaded", userId, props: { count: rows.length, reset } });
    finishPerf(true, rows.length);
  }

  async function loadCommentsForCheckins(checkinIds: string[]) {
    const ids = Array.from(new Set(checkinIds.filter(Boolean)));
    if (!ids.length) return;

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

  async function loadCheckinLikes(checkinIds: string[]) {
    const ids = Array.from(new Set(checkinIds.filter(Boolean)));
    if (!ids.length) {
      setCheckinLikeCountById({});
      setCheckinLikedByMe({});
      return;
    }
    const { data, error } = await supabase
      .from("checkin_likes")
      .select("checkin_id, user_id")
      .in("checkin_id", ids)
      .limit(5000);
    if (error) {
      markDbError(error.message);
      return;
    }
    const counts: Record<string, number> = {};
    const likedMap: Record<string, boolean> = {};
    for (const cid of ids) {
      counts[cid] = 0;
      likedMap[cid] = false;
    }
    for (const row of ((data as CheckinLikeRow[] | null) ?? [])) {
      const cid = String(row.checkin_id);
      counts[cid] = (counts[cid] || 0) + 1;
      if (row.user_id === userId) likedMap[cid] = true;
    }
    setCheckinLikeCountById((prev) => ({ ...prev, ...counts }));
    setCheckinLikedByMe((prev) => ({ ...prev, ...likedMap }));
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

  async function loadNotificationUnreadCount() {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      markDbError(error.message);
      return;
    }
    setNotifUnreadCountServer(Number(count || 0));
  }

  async function loadNotifications(limit = notifLimit) {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finishPerf = (ok: boolean, rowCount = 0, errorText = "") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.notifications.load",
        durationMs: ended - started,
        rowCount,
        ok,
        context: {
          limit,
          filter: notifFilter,
          error: errorText || undefined,
        },
      });
    };
    setNotifBusy(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, ref_id, payload, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    setNotifBusy(false);

    if (error) {
      markDbError(error.message);
      finishPerf(false, 0, error.message);
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
        finishPerf(false, rows.length, actorErr.message);
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
        actor_username: actor?.username || "system",
        actor_display_name: actor?.display_name || "",
      };
    });
    setNotifications(viewRows);
    setNotifLoaded(true);
    setNotifUnreadCountServer(
      viewRows.filter((n) => !n.is_read).length
    );
    finishPerf(true, viewRows.length);
  }

  async function markAllNotificationsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .in("id", unreadIds);
    if (error) {
      markDbError(error.message);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setNotifUnreadCountServer(0);
  }

  async function ensureFeedCheckinLoaded(checkinId: string) {
    const exists = feedIdsRef.current.includes(checkinId);
    if (exists) return true;

    const { data: row, error } = await supabase
      .from("checkins")
      .select("id, user_id, beer_name, rating, created_at, city, district")
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
        .slice(0, 200)
    );
    await loadCommentsForCheckins([String(checkin.id)]);
    await loadCheckinLikes([String(checkin.id)]);
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
      setNotifUnreadCountServer((prev) => Math.max(0, prev - 1));
    }
  }

  async function loadWeeklyHighlights() {
    setWeeklyBusy(true);
    const { data, error } = await supabase.rpc("get_weekly_highlights", {
      p_scope: weeklyScope,
    });
    setWeeklyBusy(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    const rows = ((data as WeeklyHighlightRow[] | null) ?? [])
      .slice()
      .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));
    const mapped: WeeklyTickerItem[] = rows.map((row) => ({
      key: row.item_key || `${row.label_tr || row.label_en || "item"}-${row.priority || 99}`,
      label: lang === "en" ? row.label_en || row.label_tr : row.label_tr || row.label_en,
      value: lang === "en" ? row.value_en || row.value_tr : row.value_tr || row.value_en,
      meta: lang === "en" ? row.meta_en || row.meta_tr : row.meta_tr || row.meta_en,
      href: (row.href || "").trim() || "/",
    }));
    setWeeklyItems(mapped);

    trackEvent({
      eventName: "weekly_highlights_loaded",
      userId,
      props: { scope: weeklyScope, count: mapped.length },
    });
  }

  async function loadLeaderboardLegacy() {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finishPerf = (ok: boolean, rowCount = 0, errorText = "") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.leaderboard.legacy",
        durationMs: ended - started,
        rowCount,
        ok,
        context: {
          window: leaderWindow,
          scope: leaderScope,
          error: errorText || undefined,
        },
      });
    };
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
      finishPerf(false, 0, checkinErr.message);
      return;
    }

    const rows = (checkinRows as Array<{ user_id: string; rating: number | null }> | null) ?? [];
    if (!rows.length) {
      if (leaderScope === "followed") {
        setLeaderRows([
          {
            user_id: userId,
            username: profile?.username || fallbackBase,
            display_name: profile?.display_name || profile?.username || fallbackBase,
            logs: 0,
            avgRating: 0,
          },
        ]);
        finishPerf(true, 1);
        return;
      }
      setLeaderRows([]);
      finishPerf(true, 0);
      return;
    }

    const agg = new Map<string, { logs: number; ratedCount: number; ratingSum: number }>();
    for (const row of rows) {
      const entry = agg.get(row.user_id) ?? { logs: 0, ratedCount: 0, ratingSum: 0 };
      entry.logs += 1;
      if (row.rating !== null && row.rating !== undefined && Number(row.rating) > 0) {
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
      finishPerf(false, rows.length, profileErr.message);
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

    if (leaderScope === "followed" && !result.some((x) => x.user_id === userId)) {
      result.push({
        user_id: userId,
        username: profile?.username || fallbackBase,
        display_name: profile?.display_name || profile?.username || fallbackBase,
        logs: 0,
        avgRating: 0,
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
    finishPerf(true, result.length);
  }

  async function loadLeaderboard() {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finishPerf = (ok: boolean, rowCount = 0, errorText = "", source = "rpc") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.leaderboard.load",
        durationMs: ended - started,
        rowCount,
        ok,
        context: {
          window: leaderWindow,
          scope: leaderScope,
          source,
          error: errorText || undefined,
        },
      });
    };
    setLeaderBusy(true);
    let data: any = null;
    let rpcErrorMessage = "";
    try {
      const rpcRes = await measurePerf(
        "social.leaderboard.rpc",
        async () => {
          const res = await supabase.rpc("get_social_leaderboard", {
            p_window: leaderWindow,
            p_scope: leaderScope,
          });
          if (res.error) throw new Error(res.error.message);
          return res;
        },
        {
          userId,
          context: { window: leaderWindow, scope: leaderScope },
        }
      );
      data = rpcRes.data;
    } catch (error: any) {
      rpcErrorMessage = String(error?.message || "");
    }
    setLeaderBusy(false);

    if (rpcErrorMessage) {
      if (isMissingFunctionError(rpcErrorMessage, "get_social_leaderboard")) {
        await loadLeaderboardLegacy();
        finishPerf(true, 0, "", "legacy_fallback");
        return;
      }
      markDbError(rpcErrorMessage);
      finishPerf(false, 0, rpcErrorMessage);
      return;
    }

    const rows = (data as LeaderboardRpcRow[] | null) ?? [];
    const mapped: LeaderboardRow[] = rows.map((row) => ({
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      logs: Number(row.logs || 0),
      avgRating: Math.round(Number(row.avg_rating || 0) * 100) / 100,
    }));
    if (leaderScope === "followed" && !mapped.some((x) => x.user_id === userId)) {
      mapped.push({
        user_id: userId,
        username: profile?.username || fallbackBase,
        display_name: profile?.display_name || profile?.username || fallbackBase,
        logs: 0,
        avgRating: 0,
      });
    }
    setLeaderRows(mapped.slice(0, 25));
    trackEvent({
      eventName: "leaderboard_loaded",
      userId,
      props: { scope: leaderScope, window: leaderWindow, count: mapped.length, source: "rpc" },
    });
    finishPerf(true, mapped.length);
  }

  async function loadPerfOverview(adminOverride = false) {
    const canRead = adminOverride || Boolean(profile?.is_admin);
    if (!canRead) {
      setPerfRows([]);
      return;
    }
    setPerfBusy(true);
    const { data, error } = await supabase
      .from("social_perf_overview_24h")
      .select("metric_key, total_calls, failed_calls, fail_rate_pct, avg_ms, p95_ms, max_ms, unique_users, last_seen_at")
      .order("p95_ms", { ascending: false, nullsFirst: false })
      .limit(6);
    setPerfBusy(false);

    if (error) {
      markDbError(error.message);
      return;
    }

    setPerfRows((data as PerfOverviewRow[] | null) ?? []);
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
    } else {
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
    }

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
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    let hasError = false;
    let firstError = "";
    const finishPerf = (ok: boolean, errorText = "") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.panel.bootstrap",
        durationMs: ended - started,
        ok,
        context: {
          error: errorText || undefined,
        },
      });
    };
    setLoading(true);
    setDbError(null);
    setNotifLoaded(false);
    setNotifications([]);

    const ensured = await reserveProfile();
    if (!ensured) {
      setLoading(false);
      finishPerf(false, "reserve_profile_failed");
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
        .select("beer_name, rating, created_at, day_period, city, district")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(CHECKIN_STATS_LIMIT),
    ]);

    if (favoritesRes.error) {
      markDbError(favoritesRes.error.message);
      hasError = true;
      if (!firstError) firstError = favoritesRes.error.message;
    } else {
      const normalized = ((favoritesRes.data as FavoriteBeerRow[] | null) ?? []).map((f) => ({
        ...f,
        beer_name: favoriteBeerName(f.beer_name),
      }));
      setFavorites(normalized);
    }

    if (checkinsRes.error) {
      markDbError(checkinsRes.error.message);
      hasError = true;
      if (!firstError) firstError = checkinsRes.error.message;
    } else {
      setCheckins((checkinsRes.data as CheckinRow[] | null) ?? []);
    }

    setLoading(false);

    void loadFollowing();
    feedFilterSigRef.current = [
      feedScope,
      feedWindow,
      feedFormat,
      String(feedMinRating),
      feedOnlyMyCity ? "1" : "0",
      feedOnlyMyCity ? primaryCity.toLowerCase() : "",
      feedScope === "following" ? Array.from(followingIdsRef.current).sort().join(",") : "",
    ].join("|");
    void loadFeed(true);
    void loadOwnRecentCheckins();
    void loadPendingInvites();
    void loadNotificationUnreadCount();
    void loadDiscoverProfiles();
    if (ensured.is_admin) void loadPerfOverview(true);
    else setPerfRows([]);
    if (notifPanelOpen) {
      void loadNotifications(notifLimit);
    }
    finishPerf(!hasError, firstError);
  }

  async function loadServerPreferences() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "notif_pref_follow, notif_pref_comment, notif_pref_mention, notif_pref_comment_like, notif_pref_checkin_like, feed_pref_scope, feed_pref_window, feed_pref_min_rating, feed_pref_format, feed_pref_only_my_city"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("column")) return;
      markDbError(error.message);
      return;
    }

    const row = ((data as ServerPreferenceRow | null) ?? {}) as ServerPreferenceRow;
    setNotifPrefs((prev) => ({
      follow: row.notif_pref_follow ?? prev.follow,
      comment: row.notif_pref_comment ?? prev.comment,
      mention: row.notif_pref_mention ?? prev.mention,
      comment_like: row.notif_pref_comment_like ?? prev.comment_like,
      checkin_like: row.notif_pref_checkin_like ?? prev.checkin_like,
    }));

    if (row.feed_pref_scope === "all" || row.feed_pref_scope === "following") setFeedScope(row.feed_pref_scope);
    if (row.feed_pref_window === "24h" || row.feed_pref_window === "7d" || row.feed_pref_window === "all") {
      setFeedWindow(row.feed_pref_window);
    }
    if (typeof row.feed_pref_min_rating === "number") setFeedMinRating(Number(row.feed_pref_min_rating));
    if (row.feed_pref_format === "all" || row.feed_pref_format === "draft" || row.feed_pref_format === "bottle") {
      setFeedFormat(row.feed_pref_format);
    }
    if (typeof row.feed_pref_only_my_city === "boolean") setFeedOnlyMyCity(row.feed_pref_only_my_city);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!profile) return;
    void loadServerPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${NOTIF_PREFS_KEY}:${userId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<NotifTypeKey, boolean>>;
      setNotifPrefs((prev) => ({
        follow: parsed.follow ?? prev.follow,
        comment: parsed.comment ?? prev.comment,
        mention: parsed.mention ?? prev.mention,
        comment_like: parsed.comment_like ?? prev.comment_like,
        checkin_like: parsed.checkin_like ?? prev.checkin_like,
      }));
    } catch {
      // ignore preference parse errors
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${NOTIF_PREFS_KEY}:${userId}`, JSON.stringify(notifPrefs));
  }, [notifPrefs, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${FEED_PREFS_KEY}:${userId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        scope?: FeedScope;
        window?: FeedWindow;
        minRating?: number;
        format?: FeedFormat;
        onlyMyCity?: boolean;
      };
      if (parsed.scope === "all" || parsed.scope === "following") setFeedScope(parsed.scope);
      if (parsed.window === "24h" || parsed.window === "7d" || parsed.window === "all") setFeedWindow(parsed.window);
      if (typeof parsed.minRating === "number") setFeedMinRating(parsed.minRating);
      if (parsed.format === "all" || parsed.format === "draft" || parsed.format === "bottle") setFeedFormat(parsed.format);
      if (typeof parsed.onlyMyCity === "boolean") setFeedOnlyMyCity(parsed.onlyMyCity);
    } catch {
      // ignore preference parse errors
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `${FEED_PREFS_KEY}:${userId}`,
      JSON.stringify({
        scope: feedScope,
        window: feedWindow,
        minRating: feedMinRating,
        format: feedFormat,
        onlyMyCity: feedOnlyMyCity,
      })
    );
  }, [feedFormat, feedMinRating, feedOnlyMyCity, feedScope, feedWindow, userId]);

  useEffect(() => {
    if (loading) return;
    const followingSig = feedScope === "following" ? Array.from(followingIds).sort().join(",") : "";
    const signature = [
      feedScope,
      feedWindow,
      feedFormat,
      String(feedMinRating),
      feedOnlyMyCity ? "1" : "0",
      feedOnlyMyCity ? primaryCity.toLowerCase() : "",
      followingSig,
    ].join("|");
    if (feedFilterSigRef.current === signature) return;
    feedFilterSigRef.current = signature;
    void loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, feedFormat, feedMinRating, feedOnlyMyCity, feedScope, feedWindow, followingIds, primaryCity]);

  useEffect(() => {
    if (!profile?.user_id) return;
    const timer = setTimeout(() => {
      void supabase
        .from("profiles")
        .update({
          notif_pref_follow: notifPrefs.follow,
          notif_pref_comment: notifPrefs.comment,
          notif_pref_mention: notifPrefs.mention,
          notif_pref_comment_like: notifPrefs.comment_like,
          notif_pref_checkin_like: notifPrefs.checkin_like,
          feed_pref_scope: feedScope,
          feed_pref_window: feedWindow,
          feed_pref_min_rating: feedMinRating,
          feed_pref_format: feedFormat,
          feed_pref_only_my_city: feedOnlyMyCity,
        })
        .eq("user_id", userId);
    }, 450);
    return () => clearTimeout(timer);
  }, [feedFormat, feedMinRating, feedOnlyMyCity, feedScope, feedWindow, notifPrefs, profile?.user_id, userId]);

  useEffect(() => {
    if (loading || !notifPanelOpen) return;
    void loadNotifications(notifLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, notifLimit, notifPanelOpen]);

  useEffect(() => {
    const q = normalizeUsername(searchQuery);
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchUsers();
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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
    notifPanelOpenRef.current = notifPanelOpen;
  }, [notifPanelOpen]);

  useEffect(() => {
    feedCommentsByCheckinRef.current = feedCommentsByCheckin;
    const map = new Map<number, string>();
    for (const [checkinId, comments] of Object.entries(feedCommentsByCheckin)) {
      for (const c of comments || []) {
        const cid = Number(c.id);
        if (Number.isFinite(cid)) map.set(cid, checkinId);
      }
    }
    commentToCheckinIdRef.current = map;
  }, [feedCommentsByCheckin]);

  useEffect(() => {
    commentPanelOpenByCheckinRef.current = commentPanelOpenByCheckin;
  }, [commentPanelOpenByCheckin]);

  useEffect(() => {
    feedIdsRef.current = feedItems.map((x) => String(x.id));
  }, [feedItems]);

  useEffect(() => {
    const node = feedLoadMoreRef.current;
    if (!node) return;
    if (feedBusy || feedLoadingMore || !feedHasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        void loadFeed(false);
      },
      { rootMargin: "180px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedBusy, feedHasMore, feedLoadingMore, filteredFeedItems.length]);

  useEffect(() => {
    void loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderScope, leaderWindow, followingIds]);

  useEffect(() => {
    if (!profile?.is_admin) {
      setPerfRows([]);
      return;
    }
    void loadPerfOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_admin]);

  useEffect(() => {
    if (loading) return;
    void loadWeeklyHighlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, weeklyScope, followingIds, lang]);

  function applyFeedPreset(preset: "discover" | "following" | "quality") {
    if (preset === "discover") {
      setFeedScope("all");
      setFeedWindow("24h");
      setFeedMinRating(0);
      setFeedFormat("all");
      setFeedOnlyMyCity(false);
      return;
    }
    if (preset === "following") {
      setFeedScope("following");
      setFeedWindow("7d");
      setFeedMinRating(0);
      setFeedFormat("all");
      setFeedOnlyMyCity(false);
      return;
    }
    setFeedScope("all");
    setFeedWindow("7d");
    setFeedMinRating(3.5);
    setFeedFormat("all");
    setFeedOnlyMyCity(false);
  }

  useEffect(() => {
    const channel = supabase
      .channel(`social-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        async (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id) return;
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkins", event: "INSERT" },
          });
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
              .slice(0, 200);
            return next;
          });
          scheduleLeaderboardRefresh();
          scheduleWeeklyHighlightsRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins" },
        async (payload) => {
          const row = payload.new as FeedCheckinRow;
          if (!row?.id) return;
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkins", event: "UPDATE" },
          });
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
          scheduleLeaderboardRefresh();
          scheduleWeeklyHighlightsRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "checkins" },
        (payload) => {
          const oldRow = payload.old as { id?: string; user_id?: string };
          if (!oldRow?.id) return;
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkins", event: "DELETE" },
          });
          setFeedItems((prev) => prev.filter((x) => x.id !== oldRow.id));
          scheduleLeaderboardRefresh();
          scheduleWeeklyHighlightsRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_comment_likes" },
        (payload) => {
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkin_comment_likes", event: String((payload as any)?.eventType || "").toUpperCase() || "*" },
          });
          const eventType = String((payload as any)?.eventType || "").toUpperCase();
          const nextRow = ((payload as any)?.new || {}) as CommentLikeRow;
          const prevRow = ((payload as any)?.old || {}) as CommentLikeRow;
          const commentId = Number(nextRow.comment_id ?? prevRow.comment_id ?? 0);
          if (!Number.isFinite(commentId) || commentId <= 0) return;

          setCommentLikeCountById((prev) => {
            const current = Number(prev[commentId] || 0);
            let next = current;
            if (eventType === "INSERT") next = current + 1;
            if (eventType === "DELETE") next = Math.max(0, current - 1);
            return next === current ? prev : { ...prev, [commentId]: next };
          });

          const actorId = String(nextRow.user_id || prevRow.user_id || "");
          if (actorId && actorId === userId) {
            setCommentLikedByMe((prev) => ({
              ...prev,
              [commentId]: eventType !== "DELETE",
            }));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_likes" },
        (payload) => {
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkin_likes", event: String((payload as any)?.eventType || "").toUpperCase() || "*" },
          });
          const eventType = String((payload as any)?.eventType || "").toUpperCase();
          const nextRow = ((payload as any)?.new || {}) as CheckinLikeRow;
          const prevRow = ((payload as any)?.old || {}) as CheckinLikeRow;
          const checkinId = String(nextRow.checkin_id || prevRow.checkin_id || "");
          if (!checkinId) return;

          setCheckinLikeCountById((prev) => {
            const current = Number(prev[checkinId] || 0);
            let next = current;
            if (eventType === "INSERT") next = current + 1;
            if (eventType === "DELETE") next = Math.max(0, current - 1);
            return next === current ? prev : { ...prev, [checkinId]: next };
          });

          const actorId = String(nextRow.user_id || prevRow.user_id || "");
          if (actorId && actorId === userId) {
            setCheckinLikedByMe((prev) => ({
              ...prev,
              [checkinId]: eventType !== "DELETE",
            }));
          }

          scheduleWeeklyHighlightsRefresh();
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
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "notifications", event: "*" },
          });
          void loadNotificationUnreadCount();
          if (notifPanelOpenRef.current) void loadNotifications();
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
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "follows", event: "*", side: "follower" },
          });
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
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "follows", event: "*", side: "following" },
          });
          void loadFollowing();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_comments" },
        (payload) => {
          trackPerfEvent({
            userId,
            metricKey: "social.realtime.event",
            rowCount: 1,
            context: { table: "checkin_comments", event: String((payload as any)?.eventType || "").toUpperCase() || "*" },
          });
          const nextRow = ((payload as any)?.new || {}) as { checkin_id?: string };
          const prevRow = ((payload as any)?.old || {}) as { checkin_id?: string };
          const checkinId = String(nextRow.checkin_id || prevRow.checkin_id || "");
          if (!checkinId) return;
          if (
            commentPanelOpenByCheckinRef.current[checkinId] ||
            Object.prototype.hasOwnProperty.call(feedCommentsByCheckinRef.current, checkinId)
          ) {
            void loadCommentsForCheckins([checkinId]);
          }
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
      if (weeklyRefreshTimerRef.current !== null) {
        window.clearTimeout(weeklyRefreshTimerRef.current);
        weeklyRefreshTimerRef.current = null;
      }
      if (leaderboardRefreshTimerRef.current !== null) {
        window.clearTimeout(leaderboardRefreshTimerRef.current);
        leaderboardRefreshTimerRef.current = null;
      }
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
      if (isFavoriteLimitExceededError(error.message)) {
        alert("En fazla 3 favori ekleyebilirsin.");
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
      .limit(SEARCH_SCAN_LIMIT);
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

  async function loadDiscoverProfiles() {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finishPerf = (ok: boolean, rowCount = 0, errorText = "", source = "rpc") => {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      trackPerfEvent({
        userId,
        metricKey: "social.discover.load",
        durationMs: ended - started,
        rowCount,
        ok,
        context: {
          source,
          error: errorText || undefined,
        },
      });
    };
    setDiscoverBusy(true);
    let rpcRows: DiscoverRpcRow[] | null = null;
    let rpcErrorMessage = "";
    try {
      const rpcRes = await measurePerf(
        "social.discover.rpc",
        async () => {
          const res = await supabase.rpc("get_discover_profiles", { p_limit: 12 });
          if (res.error) throw new Error(res.error.message);
          return res;
        },
        { userId, context: { limit: 12 } }
      );
      rpcRows = (rpcRes.data as DiscoverRpcRow[] | null) ?? [];
    } catch (error: any) {
      rpcErrorMessage = String(error?.message || "");
    }

    if (!rpcErrorMessage) {
      const mapped = ((rpcRows as DiscoverRpcRow[] | null) ?? []).map((row) => ({
        user_id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        bio: String(row.bio || ""),
        is_public: true,
        follower_count: Number(row.follower_count || 0),
        recent_logs_30d: Number(row.recent_logs_30d || 0),
      }));
      setDiscoverProfiles(mapped);
      setDiscoverBusy(false);
      finishPerf(true, mapped.length);
      return;
    }
    if (!isMissingFunctionError(rpcErrorMessage, "get_discover_profiles")) {
      setDiscoverBusy(false);
      markDbError(rpcErrorMessage);
      finishPerf(false, 0, rpcErrorMessage);
      return;
    }

    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, bio, is_public")
      .neq("user_id", userId)
      .eq("is_public", true)
      .order("username", { ascending: true })
      .limit(DISCOVER_SCAN_LIMIT);

    if (profileErr) {
      setDiscoverBusy(false);
      markDbError(profileErr.message);
      finishPerf(false, 0, profileErr.message, "legacy");
      return;
    }

    const base = (profiles as SearchProfile[] | null) ?? [];
    if (!base.length) {
      setDiscoverProfiles([]);
      setDiscoverBusy(false);
      finishPerf(true, 0, "", "legacy");
      return;
    }

    const ids = base.map((p) => p.user_id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: followerRows, error: followerErr }, { data: logRows, error: logErr }] = await Promise.all([
      supabase.from("follows").select("following_id").in("following_id", ids),
      supabase.from("checkins").select("user_id").in("user_id", ids).gte("created_at", since),
    ]);
    setDiscoverBusy(false);

    if (followerErr) {
      markDbError(followerErr.message);
      finishPerf(false, base.length, followerErr.message, "legacy");
      return;
    }
    if (logErr) {
      markDbError(logErr.message);
      finishPerf(false, base.length, logErr.message, "legacy");
      return;
    }

    const followerCount = new Map<string, number>();
    for (const row of ((followerRows as Array<{ following_id: string }> | null) ?? [])) {
      const id = String(row.following_id || "");
      if (!id) continue;
      followerCount.set(id, (followerCount.get(id) || 0) + 1);
    }

    const logCount = new Map<string, number>();
    for (const row of ((logRows as Array<{ user_id: string }> | null) ?? [])) {
      const id = String(row.user_id || "");
      if (!id) continue;
      logCount.set(id, (logCount.get(id) || 0) + 1);
    }

    const enriched = base
      .map((p) => ({
        ...p,
        follower_count: followerCount.get(p.user_id) || 0,
        recent_logs_30d: logCount.get(p.user_id) || 0,
      }))
      .sort((a, b) => {
        if (a.recent_logs_30d !== b.recent_logs_30d) return b.recent_logs_30d - a.recent_logs_30d;
        if (a.follower_count !== b.follower_count) return b.follower_count - a.follower_count;
        return a.username.localeCompare(b.username, "tr");
      })
      .slice(0, 12);

    setDiscoverProfiles(enriched);
    finishPerf(true, enriched.length, "", "legacy");
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

    void loadFollowing();
    scheduleLeaderboardRefresh();
    scheduleWeeklyHighlightsRefresh();
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

    void loadFollowing();
    scheduleLeaderboardRefresh();
    scheduleWeeklyHighlightsRefresh();
    trackEvent({ eventName: "follow_removed", userId, props: { target_user_id: target.user_id } });
  }

  async function addComment(checkinId: string) {
    const body = (commentDraftByCheckin[checkinId] || "").trim();
    if (!body) return;
    if (body.length > 240) {
      alert(tx(lang, "Yorum en fazla 240 karakter olabilir.", "Comment can be at most 240 characters."));
      return;
    }

    setCommentPanelOpenByCheckin((prev) => ({ ...prev, [checkinId]: true }));
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
    let mentionUsers: Array<{ user_id: string; username: string }> = [];
    if (mentionHandles.length) {
      const { data, error: mentionErr } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("username", mentionHandles)
        .limit(40);
      mentionUsers = (data as Array<{ user_id: string; username: string }> | null) ?? [];
      if (!mentionErr) {
        for (const u of mentionUsers) {
          if (u.user_id !== userId) recipients.add(u.user_id);
        }
      }
    }

    if (recipients.size) {
      const mentionSet = new Set<string>(mentionUsers.map((u) => u.user_id));

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

  async function toggleCheckinLike(item: FeedItem) {
    const checkinId = String(item.id);
    const liked = Boolean(checkinLikedByMe[checkinId]);
    setCheckinLikeBusyId(checkinId);
    if (liked) {
      const { error } = await supabase
        .from("checkin_likes")
        .delete()
        .eq("checkin_id", checkinId)
        .eq("user_id", userId);
      setCheckinLikeBusyId("");
      if (error) {
        markDbError(error.message);
        return;
      }
      setCheckinLikedByMe((prev) => ({ ...prev, [checkinId]: false }));
      setCheckinLikeCountById((prev) => ({ ...prev, [checkinId]: Math.max(0, Number(prev[checkinId] || 1) - 1) }));
      return;
    }

    const { error } = await supabase.from("checkin_likes").insert({
      checkin_id: checkinId,
      user_id: userId,
    });
    setCheckinLikeBusyId("");
    if (error) {
      markDbError(error.message);
      return;
    }

    setCheckinLikedByMe((prev) => ({ ...prev, [checkinId]: true }));
    setCheckinLikeCountById((prev) => ({ ...prev, [checkinId]: Number(prev[checkinId] || 0) + 1 }));
    if (item.user_id !== userId) {
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: item.user_id,
        actor_id: userId,
        type: "checkin_like",
        ref_id: checkinId,
        payload: { checkin_id: checkinId },
      });
      if (notifErr) markDbError(notifErr.message);
    }
  }

  async function reportContent(payload: {
    targetType: "checkin" | "comment";
    targetId: string;
    targetUserId?: string | null;
  }) {
    const key = `${payload.targetType}:${payload.targetId}`;
    if (reportBusyKey === key) return;
    setReportBusyKey(key);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: userId,
      target_user_id: payload.targetUserId || null,
      target_type: payload.targetType,
      target_id: payload.targetId,
      reason: "user_reported",
      status: "open",
    });
    setReportBusyKey("");
    if (error) {
      markDbError(error.message);
      return;
    }
    alert(tx(lang, "Rapor alindi.", "Report received."));
  }

  async function openNotification(item: NotificationView) {
    setNotifActionBusyId(item.id);
    if (!item.is_read) await markNotificationRead(item.id);
    if (item.type === "system") {
      setNotifActionBusyId(0);
      return;
    }
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
      setCommentPanelOpenByCheckin((prev) => ({ ...prev, [checkinId]: true }));
      await ensureCommentsLoaded(checkinId);
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
      alert(tx(lang, "Kendine davet gonderemezsin.", "You cannot send an invite to yourself."));
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
    alert(tx(lang, "Davet gonderildi.", "Invite sent."));
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
      alert(tx(lang, "Davet kabul edilemedi.", "Invite could not be accepted."));
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
        <LoadingPulse lang={lang} labelTr="Sosyal panel yukleniyor..." labelEn="Loading social panel..." />
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">{tx(lang, "Sosyal", "Social")}</div>
          <div className="text-lg font-semibold">{tx(lang, "Profil ve takip", "Profile and follow")}</div>
        </div>
        {profile ? (
          <Link className="text-xs underline opacity-80" href={`/u/${profile.username}`}>
            {tx(lang, "Profilini gor", "View your profile")}
          </Link>
        ) : null}
      </div>

      {dbError ? (
        <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-100">
          {dbError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <div className="sticky top-2 z-20 min-w-0">
          <WeeklyTickerBar
            lang={lang}
            scope={weeklyScope}
            onScopeChange={setWeeklyScope}
            onRefresh={() => void loadWeeklyHighlights()}
            items={weeklyItems}
            busy={weeklyBusy}
          />
        </div>

        {profile?.is_admin ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-cyan-200/85">
                  {tx(lang, "Admin gozlem", "Admin observability")}
                </div>
                <div className="text-sm font-semibold">
                  {tx(lang, "Sosyal performans (son 24s)", "Social performance (last 24h)")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadPerfOverview()}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
              >
                {tx(lang, "Yenile", "Refresh")}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {perfRiskRows.length ? (
                <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-100">
                  {tx(lang, "Uyari:", "Alert:")} {perfRiskRows.length} {tx(lang, "metrikte p95/fail esigi asildi.", "metrics exceed p95/fail threshold.")}
                </div>
              ) : null}
              {perfRows.map((row) => {
                const failRate = Number(row.fail_rate_pct || 0);
                const p95 = Number(row.p95_ms || 0);
                const isRisk = failRate >= 5 || p95 >= 900;
                const isWarn = !isRisk && (failRate >= 1 || p95 >= 500);
                return (
                  <div
                    key={`perf-${row.metric_key}`}
                    className={`rounded-xl border p-2 ${
                      isRisk
                        ? "border-red-400/35 bg-red-500/10"
                        : isWarn
                        ? "border-amber-300/35 bg-amber-500/10"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-xs font-medium">{row.metric_key}</div>
                      <div className="text-[11px] opacity-75">
                        {tx(lang, "Cagri", "Calls")}: {row.total_calls}
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] opacity-80 md:grid-cols-4">
                      <div>p95: {p95.toFixed(0)}ms</div>
                      <div>avg: {Number(row.avg_ms || 0).toFixed(0)}ms</div>
                      <div>fail: {failRate.toFixed(2)}%</div>
                      <div>{tx(lang, "kullanici", "users")}: {row.unique_users}</div>
                    </div>
                  </div>
                );
              })}
              {perfBusy ? (
                <LoadingPulse
                  lang={lang}
                  labelTr="Perf metrikleri yukleniyor..."
                  labelEn="Loading performance metrics..."
                  compact
                  inline
                  className="text-xs"
                />
              ) : null}
              {!perfBusy && !perfRows.length ? (
                <div className="text-xs opacity-60">
                  {tx(lang, "Perf verisi henuz yok.", "No performance data yet.")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs opacity-70">
              {tx(lang, "Baglantilar", "Connections")} • {followingProfiles.length}/{followerProfiles.length}
            </div>
            <button
              type="button"
              onClick={() => setConnectionsMenuOpen((v) => !v)}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
            >
              {connectionsMenuOpen ? tx(lang, "Gizle", "Hide") : tx(lang, "Ac", "Open")}
            </button>
          </div>
          {connectionsMenuOpen ? <div className="mt-2 grid grid-cols-2 gap-2">
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
              <div className="text-xs opacity-70">{tx(lang, "Takip edilen", "Following")}</div>
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
              <div className="text-xs opacity-70">{tx(lang, "Takipci", "Followers")}</div>
              <div className="text-lg font-semibold">{followerProfiles.length}</div>
            </button>
          </div> : null}

          {connectionsMenuOpen && relationsOpen ? (
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
                        <div className="text-[11px] text-amber-200/85">{tx(lang, "Seni takip ediyor", "Follows you")}</div>
                      ) : null}
                    </div>
                    {isFollowersView ? (
                      <button
                        type="button"
                        onClick={() => void (isFollowing ? unfollow(p) : follow(p))}
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                      >
                        {isFollowing ? tx(lang, "Takiptesin", "Following") : tx(lang, "Takip et", "Follow")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void unfollow(p)}
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                      >
                        {tx(lang, "Cikar", "Remove")}
                      </button>
                    )}
                  </div>
                );
              })}
              {(relationView === "following" ? followingProfiles.length : followerProfiles.length) === 0 ? (
                <div className="text-xs opacity-60">
                  {relationView === "following"
                    ? tx(lang, "Henuz kimseyi takip etmiyorsun.", "You are not following anyone yet.")
                    : tx(lang, "Henuz takipcin yok.", "No followers yet.")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">{tx(lang, "Kullanici ara ve takip et", "Search users and follow")}</div>
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
              placeholder={tx(lang, "handle veya isim ara", "search handle or name")}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void searchUsers()}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
            >
              {searchBusy ? "..." : tx(lang, "Ara", "Search")}
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
                      <div className="text-[11px] text-amber-200/85">{tx(lang, "Seni takip ediyor", "Follows you")}</div>
                    ) : null}
                    {p.bio ? <div className="truncate text-xs opacity-70">{p.bio}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void (isFollowing ? unfollow(p) : follow(p))}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                  >
                    {isFollowing ? tx(lang, "Takibi birak", "Unfollow") : tx(lang, "Takip et", "Follow")}
                  </button>
                </div>
              );
            })}
            {!searchBusy && normalizeUsername(searchQuery).length >= 3 && searchResults.length === 0 ? (
              <div className="text-xs opacity-60">{tx(lang, "Arama sonucu yok.", "No results.")}</div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs opacity-70">{tx(lang, "Kullanici kesfet", "Discover users")}</div>
              <button
                type="button"
                onClick={() => void loadDiscoverProfiles()}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
              >
                {discoverBusy ? "..." : tx(lang, "Yenile", "Refresh")}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {discoverProfiles.map((p) => {
                const isFollowing = followingIds.has(p.user_id);
                return (
                  <div
                    key={`discover-${p.user_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-2"
                  >
                    <div className="min-w-0">
                      <Link href={`/u/${p.username}`} className="truncate text-sm underline">
                        {visibleName(p)}
                      </Link>
                      <div className="truncate text-[11px] opacity-65">@{p.username}</div>
                      <div className="text-[11px] opacity-70">
                        {tx(lang, "30g log", "30d logs")}: {p.recent_logs_30d} • {tx(lang, "Takipci", "Followers")}: {p.follower_count}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void (isFollowing ? unfollow(p) : follow(p))}
                      className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                    >
                      {isFollowing ? tx(lang, "Takiptesin", "Following") : tx(lang, "Takip et", "Follow")}
                    </button>
                  </div>
                );
              })}
              {!discoverBusy && discoverProfiles.length === 0 ? (
                <div className="text-xs opacity-60">{tx(lang, "Kesfet icin uygun profil yok.", "No profiles to discover.")}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-amber-200/90">
              {tx(lang, "Bildirimler", "Notifications")} {unreadNotifCount ? `(${unreadNotifCount} ${tx(lang, "yeni", "new")})` : ""}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotifPanelOpen((v) => !v)}
                className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[11px]"
              >
                {notifPanelOpen ? tx(lang, "Kapat", "Close") : tx(lang, "Ac", "Open")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotifLimit(NOTIF_PAGE_SIZE);
                  void loadNotifications(NOTIF_PAGE_SIZE);
                }}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
              >
                {tx(lang, "Yenile", "Refresh")}
              </button>
            </div>
          </div>
          {notifPanelOpen ? (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                {([
                  ["follow", tx(lang, "Takip", "Follow")],
                  ["comment", tx(lang, "Yorum", "Comment")],
                  ["mention", "Mention"],
                  ["comment_like", tx(lang, "Yorum begeni", "Comment like")],
                  ["checkin_like", tx(lang, "Log begeni", "Check-in like")],
                ] as Array<[NotifTypeKey, string]>).map(([key, label]) => (
                  <label key={`notif-pref-${key}`} className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={notifPrefs[key]}
                      onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="h-3.5 w-3.5 accent-amber-400"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={notifFilter}
                  onChange={(e) => setNotifFilter(e.target.value as NotificationFilter)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] outline-none"
                >
                  <option value="all">{tx(lang, "Tumu", "All")}</option>
                  <option value="unread">{tx(lang, "Sadece okunmamis", "Unread only")}</option>
                  <option value="follow">{tx(lang, "Takip", "Follow")}</option>
                  <option value="comment">{tx(lang, "Yorum", "Comment")}</option>
                  <option value="mention">Mention</option>
                  <option value="comment_like">{tx(lang, "Yorum begeni", "Comment like")}</option>
                  <option value="checkin_like">{tx(lang, "Log begeni", "Check-in like")}</option>
                  <option value="system">{tx(lang, "Sistem", "System")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
                >
                  {tx(lang, "Tumunu okundu yap", "Mark all read")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNotifSummaryMode((v) => !v)}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
              >
                {notifSummaryMode ? tx(lang, "Tek tek gor", "Single view") : tx(lang, "Ozet gorunumu", "Summary view")}
              </button>
              {notifSummaryMode
                ? notificationSummaries.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => void openNotification(g.latest)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-2 text-left"
                    >
                      <div className="text-xs">
                        {g.actor} • {g.type} • {g.count} {tx(lang, "adet", "items")}
                      </div>
                      <div className="mt-1 text-[11px] opacity-65">
                        {new Date(g.latest.created_at).toLocaleString(locale)}
                      </div>
                    </button>
                  ))
                : filteredNotifications.map((n) => (
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
                        {n.actor_username === "system" ? (
                          <span className="font-semibold">{tx(lang, "Birader", "Birader")}</span>
                        ) : (
                          <Link
                            href={`/u/${encodeURIComponent(n.actor_username)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="underline"
                          >
                            {visibleName({ username: n.actor_username, display_name: n.actor_display_name })}
                          </Link>
                        )}
                        {n.type === "comment" ? tx(lang, " loguna yorum yazdi.", " commented on your check-in.") : null}
                        {n.type === "mention" ? tx(lang, " seni yorumda etiketledi.", " mentioned you in a comment.") : null}
                        {n.type === "comment_like" ? tx(lang, " yorumunu begendi.", " liked your comment.") : null}
                        {n.type === "checkin_like" ? tx(lang, " logunu begendi.", " liked your check-in.") : null}
                        {n.type === "follow" ? tx(lang, " seni takip etmeye basladi.", " started following you.") : null}
                        {n.type === "system"
                          ? ` ${String(((n.payload || {}) as Record<string, any>)[lang === "en" ? "message_en" : "message_tr"] || "")}`
                          : null}
                      </div>
                      <div className="mt-1 text-[11px] opacity-65">{new Date(n.created_at).toLocaleString(locale)}</div>
                    </div>
                  ))}
              {notifBusy ? (
                <LoadingPulse
                  lang={lang}
                  labelTr="Bildirimler yukleniyor..."
                  labelEn="Loading notifications..."
                  compact
                  inline
                  className="text-xs"
                />
              ) : null}
              {!notifBusy && !filteredNotifications.length ? (
                <div className="text-xs opacity-60">{tx(lang, "Bildirim yok.", "No notifications.")}</div>
              ) : null}
              {notifications.length >= notifLimit ? (
                <button
                  type="button"
                  onClick={() => setNotifLimit((v) => v + NOTIF_PAGE_SIZE)}
                  className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                >
                  Daha fazla bildirim
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">{tx(lang, "Birlikte icildi davetleri", "Shared drink invites")}</div>
          <div className="mt-2 space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/u/${inv.inviter_username}`} className="truncate text-xs underline opacity-80">
                      {visibleName({ username: inv.inviter_username, display_name: inv.inviter_display_name })}
                    </Link>
                    <div className="truncate text-sm font-semibold">{inv.source_beer_name}</div>
                    <div className="text-[11px] opacity-65">{new Date(inv.source_created_at).toLocaleString(locale)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void declineInvite(inv.id)}
                      className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs"
                    >
                      {tx(lang, "Ret", "Decline")}
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void acceptInvite(inv.id)}
                      className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-xs"
                    >
                      {tx(lang, "Kabul et", "Accept")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!pendingInvites.length ? (
              <div className="text-xs opacity-60">{tx(lang, "Bekleyen davet yok.", "No pending invites.")}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs opacity-70">{tx(lang, "Kendi loguna kisi ekle", "Add someone to your log")}</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <select
              value={inviteSourceCheckinId}
              onChange={(e) => setInviteSourceCheckinId(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              {ownRecentCheckins.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.beer_name} - {new Date(c.created_at).toLocaleString(locale)}
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
              {inviteCreating ? tx(lang, "Gonderiliyor...", "Sending...") : tx(lang, "Davet gonder", "Send invite")}
            </button>
          </div>
          {!ownRecentCheckins.length ? (
            <div className="mt-2 text-xs opacity-60">{tx(lang, "Davet icin once en az bir logun olmasi gerekiyor.", "You need at least one log before sending invites.")}</div>
          ) : null}
          {!followingProfiles.length ? (
            <div className="mt-2 text-xs opacity-60">{tx(lang, "Davet icin once birini takip etmen gerekiyor.", "You need to follow someone before sending invites.")}</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">{tx(lang, "Leaderboard", "Leaderboard")}</div>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              {tx(lang, "Yenile", "Refresh")}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
              {[
                { key: "7d", label: tx(lang, "Hft", "Wk") },
                { key: "30d", label: tx(lang, "Ay", "Mo") },
                { key: "90d", label: tx(lang, "3Ay", "3Mo") },
                { key: "365d", label: tx(lang, "Yil", "Yr") },
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
            {leaderBusy ? (
              <LoadingPulse
                lang={lang}
                labelTr="Leaderboard yukleniyor..."
                labelEn="Loading leaderboard..."
                compact
                inline
                className="text-xs"
              />
            ) : null}
            {!leaderBusy && !leaderRows.length ? (
              <div className="text-xs opacity-60">{tx(lang, "Bu filtrede leaderboard verisi yok.", "No leaderboard data for this filter.")}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">{tx(lang, "Rozet ilerlemen", "Badge progress")}</div>
            <div className="text-[11px] opacity-65">
              {badgeProgressRows.filter((x) => x.done).length}/{badgeProgressRows.length} {tx(lang, "tamam", "done")}
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {badgeProgressRows.slice(0, 4).map((item) => {
              const meta = badgeMetaForKey(item.key);
              return (
              <div key={`badge-progress-${item.key}`} className="rounded-xl border border-white/10 bg-black/25 p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>{meta.icon} {lang === "en" ? item.titleEn : item.titleTr}</span>
                  <span className={item.done ? "text-emerald-300" : "opacity-80"}>
                    {item.done ? tx(lang, "Acildi", "Unlocked") : `${Math.round(item.progress * 100)}%`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.done ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${Math.max(6, Math.round(item.progress * 100))}%` }}
                  />
                </div>
                {!item.done ? (
                  <div className="mt-1 text-[11px] opacity-70">{lang === "en" ? item.hintEn : item.hintTr}</div>
                ) : null}
                <div className="mt-1 text-[10px] opacity-55">{lang === "en" ? meta.ruleEn : meta.ruleTr}</div>
              </div>
            )})}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs opacity-70">{tx(lang, "Sosyal akis", "Social feed")}</div>
            <button
              type="button"
              onClick={() => void loadFeed(true)}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
            >
              {tx(lang, "Yenile", "Refresh")}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyFeedPreset("discover")}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
            >
              {tx(lang, "Kesfet", "Discover")}
            </button>
            <button
              type="button"
              onClick={() => applyFeedPreset("following")}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
            >
              {tx(lang, "Takip", "Following")}
            </button>
            <button
              type="button"
              onClick={() => applyFeedPreset("quality")}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
            >
              {tx(lang, "Kaliteli", "Quality")}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <select
              value={feedScope}
              onChange={(e) => setFeedScope(e.target.value as FeedScope)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="all">{tx(lang, "Tum akis", "All feed")}</option>
              <option value="following">{tx(lang, "Takip ettiklerim", "Following only")}</option>
            </select>
            <select
              value={feedWindow}
              onChange={(e) => setFeedWindow(e.target.value as FeedWindow)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="24h">{tx(lang, "Son 24s", "Last 24h")}</option>
              <option value="7d">{tx(lang, "Son 7g", "Last 7d")}</option>
              <option value="all">{tx(lang, "Tum zaman", "All time")}</option>
            </select>
            <select
              value={feedMinRating}
              onChange={(e) => setFeedMinRating(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value={0}>{tx(lang, "Her puan", "Any rating")}</option>
              <option value={2.5}>2.5⭐+</option>
              <option value={3}>3⭐+</option>
              <option value={3.5}>3.5⭐+</option>
              <option value={4}>4⭐+</option>
            </select>
            <input
              value={feedQuery}
              onChange={(e) => setFeedQuery(e.target.value)}
              placeholder={tx(lang, "@kisi / bira", "@user / beer")}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            <select
              value={feedFormat}
              onChange={(e) => setFeedFormat(e.target.value as FeedFormat)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"
            >
              <option value="all">{tx(lang, "Tum formatlar", "All formats")}</option>
              <option value="draft">{tx(lang, "Sadece fici", "Draft only")}</option>
              <option value="bottle">{tx(lang, "Sadece sise/kutu", "Bottle/can only")}</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs">
              <input
                type="checkbox"
                checked={feedOnlyMyCity}
                disabled={!primaryCity}
                onChange={(e) => setFeedOnlyMyCity(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              <span>
                {primaryCity
                  ? tx(lang, `Sadece ${primaryCity}`, `Only ${primaryCity}`)
                  : tx(lang, "Sehir verin yok", "No city data")}
              </span>
            </label>
          </div>

          <div className="mt-2 space-y-2">
            {filteredFeedItems.map((item) => {
              const checkinId = String(item.id);
              const commentsOpen = Boolean(commentPanelOpenByCheckin[checkinId]);
              const commentsBusy = Boolean(commentPanelLoadingByCheckin[checkinId]);
              const comments = feedCommentsByCheckin[checkinId] || [];
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${
                    highlightCheckinId === checkinId
                      ? "border-amber-300/45 bg-amber-500/10 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]"
                      : "border-white/10 bg-black/25"
                  }`}
                >
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/u/${item.username}`} className="text-xs underline opacity-80">
                    {visibleName(item)}
                  </Link>
                  <div className="text-xs opacity-70">
                    {new Date(item.created_at).toLocaleString(locale)}
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold">{item.beer_name}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingStars value={item.rating} size="xs" unratedLabel={tx(lang, "Puansiz", "Unrated")} className="opacity-90" />
                    <button
                      type="button"
                      disabled={checkinLikeBusyId === checkinId}
                      onClick={() => void toggleCheckinLike(item)}
                      className={`rounded-lg border px-2 py-1 text-xs ${
                        checkinLikedByMe[checkinId]
                          ? "border-amber-300/35 bg-amber-500/15"
                          : "border-white/15 bg-white/10"
                      }`}
                    >
                      ♥ {checkinLikeCountById[checkinId] || 0}
                    </button>
                    <button
                      type="button"
                      disabled={reportBusyKey === `checkin:${checkinId}`}
                      onClick={() =>
                        void reportContent({
                          targetType: "checkin",
                          targetId: checkinId,
                          targetUserId: item.user_id,
                        })
                      }
                      className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px]"
                    >
                      {tx(lang, "Rapor", "Report")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickLog?.({ beerName: item.beer_name, rating: Number(item.rating ?? 0) });
                      trackEvent({
                        eventName: "feed_quicklog_click",
                        userId,
                        props: { source_user_id: item.user_id, beer_name: item.beer_name },
                      });
                    }}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                  >
                    {tx(lang, "Bunu da logla", "Log this too")}
                  </button>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => toggleCommentPanel(checkinId)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[11px]"
                  >
                    {commentsOpen ? tx(lang, "Yorumlari gizle", "Hide comments") : tx(lang, "Yorumlari ac", "Show comments")} ({comments.length})
                  </button>
                </div>

                {commentsOpen ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-[11px] opacity-70">
                    {tx(lang, "Yorumlar", "Comments")} ({comments.length})
                  </div>
                  <div className="mt-1 max-h-28 space-y-1 overflow-auto">
                    {comments.map((c) => (
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
                          <button
                            type="button"
                            disabled={reportBusyKey === `comment:${String(c.id)}`}
                            onClick={() =>
                              void reportContent({
                                targetType: "comment",
                                targetId: String(c.id),
                                targetUserId: c.user_id,
                              })
                            }
                            className="shrink-0 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px]"
                          >
                            {tx(lang, "Rapor", "Report")}
                          </button>
                        </div>
                      </div>
                    ))}
                    {commentsBusy ? (
                      <div className="text-[11px] opacity-55">{tx(lang, "Yorumlar yukleniyor...", "Loading comments...")}</div>
                    ) : null}
                    {!commentsBusy && !comments.length ? (
                      <div className="text-[11px] opacity-55">{tx(lang, "Henuz yorum yok.", "No comments yet.")}</div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={commentDraftByCheckin[checkinId] || ""}
                      onChange={(e) =>
                        setCommentDraftByCheckin((prev) => ({ ...prev, [checkinId]: e.target.value }))
                      }
                      placeholder={tx(lang, "Yorum yaz... (mention: @kullanici)", "Write a comment... (mention: @user)")}
                      maxLength={240}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                    />
                    <button
                      type="button"
                      disabled={commentSendingFor === checkinId}
                      onClick={() => void addComment(checkinId)}
                      className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs"
                    >
                      {commentSendingFor === checkinId ? "..." : tx(lang, "Gonder", "Send")}
                    </button>
                  </div>
                </div>
                ) : null}
              </div>
            )})}

            {feedBusy ? (
              <LoadingPulse
                lang={lang}
                labelTr="Sosyal akis doluyor..."
                labelEn="Pouring social feed..."
                compact
              />
            ) : null}
            {!feedBusy && !filteredFeedItems.length ? (
              <div className="text-xs opacity-60">{tx(lang, "Akista gosterilecek log yok.", "No feed logs to show.")}</div>
            ) : null}
            {!feedBusy && feedHasMore ? (
              <>
                <button
                  type="button"
                  disabled={feedLoadingMore}
                  onClick={() => void loadFeed(false)}
                  className="w-full rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs disabled:opacity-50"
                >
                  {feedLoadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-white/30 border-t-amber-300 animate-spin" />
                      {tx(lang, "Devam ediyor...", "Continuing...")}
                    </span>
                  ) : (
                    tx(lang, "Daha fazla log yukle", "Load more check-ins")
                  )}
                </button>
                <div ref={feedLoadMoreRef} className="h-2 w-full" />
              </>
            ) : null}
          </div>
        </div>

      </div>
    </section>
  );
}
