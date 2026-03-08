export interface Badge {
  id: number;
  emoji: string;
  name: string;
  nameTR: string;
  tier: string;
  tierTR: string;
  trigger: string;
  triggerTR: string;
  description: string;
  descriptionTR: string;
  color: string;
  rare: boolean;
  unlocked: boolean;
}

export type BadgeEvent = {
  type:
    | "checkin_logged"
    | "checkin_updated"
    | "checkin_deleted"
    | "session_shared"
    | "manual_sync";
  timestamp?: string;
  payload?: {
    sessionPeople?: number;
    sessionBeerCount?: number;
    venue?: string | null;
    isNewVenue?: boolean;
    friendsCount?: number;
    rating?: number | null;
    priceTry?: number | null;
  };
};

export type BadgeCheckin = {
  id?: string;
  beer_name?: string | null;
  created_at: string;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
  note?: string | null;
  rating?: number | null;
  price_try?: number | null;
  day_period?: string | null;
};

export type BadgeProgress = {
  current: number;
  target: number;
  ratio: number;
  countable: boolean;
  label: string;
  labelTR: string;
};

export type BadgeEvaluation = {
  badges: Badge[];
  progressById: Record<number, BadgeProgress>;
  unlockedIds: number[];
};

export type BadgeUnlockCheckResult = BadgeEvaluation & {
  newlyUnlocked: number[];
  unlockedAtById: Record<number, string>;
};

export const BADGE_STORAGE_PREFIX = "birader:badge-unlocked-at:v2:";

