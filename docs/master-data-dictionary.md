# Birader Master Data Dictionary

Son güncelleme: 2026-03-08

Bu dosya, uygulamadaki verinin ne anlama geldiğini, nerede tutulduğunu ve ana dosyaların ne işe yaradığını tek yerde toplar.

## 1) Domain Kuralları

- `Bavyera` bir marka değildir; `1L` (1000 ml) porsiyon tipidir.
- Bira formatı sabit enum:
  - `Fici`
  - `Şişe/Kutu`
- Puan (rating) nullable ve 0.5 adım:
  - `null` = puansız
  - `0.5 .. 5.0` arası
- Coğrafi alanlar:
  - `country_code` (default `TR`)
  - `city`, `district` (metinsel)
  - `latitude`, `longitude` (opsiyonel)

## 2) Ana Varlıklar (DB)

| Varlık | Depo | Ana Alanlar | Ne Anlama Gelir |
|---|---|---|---|
| Kullanıcı Profili | `public.profiles` | `user_id`, `username`, `display_name`, `login_username`, `handle`, `avatar_path`, `is_public`, `is_admin` | Kullanıcının kimliği, görünür adı, avatarı ve tercihleri |
| Bira Logu | `public.checkins` | `id`, `user_id`, `beer_name`, `rating`, `created_at`, `beer_brand`, `beer_format`, `beer_volume_ml`, `city`, `district`, `note` | Uygulamanın temel olay kaydı |
| Takipleşme | `public.follows` | `follower_id`, `following_id`, `created_at` | Sosyal graph |
| Favori Biralar | `public.favorite_beers` | `user_id`, `beer_name`, `rank` | Profildeki ilk 3 favori |
| Standart Bira Kataloğu | `public.beer_master` | `canonical_name`, `brand`, `serving_format`, `volume_ml`, `is_active` | Normalleştirilmiş bira adları |
| Alias Eşlemesi | `public.beer_alias` | `master_id`, `alias_name`, `source` | Farklı yazımları tek canonical kayda bağlar |
| Özel Bira Moderasyonu | `public.custom_beer_moderation_queue` | `raw_input`, `normalized_input`, `status`, `resolved_master_id` | Kullanıcıdan gelen katalog dışı bira önerileri |
| Avatar Moderasyonu | `public.avatar_moderation_queue` | `user_id`, `avatar_path`, `status`, `flags` | Profil fotoğrafı kontrol kuyruğu |
| Yorum | `public.checkin_comments` | `checkin_id`, `user_id`, `body`, `created_at` | Log altı yorumlar |
| Log Beğenisi | `public.checkin_likes` | `checkin_id`, `user_id`, `created_at` | Log beğeni ilişkisi |
| Yorum Beğenisi | `public.checkin_comment_likes` | `comment_id`, `user_id`, `created_at` | Yorum beğeni ilişkisi |
| Ortak İçim Daveti | `public.checkin_share_invites` | `source_checkin_id`, `inviter_id`, `invited_user_id`, `status` | Bir logu başka kullanıcıya teklif etme/ekleme |
| Bildirim | `public.notifications` | `user_id`, `actor_id`, `type`, `ref_id`, `payload`, `is_read` | Sosyal aksiyonlardan üretilen bildirimler |
| Stereotype Rozetler | `public.user_badges` | `badge_key`, `title_tr/en`, `detail_tr/en`, `score` | SQL hesaplı rozet sistemi (runtime rozetlerden ayrı) |
| Kimlik Geçmişi | `public.profile_identity_history` | `old_*`, `new_*`, `source`, `created_at` | Username/display name/login username değişim logu |
| Aksiyon Logu | `public.app_action_logs` | `action_name`, `entity_type`, `before_data`, `after_data`, `context` | CRM/analitik için ham aksiyon trail |
| Günlük CRM Snapshot | `public.user_daily_metrics` | `snapshot_date`, `total_checkins`, `checkins_7d`, `checkins_30d`, `current_streak_days` | Segmentasyon/retention ölçümü |
| Ürün Önerisi | `public.product_suggestions` | `category`, `message`, `status` | Kullanıcı öneri kutusu |
| İçerik Raporu | `public.content_reports` | `reporter_id`, `target_type`, `target_id`, `reason`, `status` | Moderasyon raporları |
| Analitik Event | `public.analytics_events` | `event_name`, `user_id`, `props`, `created_at` | Ürün event tracking |
| Perf Event | `public.social_perf_events` | `metric_key`, `duration_ms`, `row_count`, `ok`, `context` | Sosyal panel performans ölçümleri |
| Perf Günlük Özet | `public.social_perf_daily` | `snapshot_date`, `metric_key`, `avg_ms`, `p95_ms`, `fail_rate_pct` | Perf dashboard aggregate |

