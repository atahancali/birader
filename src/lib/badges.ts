export type Badge = {
  key: string;
  titleTr: string;
  titleEn: string;
  detailTr: string;
  detailEn: string;
};

type CheckinLike = {
  beer_name: string;
  created_at: string;
  city?: string | null;
  district?: string | null;
};

export function computeStereotypeBadges(checkins: CheckinLike[]): Badge[] {
  if (!checkins.length) return [];
  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  const hourBuckets = { night: 0, day: 0 };
  let ficiCount = 0;
  let bottleCount = 0;
  const cityCounts = new Map<string, number>();
  const spotCounts = new Map<string, number>();

  for (const c of checkins) {
    const d = new Date(c.created_at);
    if (!Number.isNaN(d.getTime())) {
      weekdayCounts[d.getDay()] += 1;
      const h = d.getHours();
      if (h >= 22 || h < 4) hourBuckets.night += 1;
      else hourBuckets.day += 1;
    }
    if (c.beer_name.includes("— Fici —")) ficiCount += 1;
    if (c.beer_name.includes("— Şişe/Kutu —")) bottleCount += 1;
    const city = (c.city || "").trim();
    if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    const spot = `${(c.city || "").trim()}::${(c.district || "").trim()}`;
    if (spot !== "::") spotCounts.set(spot, (spotCounts.get(spot) || 0) + 1);
  }

  const total = checkins.length;
  const saturdayShare = total ? weekdayCounts[6] / total : 0;
  const nightShare = total ? hourBuckets.night / total : 0;
  const ficiShare = total ? ficiCount / total : 0;
  const bottleShare = total ? bottleCount / total : 0;
  const uniqueCities = cityCounts.size;
  const topSpot = Math.max(0, ...Array.from(spotCounts.values()));
  const topSpotShare = total ? topSpot / total : 0;

  const out: Badge[] = [];
  if (weekdayCounts[6] >= 4 && saturdayShare >= 0.35) {
    out.push({
      key: "sat_committee",
      titleTr: "Cumartesi Komitesi",
      titleEn: "Saturday Committee",
      detailTr: `${weekdayCounts[6]} Cumartesi logu`,
      detailEn: `${weekdayCounts[6]} Saturday check-ins`,
    });
  }
  if (nightShare >= 0.35 && hourBuckets.night >= 6) {
    out.push({
      key: "night_owl",
      titleTr: "Gece Baykuşu",
      titleEn: "Night Owl",
      detailTr: `Logların %${Math.round(nightShare * 100)} gece`,
      detailEn: `${Math.round(nightShare * 100)}% of logs are at night`,
    });
  }
  if (ficiShare >= 0.6 && ficiCount >= 6) {
    out.push({
      key: "draft_loyalist",
      titleTr: "Taslakçı",
      titleEn: "Draft Loyalist",
      detailTr: `Fıçı ağırlık: %${Math.round(ficiShare * 100)}`,
      detailEn: `Draft-heavy profile: ${Math.round(ficiShare * 100)}%`,
    });
  }
  if (bottleShare >= 0.6 && bottleCount >= 6) {
    out.push({
      key: "bottle_lover",
      titleTr: "Şişeci",
      titleEn: "Bottle Lover",
      detailTr: `Şişe/Kutu ağırlık: %${Math.round(bottleShare * 100)}`,
      detailEn: `Bottle/can-heavy profile: ${Math.round(bottleShare * 100)}%`,
    });
  }
  if (uniqueCities >= 4) {
    out.push({
      key: "nomad",
      titleTr: "Pub Nomadı",
      titleEn: "Pub Nomad",
      detailTr: `${uniqueCities} farklı şehir`,
      detailEn: `${uniqueCities} different cities`,
    });
  }
  if (topSpot >= 8 && topSpotShare >= 0.45) {
    out.push({
      key: "regular",
      titleTr: "Sadık Müdavim",
      titleEn: "Local Regular",
      detailTr: `Logların %${Math.round(topSpotShare * 100)} aynı bölgede`,
      detailEn: `${Math.round(topSpotShare * 100)}% of logs in one area`,
    });
  }

  return out.slice(0, 5);
}