const BASE_BADGES: Omit<Badge, "unlocked">[] = [
  {
    id: 1,
    emoji: "🥇",
    name: "First Sip",
    nameTR: "İlk Yudum",
    tier: "Milestone",
    tierTR: "Kilometre Taşı",
    trigger: "Log your first beer",
    triggerTR: "İlk biranı logla",
    description: "Every story starts with one sip.",
    descriptionTR: "Her hikaye bir yudumla başlar.",
    color: "#F59E0B",
    rare: false,
  },
  {
    id: 2,
    emoji: "🔟",
    name: "Ten Down",
    nameTR: "Ona Tamam",
    tier: "Milestone",
    tierTR: "Kilometre Taşı",
    trigger: "10 total beers logged",
    triggerTR: "Toplam 10 bira logla",
    description: "You found your rhythm.",
    descriptionTR: "Ritmini buldun.",
    color: "#D97706",
    rare: false,
  },
  {
    id: 3,
    emoji: "💯",
    name: "The Hundred",
    nameTR: "Yüzlük",
    tier: "Milestone",
    tierTR: "Kilometre Taşı",
    trigger: "100 total beers logged",
    triggerTR: "Toplam 100 bira logla",
    description: "Consistency unlocked.",
    descriptionTR: "İstikrar açıldı.",
    color: "#DC2626",
    rare: false,
  },
  {
    id: 4,
    emoji: "👑",
    name: "Half-Thousand",
    nameTR: "Beş Yüzlük",
    tier: "Milestone",
    tierTR: "Kilometre Taşı",
    trigger: "500 total beers logged",
    triggerTR: "Toplam 500 bira logla",
    description: "A legendary logbook.",
    descriptionTR: "Efsanevi bir günlük.",
    color: "#FBBF24",
    rare: true,
  },
  {
    id: 5,
    emoji: "🔥",
    name: "On a Roll",
    nameTR: "Seri Yakalayan",
    tier: "Streak",
    tierTR: "Seri",
    trigger: "7 consecutive days with a log",
    triggerTR: "Arka arkaya 7 gün log at",
    description: "Seven days, no breaks.",
    descriptionTR: "Yedi gün, durmak yok.",
    color: "#EF4444",
    rare: false,
  },
  {
    id: 6,
    emoji: "🗓️",
    name: "Month Regular",
    nameTR: "Aylık Müdavim",
    tier: "Streak",
    tierTR: "Seri",
    trigger: "Log every week for a full month",
    triggerTR: "Tam bir ay boyunca her hafta log at",
    description: "Weeks don’t skip you anymore.",
    descriptionTR: "Artık haftalar seni atlamıyor.",
    color: "#A16207",
    rare: false,
  },
  {
    id: 7,
    emoji: "🍺",
    name: "Draft Devotee",
    nameTR: "Fıçıya Sadık",
    tier: "Format",
    tierTR: "Format",
    trigger: "20 draft (fıçı) beers logged",
    triggerTR: "20 fıçı bira logla",
    description: "Tap handle loyalist.",
    descriptionTR: "Musluk sadakati onaylandı.",
    color: "#F59E0B",
    rare: false,
  },
  {
    id: 8,
    emoji: "🍾",
    name: "Bottle Loyalist",
    nameTR: "Şişe Bağlısı",
    tier: "Format",
    tierTR: "Format",
    trigger: "20 bottle (şişe) beers logged",
    triggerTR: "20 şişe bira logla",
    description: "Classic shelf discipline.",
    descriptionTR: "Klasik raf disiplini.",
    color: "#0EA5E9",
    rare: false,
  },
  {
    id: 9,
    emoji: "⚖️",
    name: "50/50",
    nameTR: "Yarı Yarıya",
    tier: "Format",
    tierTR: "Format",
    trigger: "Equal split of draft and bottle logs",
    triggerTR: "Fıçı ve şişe loglarında eşit dağılım",
    description: "Perfectly balanced preferences.",
    descriptionTR: "Mükemmel dengeli tercihler.",
    color: "#14B8A6",
    rare: false,
  },
  {
    id: 10,
    emoji: "🌅",
    name: "Sunrise Sipper",
    nameTR: "Şafak Yudumcusu",
    tier: "Time",
    tierTR: "Zaman",
    trigger: "Log before 10 AM",
    triggerTR: "Saat 10:00’dan önce log at",
    description: "Early hours, early cheers.",
    descriptionTR: "Erken saatler, erken şerefe.",
    color: "#FB923C",
    rare: false,
  },
  {
    id: 11,
    emoji: "🌙",
    name: "Midnight Monk",
    nameTR: "Gece Yarısı Rahibi",
    tier: "Time",
    tierTR: "Zaman",
    trigger: "Log between 00:00–03:00",
    triggerTR: "00:00–03:00 arasında log at",
    description: "City sleeps, you sip.",
    descriptionTR: "Şehir uyur, sen yudumlarsın.",
    color: "#6366F1",
    rare: false,
  },
  {
    id: 12,
    emoji: "🦁",
    name: "Solo Lion",
    nameTR: "Yalnız Aslan",
    tier: "Session",
    tierTR: "Oturum",
    trigger: "15 solo sessions logged",
    triggerTR: "15 solo oturum logla",
    description: "Strong alone, still social.",
    descriptionTR: "Tek başına güçlü, yine sosyal.",
    color: "#D97706",
    rare: false,
  },
  {
    id: 13,
    emoji: "🤝",
    name: "Birader",
    nameTR: "Birader",
    tier: "Session",
    tierTR: "Oturum",
    trigger: "Log a session with 3+ friends",
    triggerTR: "3+ arkadaşla bir oturum logla",
    description: "Good beer becomes better together.",
    descriptionTR: "İyi bira, birlikte daha iyi.",
    color: "#F59E0B",
    rare: true,
  },
  {
    id: 14,
    emoji: "🏠",
    name: "The Regular",
    nameTR: "Müdavim",
    tier: "Venue",
    tierTR: "Mekan",
    trigger: "Check in at same venue 10 times",
    triggerTR: "Aynı mekanda 10 check-in yap",
    description: "They know your usual.",
    descriptionTR: "Seni artık ezbere biliyorlar.",
    color: "#78716C",
    rare: false,
  },
  {
    id: 15,
    emoji: "🧊",
    name: "Ice Breaker",
    nameTR: "Buzkıran",
    tier: "Venue",
    tierTR: "Mekan",
    trigger: "First ever check-in at a new venue",
    triggerTR: "Yeni bir mekana ilk check-in’i yap",
    description: "You break the silence first.",
    descriptionTR: "Sessizliği ilk sen bozarsın.",
    color: "#06B6D4",
    rare: false,
  },
  {
    id: 16,
    emoji: "🎉",
    name: "Party Animal",
    nameTR: "Eğlence Canavarı",
    tier: "Session",
    tierTR: "Oturum",
    trigger: "5+ beers in a single session",
    triggerTR: "Tek oturumda 5+ bira logla",
    description: "That session had momentum.",
    descriptionTR: "O oturumun temposu yüksekti.",
    color: "#EC4899",
    rare: false,
  },
  {
    id: 17,
    emoji: "🌃",
    name: "Night Shift",
    nameTR: "Gece Vardiyası",
    tier: "Time",
    tierTR: "Zaman",
    trigger: "5 consecutive Friday night logs",
    triggerTR: "Arka arkaya 5 Cuma gecesi logu",
    description: "Friday became your lane.",
    descriptionTR: "Cuma gecesi senin kulvarın oldu.",
    color: "#8B5CF6",
    rare: false,
  },
  {
    id: 18,
    emoji: "🧭",
    name: "Explorer",
    nameTR: "Gezgin",
    tier: "Venue",
    tierTR: "Mekan",
    trigger: "Check in at 10 different venues",
    triggerTR: "10 farklı mekanda check-in yap",
    description: "Your map keeps expanding.",
    descriptionTR: "Haritan sürekli genişliyor.",
    color: "#3B82F6",
    rare: false,
  },
  {
    id: 19,
    emoji: "📅",
    name: "One Year Strong",
    nameTR: "Bir Yıl Devam",
    tier: "Streak",
    tierTR: "Seri",
    trigger: "Active for 365 days",
    triggerTR: "365 gün aktif ol",
    description: "A full year of commitment.",
    descriptionTR: "Tam bir yıllık bağlılık.",
    color: "#7C3AED",
    rare: true,
  },
  {
    id: 20,
    emoji: "⏰",
    name: "Happy Hour Hero",
    nameTR: "Happy Hour",
    tier: "Time",
    tierTR: "Zaman",
    trigger: "10 logs between 17:00–19:00",
    triggerTR: "17:00–19:00 arasında 10 log at",
    description: "Golden-hour specialist.",
    descriptionTR: "Altın saat uzmanı.",
    color: "#F472B6",
    rare: false,
  },
  {
    id: 21,
    emoji: "📝",
    name: "Moment Catcher",
    nameTR: "Anı Yakalayan",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Add a note to 10 beer logs",
    triggerTR: "10 log'una not ekle",
    description: "You don't just drink — you document.",
    descriptionTR: "Sadece içmiyorsun — belgeliyorsun.",
    color: "#6366F1",
    rare: false,
  },
  {
    id: 22,
    emoji: "⭐",
    name: "High Standard",
    nameTR: "Yüksek Standart",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Give your first 5-star rating",
    triggerTR: "İlk 5 yıldızlı puanını ver",
    description: "Perfection, finally acknowledged.",
    descriptionTR: "Mükemmellik, sonunda tescillendi.",
    color: "#F59E0B",
    rare: false,
  },
  {
    id: 23,
    emoji: "💀",
    name: "Harsh Critic",
    nameTR: "Acımasız Eleştirmen",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Give a 1-star rating",
    triggerTR: "1 yıldızlı puan ver",
    description: "Your standards are not for everyone.",
    descriptionTR: "Standartların herkese göre değil.",
    color: "#64748B",
    rare: false,
  },
  {
    id: 24,
    emoji: "💸",
    name: "Big Spender",
    nameTR: "Pahalıya Patlayan",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log a beer priced at 500 TL or more",
    triggerTR: "500 TL veya üzeri fiyatlı bir bira logla",
    description: "Worth it. Probably.",
    descriptionTR: "Değdi. Herhalde.",
    color: "#10B981",
    rare: false,
  },
  {
    id: 25,
    emoji: "🔄",
    name: "Comeback Kid",
    nameTR: "Geri Döndüm",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log a beer after 14+ days of inactivity",
    triggerTR: "14+ gün sonra tekrar log at",
    description: "Life got in the way. You came back.",
    descriptionTR: "Hayat araya girdi. Geri döndün.",
    color: "#A855F7",
    rare: false,
  },
  {
    id: 26,
    emoji: "🌗",
    name: "Around the Clock",
    nameTR: "Gece Gündüz",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log before 7 AM and after 9 PM on the same day",
    triggerTR: "Aynı günde hem 07:00 öncesi hem 21:00 sonrası log at",
    description: "You take no breaks. Neither does the glass.",
    descriptionTR: "Mola vermiyorsun. Bardak da vermiyor.",
    color: "#F97316",
    rare: true,
  },
  {
    id: 27,
    emoji: "🏙️",
    name: "Two Cities",
    nameTR: "Çift Şehir",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log in 2 different cities on the same day",
    triggerTR: "Aynı günde 2 farklı şehirde log at",
    description: "Restless. Relentless. Remarkable.",
    descriptionTR: "Duraksız. Kararlı. Olağanüstü.",
    color: "#0EA5E9",
    rare: true,
  },
  {
    id: 28,
    emoji: "🤫",
    name: "Ghost Logger",
    nameTR: "Sessiz Kahraman",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log 50 beers without ever adding a note",
    triggerTR: "Hiç not eklemeden 50 bira logla",
    description: "Numbers speak. Words don't.",
    descriptionTR: "Sayılar konuşur. Kelimeler değil.",
    color: "#78716C",
    rare: false,
  },
  {
    id: 29,
    emoji: "🥂",
    name: "New Year's Toast",
    nameTR: "Yılbaşı Kadehi",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Log a beer on January 1st",
    triggerTR: "1 Ocak günü bir bira logla",
    description: "You welcomed the new year properly.",
    descriptionTR: "Yeni yılı hakkıyla karşıladın.",
    color: "#EC4899",
    rare: false,
  },
  {
    id: 30,
    emoji: "🌟",
    name: "Gold Standard",
    nameTR: "Altın Standart",
    tier: "Achievement",
    tierTR: "Başarı",
    trigger: "Give 10 five-star ratings",
    triggerTR: "10 adet 5 yıldız puanı ver",
    description: "Either you're generous, or you've found the good ones.",
    descriptionTR: "Ya çok cömertsin ya da iyilerini buldun.",
    color: "#FBBF24",
    rare: false,
  },
];

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function venueKeyOf(c: BadgeCheckin) {
  const loc = String(c.location_text || "").trim();
  if (loc) return `loc:${normalizeText(loc)}`;
  const city = String(c.city || "").trim();
  const district = String(c.district || "").trim();
  if (!city && !district) return "";
  return `cd:${normalizeText(`${city} ${district}`)}`;
}

