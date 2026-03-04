-- sprint1_perf_diagnostics.sql
-- Amac: Sprint 1 / #01 + #05 icin sosyal sorgularin darbozazlarini tespit etmek.
-- Calistirma: Supabase SQL Editor
-- Not: Script placeholder istemez. auth.uid() yoksa otomatik ornek kullanici secer.

set statement_timeout = '30s';

-- =========================================================
-- 0) Baslangic durum / hacim
-- =========================================================
select 'profiles' as table_name, count(*)::bigint as row_count from public.profiles
union all
select 'checkins', count(*)::bigint from public.checkins
union all
select 'follows', count(*)::bigint from public.follows
union all
select 'notifications', count(*)::bigint from public.notifications
union all
select 'checkin_comments', count(*)::bigint from public.checkin_comments
union all
select 'checkin_likes', count(*)::bigint from public.checkin_likes
order by table_name;

-- =========================================================
-- 1) Feed query (all scope, 24h)
-- =========================================================
explain (analyze, buffers, verbose)
with p as (
  select
    coalesce(
      auth.uid(),
      (select user_id from public.profiles order by created_at asc limit 1)
    ) as me,
    now() - interval '24 hours' as ts_from,
    25::int as lim
)
select
  c.id,
  c.user_id,
  c.beer_name,
  c.rating,
  c.created_at
from public.checkins c
left join public.profiles owner on owner.user_id = c.user_id
cross join p
where c.created_at >= p.ts_from
  and (
    c.user_id = p.me
    or coalesce(owner.is_public, false) = true
  )
order by c.created_at desc
limit (select lim from p);

-- =========================================================
-- 2) Feed query (following scope, 24h)
-- =========================================================
explain (analyze, buffers, verbose)
with p as (
  select
    coalesce(
      auth.uid(),
      (select follower_id from public.follows order by created_at asc limit 1),
      (select user_id from public.profiles order by created_at asc limit 1)
    ) as me,
    now() - interval '24 hours' as ts_from,
    25::int as lim
)
select
  c.id,
  c.user_id,
  c.beer_name,
  c.rating,
  c.created_at
from public.checkins c
join public.follows f
  on f.following_id = c.user_id
cross join p
where f.follower_id = p.me
  and c.created_at >= p.ts_from
order by c.created_at desc
limit (select lim from p);

-- =========================================================
-- 3) Notification query + actor profile resolve
-- =========================================================
explain (analyze, buffers, verbose)
with p as (
  select
    coalesce(
      auth.uid(),
      (select user_id from public.notifications order by created_at desc limit 1),
      (select user_id from public.profiles order by created_at asc limit 1)
    ) as me,
    30::int as lim
)
select
  n.id,
  n.type,
  n.ref_id,
  n.is_read,
  n.created_at,
  actor.username,
  actor.display_name
from public.notifications n
left join public.profiles actor on actor.user_id = n.actor_id
cross join p
where n.user_id = p.me
order by n.created_at desc
limit (select lim from p);

-- =========================================================
-- 4) Discover profiles RPC path benchmark
-- =========================================================
explain (analyze, buffers, verbose)
select * from public.get_discover_profiles(20);

-- =========================================================
-- 5) Leaderboard RPC path benchmark
-- =========================================================
explain (analyze, buffers, verbose)
select * from public.get_social_leaderboard('7d', 'all');

-- =========================================================
-- 6) Index envanteri (kritik tablolar)
-- =========================================================
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('checkins', 'follows', 'notifications', 'profiles', 'checkin_comments', 'checkin_likes')
order by tablename, indexname;

-- =========================================================
-- 7) Opsiyonel index onerileri (ihtiyaca gore ac)
-- Not: Once EXPLAIN sonucunu gormeden create etme.
-- =========================================================
-- create index concurrently if not exists idx_checkins_created_at_user
--   on public.checkins (created_at desc, user_id);
--
-- create index concurrently if not exists idx_notifications_user_created
--   on public.notifications (user_id, created_at desc);
--
-- create index concurrently if not exists idx_follows_follower_following
--   on public.follows (follower_id, following_id);