## 3) Uygulama Tipleri / Kontratları

### 3.1 Loglama Kataloğu

Kaynak: `src/app/page.tsx`

```ts
type BeerItem = {
  brand: string;
  format: "Fici" | "Şişe/Kutu";
  ml: number; // ör. 300, 500, 1000
};
```

Not: `1000 ml` porsiyon `Bavyera` tipine karşılık gelir; marka olarak tutulmaz.

### 3.2 Check-in Modeli (UI tarafı)

Kaynak: `src/app/page.tsx`

```ts
type Checkin = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
  day_period?: "morning" | "afternoon" | "evening" | "night" | null;
  city?: string | null;
  district?: string | null;
  location_text?: string | null;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  media_url?: string | null;
  media_type?: string | null;
};
```

### 3.3 Runtime Rozet Modeli

Kaynak: `src/lib/badgeSystem.ts`

```ts
type Badge = {
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
};
```

## 4) Local Storage / Client Key Sözlüğü

| Key | Kaynak | Amaç |
|---|---|---|
| `birader:lang:v1` | `src/lib/i18n.ts`, `src/lib/appLang.ts` | TR/EN dil tercihi |
| `birader:theme:v1` | `src/app/page.tsx` | Dark/Light tema tercihi |
| `birader:heatmap-theme:v1` | `src/app/page.tsx` | Heatmap renk paleti |
| `birader:heatmap-prefs:v1` | `src/app/page.tsx` | Heatmap görünüm metrik tercihleri |
| `birader:checkins:v1` | `src/app/page.tsx` | Offline/local checkin fallback |
| `birader:offline-log-queue:v1` | `src/app/page.tsx` | Offline log kuyruk buffer |
| `birader:tutorial-done:v1` | `src/app/page.tsx` | Tutorial tamamlandı işareti |
| `birader:onboarding:v1` | `src/app/page.tsx` | Onboarding görüldü işareti |
| `birader:pending-compliance:v1` | `src/app/page.tsx` | Signup sonrası bekleyen compliance state |
| `birader:pending-referral:v1` | `src/app/page.tsx` | Geçici referral kodu |
| `birader:notif-prefs:v1:{userId}` | `src/components/SocialPanel.tsx` | Bildirim tercih cache’i |
| `birader:feed-prefs:v1:{userId}` | `src/components/SocialPanel.tsx` | Feed filtre tercih cache’i |
| `birader:badge-unlocked-at:v2:{userId}` | `src/lib/badgeSystem.ts` | Runtime rozet açılma timestamp map |

## 5) Dosya Haritası (Uygulama)

| Dosya | Rol |
|---|---|
| `src/app/page.tsx` | Ana uygulama ekranı; log/social/map/stats sekmeleri ve ana state orchestration |
| `src/components/SocialPanel.tsx` | Akış, takip, leaderboard, bildirim ve sosyal etkileşim UI + query yönetimi |
| `src/components/DayModal.tsx` | Heatmap gün detayı; gün içi log görüntüleme/ekleme/düzenleme |
| `src/components/badges/BadgeGrid.tsx` | Stats içindeki runtime 20 rozetin filtreli grid görünümü |
| `src/components/badges/BadgeDrawer.tsx` | Badge kartına tıklanınca açılan bottom sheet detay paneli |
| `src/components/badges/ProfileBadgeShelf.tsx` | Profil/istatistikte son açılan rozetlerden yatay raf |
| `src/components/badges/BadgeUnlockCelebration.tsx` | Yeni rozet açıldığında kutlama overlay’i |
| `src/lib/badgeSystem.ts` | Runtime rozet motoru (hesaplama, unlock, progress, local persist) |
| `src/lib/badges.ts` | SQL tabanlı stereotype rozetler (runtime rozetlerden ayrı sistem) |
| `src/lib/i18n.ts` | `t(lang,key)` / `tx(lang,tr,en)` metin katmanı |
| `src/lib/heatmapTheme.ts` | Heatmap palette tanımları ve gradient hesapları |
| `src/lib/apiError.ts` | API/Supabase hata normalize + kullanıcı mesajlarına çevirme |
| `src/lib/analytics.ts` | Event tracking (client -> analytics_events / logging akışı) |

## 6) Notlar

- Runtime rozetler (`badgeSystem.ts`) ile SQL stereotype rozetleri (`user_badges`) ayrı tutulur.
- `beer_name` metni geriye dönük uyumluluk için korunur; normalize kolonlar (`beer_brand`, `beer_format`, `beer_volume_ml`, `beer_master_id`) raporlama için kullanılır.
- Hesap silme, export ve kimlik geçmişi KVKK/GDPR operasyonları için SQL fonksiyonlarıyla desteklenir.