function inferContainer(beerName: string | null | undefined): "draft" | "bottle" | "unknown" {
  const n = normalizeText(String(beerName || ""));
  if (!n) return "unknown";
  if (/\bfici\b/.test(n) || /\bdraft\b/.test(n)) {
    return "draft";
  }
  if (/\bsise\b/.test(n) || /\bkutu\b/.test(n) || /\bbottle\b/.test(n) || /\bcan\b/.test(n)) {
    return "bottle";
  }
  return "unknown";
}

function inferSessionPeople(c: BadgeCheckin): number {
  const note = String(c.note || "");
  const norm = normalizeText(note);
  if (norm.includes("solo") || norm.includes("yalniz") || norm.includes("yalnız")) return 1;

  let total = 1;

  const friendsMatch = note.match(/(?:friends?|arkadas|arkadaş)\s*[:=]\s*(\d{1,2})/i);
  if (friendsMatch) {
    const n = Number(friendsMatch[1]);
    if (Number.isFinite(n) && n >= 0) total = Math.max(total, n + 1);
  }

  const peopleMatch = note.match(/(?:people|kisi|kişi|session|oturum)\s*[:=]\s*(\d{1,2})/i);
  if (peopleMatch) {
    const n = Number(peopleMatch[1]);
    if (Number.isFinite(n) && n >= 1) total = Math.max(total, n);
  }

  const mentions = note.match(/@[a-zA-Z0-9_\.]+/g);
  if (mentions?.length) {
    total = Math.max(total, new Set(mentions.map((m) => m.toLowerCase())).size + 1);
  }

  return Math.max(1, total);
}

