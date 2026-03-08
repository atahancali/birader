# Birader Master SQL Dictionary

Son güncelleme: 2026-03-08

Bu dosya, `scripts/sql` altındaki SQL dosyalarının ne yaptığını, ne zaman çalıştırılması gerektiğini ve aralarındaki ilişkiyi özetler.

## 1) Çalıştırma Stratejisi

1. **Ana kaynak**: `scripts/sql/main.sql`  
   - Idempotent tasarlanmıştır (`if not exists`, `drop policy if exists` vb.).
   - Yeni kurulum veya major güncellemede tek başına çalıştırılacak birincil dosyadır.
2. **Migration klasörü**: tarihsel iz/ayrık adımlar için referans.  
   - `main.sql` çoğu migration adımını zaten içerir.
3. **Tanı/performans dosyaları**: runtime schema değiştirmez; ölçüm ve rapor üretir.

## 2) Top-Level SQL Dosya Sözlüğü

| Dosya | Tür | Ne İşe Yarar | Ne Zaman Çalıştırılır |
|---|---|---|---|
| `scripts/sql/main.sql` | Canonical schema + RLS + function pack | Core sosyal model, beer normalization, checkin metadata, comments/likes/notifications, identity history, action logs, daily metrics, retention/perf fonksiyonları, account deletion | **Her ana deploy öncesi / schema drift olduğunda** |
| `scripts/sql/social_analytics_schema.sql` | Legacy/alt şema paketi | Sosyal analitik ve rozet tarafının eski/ayrık kurulum varyantı | Sadece özel ihtiyaçta, `main.sql` yerine değil |
| `scripts/sql/checkins_nullable_rating.sql` | Patch (legacy) | `rating` alanını nullable hale getirme | Eski ortam migrate edilirken |
| `scripts/sql/checkins_location_price_note_geo.sql` | Patch (legacy) | `city/district/location_text/price/note/geo` alanlarını ekleme | Eski ortam migrate edilirken |
| `scripts/sql/profile_display_name_and_checkins_public_read.sql` | Patch (legacy) | `display_name` ve public checkin read policy düzenlemeleri | Eski ortam migrate edilirken |
| `scripts/sql/n1_rls_audit.sql` | Audit | RLS policy denetimi ve risk tespiti | Güvenlik kontrol sprintlerinde |
| `scripts/sql/n1_rls_minimum_fixes.sql` | Security patch | RLS için minimum hardening düzeltmeleri | Audit sonrası |
| `scripts/sql/n2_feed_perf.sql` | Perf patch | Feed sorgu performans iyileştirmeleri | Sosyal akış yavaşlığında |
| `scripts/sql/sprint1_perf_diagnostics.sql` | Diagnostics | EXPLAIN ve metrik toplama query seti | Performans analizinde |
| `scripts/sql/sprint1_perf_summary.sql` | Summary report | Perf tanı sonuçlarını özetleme | Diagnostics sonrası |

## 3) Migration Dosyaları (Tarihsel Akış)

| Dosya | İçerik Özeti |
|---|---|
| `migrations/001_social_core.sql` | Profiles/follows/favorites temel sosyal çekirdek |
| `migrations/002_profile_display_name_and_public_checkins.sql` | Display name + public checkins read |
| `migrations/003_checkins_nullable_rating.sql` | Nullable puan |
| `migrations/004_checkins_geo_metadata.sql` | Lokasyon/fiyat/not/geo metadata |
| `migrations/005_checkins_city_district.sql` | İl/ilçe destek adımları |
| `migrations/006_checkins_write_policies.sql` | Checkin write RLS iyileştirmeleri |
| `migrations/007_checkins_delete_rpc.sql` | Güvenli delete RPC |
| `migrations/008_product_suggestions.sql` | Öneri kutusu altyapısı |
| `migrations/009_checkin_comments_and_share_invites.sql` | Yorum + ortak içim daveti |
| `migrations/010_comment_likes_and_notifications.sql` | Comment/checkin like + notifications |
| `migrations/011_profiles_legal_and_commercial_fields.sql` | KVKK/GDPR legal/commercial profile alanları |
| `migrations/012_notifications_follow_type.sql` | Follow bildirim türü genişletmesi |

## 4) `main.sql` İçindeki Kritik Fonksiyonlar

| Fonksiyon | Ne Yapar |
|---|---|
| `parse_beer_label_parts(text)` | `beer_name` metninden `brand/format/volume_ml` parse eder |
| `resolve_beer_name(text)` | Alias/canonical eşlemesi ile standart bira bulur |
| `create_checkin_guarded(...)` | Idempotent + güvenli checkin insert akışı |
| `delete_own_checkin(text)` / `undo_delete_own_checkin(text)` | Soft delete ve zaman pencereli geri alma |
| `sync_checkin_beer_columns()` | Trigger ile `beer_*` normalize kolonlarını senkronlar |
| `compute_and_store_user_badges(uuid)` | SQL stereotype rozet hesaplama ve upsert |
| `refresh_my_badges()` / `refresh_all_user_badges()` | Kullanıcı/total rozet refresh |
| `get_weekly_highlights(text)` | Haftalık sosyal highlight verisi |
| `refresh_social_leaderboard_snapshots(...)` / `get_social_leaderboard(...)` | Leaderboard snapshot + sorgu |
| `accept_checkin_share_invite(bigint)` | Davet kabulünde karşı tarafa log kopyalar |
| `get_discover_profiles(int)` | Sosyal keşfet profil önerisi |
| `export_my_data()` | KVKK/GDPR data export |
| `delete_my_account()` | KVKK/GDPR right-to-erasure hesap + ilişkili veri temizliği |
| `retention_funnel_30d()` / `run_retention_nudges(int)` | Retention analitik ve nudge üretimi |

## 5) Operasyon Notları

- `main.sql` çalıştırıldıktan sonra:
  - Uygulama tarafında schema cache/metadata yenilemesi gerekebilir (Supabase panel refresh).
  - `refresh_all_user_badges()` ve `refresh_all_user_daily_metrics()` operasyonları admin kullanımına uygundur.
- Yüksek trafikte ağır rapor fonksiyonları (retention/perf snapshot) düşük yoğunluk saatlerinde tetiklenmelidir.
- `social_analytics_schema.sql` ve `main.sql` birlikte rastgele karışık çalıştırılmamalı; ortam stratejisi net olmalıdır.
