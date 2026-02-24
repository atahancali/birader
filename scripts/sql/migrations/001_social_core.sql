-- 001_social_core.sql
-- Core social tables + RLS + analytics foundation

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  bio text not null default '',
  avatar_path text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.analytics_events (
  id bigserial primary key,
  event_name text not null,
  user_id uuid null references auth.users(id) on delete set null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_analytics_events_name_time on public.analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user_time on public.analytics_events (user_id, created_at desc);

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
alter table public.follows enable row level security;
alter table public.favorite_beers enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
for select using (is_public = true or auth.uid() = user_id);

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists follows_read_all on public.follows;
create policy follows_read_all on public.follows
for select using (true);

drop policy if exists follows_owner_insert on public.follows;
create policy follows_owner_insert on public.follows
for insert with check (auth.uid() = follower_id);

drop policy if exists follows_owner_delete on public.follows;
create policy follows_owner_delete on public.follows
for delete using (auth.uid() = follower_id);

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

drop policy if exists analytics_insert_auth on public.analytics_events;
create policy analytics_insert_auth on public.analytics_events
for insert with check (auth.uid() is not null);

revoke all on public.analytics_events from anon;
revoke all on public.analytics_events from authenticated;
grant insert on public.analytics_events to authenticated;