function mondayOfIsoWeek(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function diffInDays(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

function countConsecutiveDays(dayKeys: string[]) {
  if (!dayKeys.length) return 0;
  const sorted = Array.from(new Set(dayKeys)).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = toDate(`${sorted[i - 1]}T00:00:00`);
    const next = toDate(`${sorted[i]}T00:00:00`);
    if (!prev || !next) continue;
    const diff = diffInDays(prev, next);
    if (diff === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else if (diff > 1) {
      cur = 1;
    }
  }
  return best;
}

function countConsecutiveWeeks(weekStartKeys: string[]) {
  if (!weekStartKeys.length) return 0;
  const sorted = Array.from(new Set(weekStartKeys)).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = toDate(`${sorted[i - 1]}T00:00:00`);
    const next = toDate(`${sorted[i]}T00:00:00`);
    if (!prev || !next) continue;
    const diff = diffInDays(prev, next);
    if (diff === 7) {
      cur += 1;
      best = Math.max(best, cur);
    } else if (diff > 7) {
      cur = 1;
    }
  }
  return best;
}

function fridayNightChain(fridayKeys: string[]) {
  if (!fridayKeys.length) return 0;
  const sorted = Array.from(new Set(fridayKeys)).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = toDate(`${sorted[i - 1]}T00:00:00`);
    const next = toDate(`${sorted[i]}T00:00:00`);
    if (!prev || !next) continue;
    const diff = diffInDays(prev, next);
    if (diff === 7) {
      cur += 1;
      best = Math.max(best, cur);
    } else if (diff > 7) {
      cur = 1;
    }
  }
  return best;
}

