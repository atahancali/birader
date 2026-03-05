-- Sprint N2: social feed / hydration performance tune-up
-- Note: Supabase SQL Editor wraps scripts in a transaction, so CONCURRENTLY is not used.

create extension if not exists pg_trgm;

-- Feed order + cursor pagination (created_at DESC, id DESC)
create index if not exists idx_checkins_feed_created_id
  on public.checkins (created_at desc, id desc);

-- Scoped feed (following/all for user-specific windows)
create index if not exists idx_checkins_user_feed_created_id
  on public.checkins (user_id, created_at desc, id desc);

-- City constrained feed
create index if not exists idx_checkins_city_feed_created_id
  on public.checkins (city, created_at desc, id desc)
  where city is not null;

-- Bottle/draft text filters and general beer search
create index if not exists idx_checkins_feed_beer_name_trgm
  on public.checkins using gin (beer_name gin_trgm_ops);

-- Cover actor/owner mini profile lookup (username + display_name)
create index if not exists idx_profiles_user_lookup_cover
  on public.profiles (user_id) include (username, display_name);

analyze public.checkins;
analyze public.profiles;
analyze public.follows;
analyze public.notifications;

-- 1) All feed (24h)
explain (analyze, buffers, verbose)
select id, user_id, beer_name, rating, created_at, city, district
from public.checkins
where created_at >= now() - interval '24 hours'
order by created_at desc, id desc
limit 25;

-- 2) Following feed (7d) using an auto-selected sample user
explain (analyze, buffers, verbose)
with me as (
  select p.user_id
  from public.profiles p
  order by p.user_id
  limit 1
),
scope_ids as (
  select me.user_id from me
  union
  select f.following_id
  from public.follows f
  join me on me.user_id = f.follower_id
)
select c.id, c.user_id, c.beer_name, c.rating, c.created_at, c.city, c.district
from public.checkins c
join scope_ids s on s.user_id = c.user_id
where c.created_at >= now() - interval '7 days'
order by c.created_at desc, c.id desc
limit 25;

-- 3) Owner profile hydration lookup
explain (analyze, buffers, verbose)
with sampled_owners as (
  select distinct c.user_id
  from public.checkins c
  order by c.user_id
  limit 25
)
select p.user_id, p.username, p.display_name
from public.profiles p
join sampled_owners s on s.user_id = p.user_id;

-- 4) Notifications head load
explain (analyze, buffers, verbose)
with me as (
  select p.user_id
  from public.profiles p
  order by p.user_id
  limit 1
)
select n.id, n.user_id, n.actor_id, n.type, n.ref_id, n.payload, n.is_read, n.created_at
from public.notifications n
join me on me.user_id = n.user_id
order by n.created_at desc
limit 30;

-- 5) Discover RPC baseline (if available in schema)
-- If function does not exist in current environment, this statement can be skipped.
explain (analyze, buffers, verbose)
select * from public.get_discover_profiles(12);
