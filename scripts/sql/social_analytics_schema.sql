-- Social + analytics base schema for Birader

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_path text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_path text not null default '';
alter table public.profiles add column if not exists display_name text not null default '';
alter table public.checkins add column if not exists country_code text not null default 'TR';
alter table public.checkins add column if not exists city text not null default '';
alter table public.checkins add column if not exists district text not null default '';
alter table public.checkins add column if not exists location_text text not null default '';
alter table public.checkins add column if not exists price_try numeric(10,2);
alter table public.checkins add column if not exists note text not null default '';
alter table public.checkins add column if not exists latitude double precision;
alter table public.checkins add column if not exists longitude double precision;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.favorite_beers (
  user_id uuid not null references auth.users(id) on delete cascade,
  beer_name text not null,
  rank smallint not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, rank),
  unique (user_id, beer_name)
);

alter table public.favorite_beers drop constraint if exists favorite_beers_rank_check;
delete from public.favorite_beers where rank > 3;
alter table public.favorite_beers
add constraint favorite_beers_rank_check check (rank between 1 and 3);

create table if not exists public.analytics_events (
  id bigserial primary key,
  event_name text not null,
  user_id uuid null references auth.users(id) on delete set null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_suggestions (
  id bigserial primary key,
  user_id uuid null references auth.users(id) on delete set null,
  category text not null default 'general',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_display_name on public.profiles (display_name);
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_checkins_city_district on public.checkins (city, district);
create index if not exists idx_checkins_location_text on public.checkins (location_text);
create index if not exists idx_checkins_geo on public.checkins (latitude, longitude);
create index if not exists idx_analytics_events_name_time on public.analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user_time on public.analytics_events (user_id, created_at desc);
create index if not exists idx_product_suggestions_created_at on public.product_suggestions (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.follows enable row level security;
alter table public.favorite_beers enable row level security;
alter table public.analytics_events enable row level security;
alter table public.product_suggestions enable row level security;

-- profiles: everyone can read public profiles, owner can read/write self
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
for select using (is_public = true or auth.uid() = user_id);

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- checkins: owner can always read; public can read if profile is public
drop policy if exists checkins_public_read on public.checkins;
create policy checkins_public_read on public.checkins
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = checkins.user_id
      and p.is_public = true
  )
);

drop policy if exists checkins_owner_insert on public.checkins;
create policy checkins_owner_insert on public.checkins
for insert with check (auth.uid() = user_id);

drop policy if exists checkins_owner_update on public.checkins;
create policy checkins_owner_update on public.checkins
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists checkins_owner_delete on public.checkins;
create policy checkins_owner_delete on public.checkins
for delete using (auth.uid() = user_id);

create or replace function public.delete_own_checkin(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
begin
  delete from public.checkins
  where id::text = p_id
    and user_id = auth.uid();

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.delete_own_checkin(text) from public;
grant execute on function public.delete_own_checkin(text) to authenticated;

-- follows: everyone can read, owner manages own following list
drop policy if exists follows_read_all on public.follows;
create policy follows_read_all on public.follows
for select using (true);

drop policy if exists follows_owner_insert on public.follows;
create policy follows_owner_insert on public.follows
for insert with check (auth.uid() = follower_id);

drop policy if exists follows_owner_delete on public.follows;
create policy follows_owner_delete on public.follows
for delete using (auth.uid() = follower_id);

-- favorite beers: public read if owner profile is public; owner write
drop policy if exists favorite_beers_public_read on public.favorite_beers;
create policy favorite_beers_public_read on public.favorite_beers
for select using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = favorite_beers.user_id
      and (p.is_public = true or p.user_id = auth.uid())
  )
);

drop policy if exists favorite_beers_owner_insert on public.favorite_beers;
create policy favorite_beers_owner_insert on public.favorite_beers
for insert with check (auth.uid() = user_id);

drop policy if exists favorite_beers_owner_update on public.favorite_beers;
create policy favorite_beers_owner_update on public.favorite_beers
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists favorite_beers_owner_delete on public.favorite_beers;
create policy favorite_beers_owner_delete on public.favorite_beers
for delete using (auth.uid() = user_id);

-- analytics: only authenticated users can insert; no direct read from client
drop policy if exists analytics_insert_auth on public.analytics_events;
create policy analytics_insert_auth on public.analytics_events
for insert with check (auth.uid() is not null);

drop policy if exists product_suggestions_insert_auth on public.product_suggestions;
create policy product_suggestions_insert_auth on public.product_suggestions
for insert with check (auth.uid() = user_id);

revoke all on public.analytics_events from anon;
revoke all on public.analytics_events from authenticated;
grant insert on public.analytics_events to authenticated;
revoke all on public.product_suggestions from anon;
revoke all on public.product_suggestions from authenticated;
grant insert on public.product_suggestions to authenticated;

-- convenience view: public profile summary
drop view if exists public.profile_stats;
create view public.profile_stats as
select
  p.user_id,
  p.username,
  p.display_name,
  count(c.id)::int as total_checkins,
  coalesce(round(avg(c.rating)::numeric, 2), 0) as avg_rating
from public.profiles p
left join public.checkins c on c.user_id = p.user_id
group by p.user_id, p.username, p.display_name;