function equalSplitProgress(draft: number, bottle: number) {
  const total = draft + bottle;
  if (total === 0) return 0;
  if (draft === 0 || bottle === 0) return 0;
  return Math.min(draft, bottle) / Math.max(draft, bottle);
}

type Metrics = {
  totalLogs: number;
  draftCount: number;
  bottleCount: number;
  longestDayStreak: number;
  consecutiveWeeks: number;
  soloCount: number;
  maxSessionPeople: number;
  maxFriends: number;
  maxSessionBeerCount: number;
  sameVenueMax: number;
  uniqueVenues: number;
  newVenueEvents: number;
  before10Count: number;
  midnightCount: number;
  happyHourCount: number;
  fridayNightChain: number;
  activeDays: number;
  noteCount: number;
  silentLogCount: number;
  fiveStarCount: number;
  oneStarCount: number;
  pricyLogCount: number;
  comebackCount: number;
  aroundTheClockDays: number;
  twoCitiesDays: number;
  newYearLogCount: number;
  goldStarCount: number;
};

function computeMetrics(checkins: BadgeCheckin[], event?: BadgeEvent): Metrics {
  const rows = checkins
    .map((c, idx) => ({
      idx,
      raw: c,
      d: toDate(c.created_at),
      venue: venueKeyOf(c),
      people: inferSessionPeople(c),
      container: inferContainer(c.beer_name),
    }))
    .filter((x) => x.d)
    .sort((a, b) => (a.d!.getTime() - b.d!.getTime()) || a.idx - b.idx);

  const dayKeys: string[] = [];
  const weekKeys: string[] = [];
  const fridayNightKeys: string[] = [];
  const venueCounts = new Map<string, number>();
  const seenVenues = new Set<string>();
  const sessionCounts = new Map<string, number>();
  const dayRatingMap = new Map<string, { hasNight: boolean; hasMorning: boolean }>();
  const dayCityMap = new Map<string, Set<string>>();

  let draftCount = 0;
  let bottleCount = 0;
  let soloCount = 0;
  let maxSessionPeople = 1;
  let maxFriends = 0;
  let before10Count = 0;
  let midnightCount = 0;
  let happyHourCount = 0;
  let newVenueEvents = 0;
  let noteCount = 0;
  let silentLogCount = 0;
  let fiveStarCount = 0;
  let oneStarCount = 0;
  let pricyLogCount = 0;
  let newYearLogCount = 0;

  for (const row of rows) {
    const d = row.d!;
    const dateKey = dateKeyLocal(d);
    dayKeys.push(dateKey);
    weekKeys.push(dateKeyLocal(mondayOfIsoWeek(d)));

    const hour = d.getHours();
    if (hour < 10) before10Count += 1;
    if (hour >= 0 && hour <= 3) midnightCount += 1;
    if (hour >= 17 && hour <= 19) happyHourCount += 1;

    const note = String(row.raw.note || "").trim();
    if (note.length > 0) noteCount += 1;
    else silentLogCount += 1;

    const rating = row.raw.rating;
    if (rating === 5) fiveStarCount += 1;
    if (rating === 1) oneStarCount += 1;

    const price = row.raw.price_try;
    if (price != null && price >= 500) pricyLogCount += 1;

    const month = d.getMonth();
    const dayOfMonth = d.getDate();
    if (month === 0 && dayOfMonth === 1) newYearLogCount += 1;

    if (!dayRatingMap.has(dateKey)) dayRatingMap.set(dateKey, { hasNight: false, hasMorning: false });
    const dayEntry = dayRatingMap.get(dateKey)!;
    if (hour < 7) dayEntry.hasMorning = true;
    if (hour >= 21) dayEntry.hasNight = true;

    const cityVal = String(row.raw.city || "").trim().toLowerCase();
    if (cityVal) {
      if (!dayCityMap.has(dateKey)) dayCityMap.set(dateKey, new Set());
      dayCityMap.get(dateKey)!.add(cityVal);
    }

    if (d.getDay() === 5 && hour >= 20) {
      fridayNightKeys.push(dateKey);
    }

    if (row.container === "draft") draftCount += 1;
    if (row.container === "bottle") bottleCount += 1;

    if (row.people <= 1) soloCount += 1;
    maxSessionPeople = Math.max(maxSessionPeople, row.people);
    maxFriends = Math.max(maxFriends, Math.max(0, row.people - 1));

    if (row.venue) {
      venueCounts.set(row.venue, (venueCounts.get(row.venue) || 0) + 1);
      if (!seenVenues.has(row.venue)) {
        newVenueEvents += 1;
        seenVenues.add(row.venue);
      }
    }

    const sessionVenueKey = row.venue || "venue:unknown";
    const sessionKey = `${dateKey}|${sessionVenueKey}`;
    sessionCounts.set(sessionKey, (sessionCounts.get(sessionKey) || 0) + 1);
  }

  let aroundTheClockDays = 0;
  for (const value of dayRatingMap.values()) {
    if (value.hasMorning && value.hasNight) aroundTheClockDays += 1;
  }

  let twoCitiesDays = 0;
  for (const cities of dayCityMap.values()) {
    if (cities.size >= 2) twoCitiesDays += 1;
  }

  let comebackCount = 0;
  const sortedUnique = Array.from(new Set(dayKeys)).sort();
  for (let i = 1; i < sortedUnique.length; i += 1) {
    const prev = toDate(`${sortedUnique[i - 1]}T00:00:00`);
    const curr = toDate(`${sortedUnique[i]}T00:00:00`);
    if (!prev || !curr) continue;
    if (diffInDays(prev, curr) >= 14) comebackCount += 1;
  }

  let maxSessionBeerCount = Math.max(0, ...Array.from(sessionCounts.values()));
  if (event?.payload?.sessionBeerCount && Number.isFinite(event.payload.sessionBeerCount)) {
    maxSessionBeerCount = Math.max(maxSessionBeerCount, Number(event.payload.sessionBeerCount));
  }
  if (event?.payload?.sessionPeople && Number.isFinite(event.payload.sessionPeople)) {
    const sp = Math.max(1, Number(event.payload.sessionPeople));
    maxSessionPeople = Math.max(maxSessionPeople, sp);
    maxFriends = Math.max(maxFriends, Math.max(0, sp - 1));
  }
  if (event?.payload?.friendsCount && Number.isFinite(event.payload.friendsCount)) {
    maxFriends = Math.max(maxFriends, Number(event.payload.friendsCount));
    maxSessionPeople = Math.max(maxSessionPeople, Number(event.payload.friendsCount) + 1);
  }

  const sameVenueMax = Math.max(0, ...Array.from(venueCounts.values()));
  const uniqueVenues = seenVenues.size;
  const longestDayStreak = countConsecutiveDays(dayKeys);
  const consecutiveWeeks = countConsecutiveWeeks(weekKeys);
  const chainFriday = fridayNightChain(fridayNightKeys);
  const activeDays = new Set(dayKeys).size;

  return {
    totalLogs: rows.length,
    draftCount,
    bottleCount,
    longestDayStreak,
    consecutiveWeeks,
    soloCount,
    maxSessionPeople,
    maxFriends,
    maxSessionBeerCount,
    sameVenueMax,
    uniqueVenues,
    newVenueEvents,
    before10Count,
    midnightCount,
    happyHourCount,
    fridayNightChain: chainFriday,
    activeDays,
    noteCount,
    silentLogCount,
    fiveStarCount,
    oneStarCount,
    pricyLogCount,
    comebackCount,
    aroundTheClockDays,
    twoCitiesDays,
    newYearLogCount,
    goldStarCount: fiveStarCount,
  };
}

function progress(current: number, target: number, label: string, labelTR: string, countable = true): BadgeProgress {
  const safeTarget = Math.max(1, target);
  return {
    current,
    target,
    ratio: clamp01(current / safeTarget),
    countable,
    label,
    labelTR,
  };
}

function evaluateByMetrics(metrics: Metrics): BadgeEvaluation {
  const unlockedSet = new Set<number>();
  const progressById: Record<number, BadgeProgress> = {
    1: progress(metrics.totalLogs, 1, "first log", "ilk log"),
    2: progress(metrics.totalLogs, 10, "total logs", "toplam log"),
    3: progress(metrics.totalLogs, 100, "total logs", "toplam log"),
    4: progress(metrics.totalLogs, 500, "total logs", "toplam log"),
    5: progress(metrics.longestDayStreak, 7, "day streak", "gün serisi"),
    6: progress(metrics.consecutiveWeeks, 4, "consecutive weeks", "ardışık hafta"),
    7: progress(metrics.draftCount, 20, "draft logs", "fıçı logu"),
    8: progress(metrics.bottleCount, 20, "bottle logs", "şişe logu"),
    9: {
      current: Number((equalSplitProgress(metrics.draftCount, metrics.bottleCount) * 100).toFixed(0)),
      target: 100,
      ratio: equalSplitProgress(metrics.draftCount, metrics.bottleCount),
      countable: true,
      label: "balance",
      labelTR: "denge",
    },
    10: progress(metrics.before10Count, 1, "morning logs", "sabah logu"),
    11: progress(metrics.midnightCount, 1, "midnight logs", "gece yarısı logu"),
    12: progress(metrics.soloCount, 15, "solo sessions", "solo oturum"),
    13: progress(metrics.maxFriends, 3, "friends in session", "oturumdaki arkadaş"),
    14: progress(metrics.sameVenueMax, 10, "same venue check-ins", "aynı mekân check-in"),
    15: progress(metrics.newVenueEvents, 1, "new venue first check-in", "yeni mekân ilk check-in"),
    16: progress(metrics.maxSessionBeerCount, 5, "beers in one session", "tek oturum bira sayısı"),
    17: progress(metrics.fridayNightChain, 5, "Friday-night streak", "Cuma gecesi serisi"),
    18: progress(metrics.uniqueVenues, 10, "different venues", "farklı mekân"),
    19: progress(metrics.activeDays, 365, "active days", "aktif gün"),
    20: progress(metrics.happyHourCount, 10, "happy-hour logs", "mutlu saat logu"),
    21: progress(metrics.noteCount, 10, "notes added", "not eklenen log"),
    22: progress(metrics.fiveStarCount, 1, "5-star ratings", "5 yıldız puanı"),
    23: progress(metrics.oneStarCount, 1, "1-star ratings", "1 yıldız puanı"),
    24: progress(metrics.pricyLogCount, 1, "500+ TL logs", "500+ TL log"),
    25: progress(metrics.comebackCount, 1, "comebacks", "geri dönüş"),
    26: progress(metrics.aroundTheClockDays, 1, "full-day sessions", "tam gün oturumu"),
    27: progress(metrics.twoCitiesDays, 1, "two-city days", "çift şehir günü"),
    28: progress(metrics.silentLogCount, 50, "silent logs", "sessiz log"),
    29: progress(metrics.newYearLogCount, 1, "New Year logs", "yılbaşı logu"),
    30: progress(metrics.goldStarCount, 10, "5-star ratings", "5 yıldız puanı"),
  };

  if (metrics.totalLogs >= 1) unlockedSet.add(1);
  if (metrics.totalLogs >= 10) unlockedSet.add(2);
  if (metrics.totalLogs >= 100) unlockedSet.add(3);
  if (metrics.totalLogs >= 500) unlockedSet.add(4);
  if (metrics.longestDayStreak >= 7) unlockedSet.add(5);
  if (metrics.consecutiveWeeks >= 4) unlockedSet.add(6);
  if (metrics.draftCount >= 20) unlockedSet.add(7);
  if (metrics.bottleCount >= 20) unlockedSet.add(8);
  if (metrics.draftCount > 0 && metrics.bottleCount > 0 && metrics.draftCount === metrics.bottleCount) unlockedSet.add(9);
  if (metrics.before10Count >= 1) unlockedSet.add(10);
  if (metrics.midnightCount >= 1) unlockedSet.add(11);
  if (metrics.soloCount >= 15) unlockedSet.add(12);
  if (metrics.maxFriends >= 3) unlockedSet.add(13);
  if (metrics.sameVenueMax >= 10) unlockedSet.add(14);
  if (metrics.newVenueEvents >= 1) unlockedSet.add(15);
  if (metrics.maxSessionBeerCount >= 5) unlockedSet.add(16);
  if (metrics.fridayNightChain >= 5) unlockedSet.add(17);
  if (metrics.uniqueVenues >= 10) unlockedSet.add(18);
  if (metrics.activeDays >= 365) unlockedSet.add(19);
  if (metrics.happyHourCount >= 10) unlockedSet.add(20);
  if (metrics.noteCount >= 10) unlockedSet.add(21);
  if (metrics.fiveStarCount >= 1) unlockedSet.add(22);
  if (metrics.oneStarCount >= 1) unlockedSet.add(23);
  if (metrics.pricyLogCount >= 1) unlockedSet.add(24);
  if (metrics.comebackCount >= 1) unlockedSet.add(25);
  if (metrics.aroundTheClockDays >= 1) unlockedSet.add(26);
  if (metrics.twoCitiesDays >= 1) unlockedSet.add(27);
  if (metrics.silentLogCount >= 50) unlockedSet.add(28);
  if (metrics.newYearLogCount >= 1) unlockedSet.add(29);
  if (metrics.goldStarCount >= 10) unlockedSet.add(30);

  const badges: Badge[] = BASE_BADGES.map((b) => ({
    ...b,
    unlocked: unlockedSet.has(b.id),
  }));

  return {
    badges,
    progressById,
    unlockedIds: badges.filter((b) => b.unlocked).map((b) => b.id),
  };
}

export function evaluateBadges(checkins: BadgeCheckin[], event?: BadgeEvent): BadgeEvaluation {
  const metrics = computeMetrics(checkins, event);
  return evaluateByMetrics(metrics);
}

export function loadUnlockedAt(userKey: string): Record<number, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${BADGE_STORAGE_PREFIX}${userKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (Number.isFinite(id) && typeof v === "string" && v) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveUnlockedAt(userKey: string, unlockedAtById: Record<number, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${BADGE_STORAGE_PREFIX}${userKey}`, JSON.stringify(unlockedAtById));
  } catch {}
}

export function checkBadgeUnlocks(params: {
  event: BadgeEvent;
  checkins: BadgeCheckin[];
  unlockedAtById: Record<number, string>;
}): BadgeUnlockCheckResult {
  const { event, checkins } = params;
  const base = evaluateBadges(checkins, event);
  const nextUnlockedAt: Record<number, string> = { ...params.unlockedAtById };
  const timestamp = event.timestamp || new Date().toISOString();
  const newlyUnlocked: number[] = [];

  for (const badge of base.badges) {
    if (!badge.unlocked) continue;
    if (!nextUnlockedAt[badge.id]) {
      nextUnlockedAt[badge.id] = timestamp;
      newlyUnlocked.push(badge.id);
    }
  }

  const mergedBadges = base.badges.map((badge) => ({
    ...badge,
    unlocked: badge.unlocked || Boolean(nextUnlockedAt[badge.id]),
  }));

  return {
    ...base,
    badges: mergedBadges,
    unlockedIds: mergedBadges.filter((b) => b.unlocked).map((b) => b.id),
    newlyUnlocked,
    unlockedAtById: nextUnlockedAt,
  };
}

export function badgeById(id: number) {
  return BASE_BADGES.find((b) => b.id === id) || null;
}

export function badgeTiers() {
  const seen = new Set<string>();
  const rows: Array<{ tier: string; tierTR: string }> = [];
  for (const b of BASE_BADGES) {
    if (seen.has(b.tier)) continue;
    seen.add(b.tier);
    rows.push({ tier: b.tier, tierTR: b.tierTR });
  }
  return rows;
}

export function buildBadgeView(params: {
  checkins: BadgeCheckin[];
  unlockedAtById?: Record<number, string>;
  event?: BadgeEvent;
}) {
  const evaluated = evaluateBadges(params.checkins, params.event);
  const unlockedAtById = params.unlockedAtById || {};
  const badges = evaluated.badges.map((b) => ({
    ...b,
    unlocked: b.unlocked || Boolean(unlockedAtById[b.id]),
  }));
  return {
    ...evaluated,
    badges,
    unlockedIds: badges.filter((b) => b.unlocked).map((b) => b.id),
    unlockedAtById,
  };
}
