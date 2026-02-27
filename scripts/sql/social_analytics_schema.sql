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
alter table public.checkins add column if not exists day_period text;
alter table public.checkins drop constraint if exists checkins_day_period_check;
alter table public.checkins
add constraint checkins_day_period_check check (day_period is null or day_period in ('morning', 'afternoon', 'evening', 'night'));

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

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  title_tr text not null,
  title_en text not null,
  detail_tr text not null default '',
  detail_en text not null default '',
  score integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_display_name on public.profiles (display_name);
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_checkins_city_district on public.checkins (city, district);
create index if not exists idx_checkins_location_text on public.checkins (location_text);
create index if not exists idx_checkins_geo on public.checkins (latitude, longitude);
create index if not exists idx_checkins_created_at on public.checkins (created_at desc);
create index if not exists idx_analytics_events_name_time on public.analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user_time on public.analytics_events (user_id, created_at desc);
create index if not exists idx_product_suggestions_created_at on public.product_suggestions (created_at desc);
create index if not exists idx_user_badges_user_score on public.user_badges (user_id, score desc, computed_at desc);

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
alter table public.user_badges enable row level security;

-- profiles: everyone can read public profiles, owner can read/write self
alter table public.profiles add column if not exists is_admin boolean not null default false;

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

drop policy if exists product_suggestions_read_own_or_admin on public.product_suggestions;
create policy product_suggestions_read_own_or_admin on public.product_suggestions
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists product_suggestions_update_admin on public.product_suggestions;
create policy product_suggestions_update_admin on public.product_suggestions
for update using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
) with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists user_badges_read_public_or_owner on public.user_badges;
create policy user_badges_read_public_or_owner on public.user_badges
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = user_badges.user_id
      and p.is_public = true
  )
);

drop policy if exists user_badges_admin_write on public.user_badges;
create policy user_badges_admin_write on public.user_badges
for all using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
) with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

revoke all on public.analytics_events from anon;
revoke all on public.analytics_events from authenticated;
grant insert on public.analytics_events to authenticated;
revoke all on public.product_suggestions from anon;
revoke all on public.product_suggestions from authenticated;
grant insert, select, update on public.product_suggestions to authenticated;
revoke all on public.user_badges from anon;
revoke all on public.user_badges from authenticated;
grant select, insert, update, delete on public.user_badges to authenticated;

create or replace function public.compute_and_store_user_badges(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int := 0;
begin
  if p_user_id is null then
    return 0;
  end if;

  delete from public.user_badges where user_id = p_user_id;

  with base as (
    select
      c.user_id,
      count(*)::int as total_logs,
      count(*) filter (where extract(dow from timezone('Europe/Istanbul', c.created_at)) = 6)::int as saturday_logs,
      count(*) filter (
        where c.day_period = 'night'
           or (
             c.day_period is null
             and (
               extract(hour from timezone('Europe/Istanbul', c.created_at)) >= 22
               or extract(hour from timezone('Europe/Istanbul', c.created_at)) < 4
             )
           )
      )::int as night_logs,
      count(*) filter (where c.beer_name like '%— Fici —%')::int as draft_logs,
      count(*) filter (where c.beer_name like '%— Şişe/Kutu —%')::int as bottle_logs,
      count(distinct nullif(trim(c.city), ''))::int as unique_cities
    from public.checkins c
    where c.user_id = p_user_id
    group by c.user_id
  ),
  spot as (
    select
      c.user_id,
      coalesce(max(cnt), 0)::int as top_spot_count
    from (
      select
        c.user_id,
        coalesce(nullif(trim(c.city), ''), '-') || '::' || coalesce(nullif(trim(c.district), ''), '-') as spot_key,
        count(*)::int as cnt
      from public.checkins c
      where c.user_id = p_user_id
      group by c.user_id, coalesce(nullif(trim(c.city), ''), '-') || '::' || coalesce(nullif(trim(c.district), ''), '-')
    ) c
    group by c.user_id
  ),
  s as (
    select
      b.user_id,
      b.total_logs,
      b.saturday_logs,
      b.night_logs,
      b.draft_logs,
      b.bottle_logs,
      b.unique_cities,
      coalesce(sp.top_spot_count, 0) as top_spot_count
    from base b
    left join spot sp on sp.user_id = b.user_id
  ),
  ins as (
    insert into public.user_badges (user_id, badge_key, title_tr, title_en, detail_tr, detail_en, score, computed_at)
    select
      s.user_id,
      t.badge_key,
      t.title_tr,
      t.title_en,
      t.detail_tr,
      t.detail_en,
      t.score,
      now()
    from s
    cross join lateral (
      select
        'sat_committee'::text as badge_key,
        'Cumartesi Komitesi'::text as title_tr,
        'Saturday Committee'::text as title_en,
        format('%s Cumartesi logu', s.saturday_logs)::text as detail_tr,
        format('%s Saturday check-ins', s.saturday_logs)::text as detail_en,
        (s.saturday_logs * 10)::int as score
      where s.total_logs >= 8 and s.saturday_logs >= 4 and s.saturday_logs::numeric / nullif(s.total_logs, 0) >= 0.35
      union all
      select
        'night_owl',
        'Gece Baykuşu',
        'Night Owl',
        format('Gece logu: %s', s.night_logs),
        format('Night check-ins: %s', s.night_logs),
        (s.night_logs * 10)::int
      where s.total_logs >= 10 and s.night_logs >= 6 and s.night_logs::numeric / nullif(s.total_logs, 0) >= 0.35
      union all
      select
        'draft_loyalist',
        'Taslakçı',
        'Draft Loyalist',
        format('Fıçı oranı: %s%%', round((s.draft_logs::numeric / nullif(s.total_logs, 0)) * 100)),
        format('Draft ratio: %s%%', round((s.draft_logs::numeric / nullif(s.total_logs, 0)) * 100)),
        (s.draft_logs * 8)::int
      where s.total_logs >= 10 and s.draft_logs >= 6 and s.draft_logs::numeric / nullif(s.total_logs, 0) >= 0.60
      union all
      select
        'bottle_lover',
        'Şişeci',
        'Bottle Lover',
        format('Şişe/Kutu oranı: %s%%', round((s.bottle_logs::numeric / nullif(s.total_logs, 0)) * 100)),
        format('Bottle/can ratio: %s%%', round((s.bottle_logs::numeric / nullif(s.total_logs, 0)) * 100)),
        (s.bottle_logs * 8)::int
      where s.total_logs >= 10 and s.bottle_logs >= 6 and s.bottle_logs::numeric / nullif(s.total_logs, 0) >= 0.60
      union all
      select
        'nomad',
        'Pub Nomadı',
        'Pub Nomad',
        format('%s farklı şehir', s.unique_cities),
        format('%s different cities', s.unique_cities),
        (s.unique_cities * 15)::int
      where s.unique_cities >= 4
      union all
      select
        'regular',
        'Sadık Müdavim',
        'Local Regular',
        format('Aynı bölge yoğunluğu: %s%%', round((s.top_spot_count::numeric / nullif(s.total_logs, 0)) * 100)),
        format('Single-area share: %s%%', round((s.top_spot_count::numeric / nullif(s.total_logs, 0)) * 100)),
        (s.top_spot_count * 9)::int
      where s.total_logs >= 12 and s.top_spot_count >= 8 and s.top_spot_count::numeric / nullif(s.total_logs, 0) >= 0.45
    ) t
    returning 1
  )
  select count(*) into v_total from ins;

  return coalesce(v_total, 0);
end;
$$;

create or replace function public.refresh_my_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return 0;
  end if;
  return public.compute_and_store_user_badges(auth.uid());
end;
$$;

create or replace function public.refresh_all_user_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  total_count int := 0;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'not allowed';
  end if;

  for r in select p.user_id from public.profiles p loop
    total_count := total_count + public.compute_and_store_user_badges(r.user_id);
  end loop;
  return total_count;
end;
$$;

revoke all on function public.compute_and_store_user_badges(uuid) from public;
revoke all on function public.refresh_my_badges() from public;
revoke all on function public.refresh_all_user_badges() from public;
grant execute on function public.refresh_my_badges() to authenticated;
grant execute on function public.refresh_all_user_badges() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid) from cron.job where jobname = 'birader_refresh_user_badges_daily';
    exception when others then
      null;
    end;
    perform cron.schedule(
      'birader_refresh_user_badges_daily',
      '10 3 * * *',
      $$select public.refresh_all_user_badges();$$
    );
  end if;
exception when others then
  null;
end;
$$;

create table if not exists public.checkin_comments (
  id bigserial primary key,
  checkin_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint checkin_comments_body_len check (char_length(trim(body)) between 1 and 240)
);

create table if not exists public.checkin_share_invites (
  id bigserial primary key,
  source_checkin_id text not null,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  accepted_checkin_id text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint checkin_share_invites_status_check check (status in ('pending', 'accepted', 'declined')),
  constraint checkin_share_invites_not_self check (inviter_id <> invited_user_id),
  unique (source_checkin_id, invited_user_id)
);

create index if not exists idx_checkin_comments_checkin_time on public.checkin_comments (checkin_id, created_at desc);
create index if not exists idx_checkin_comments_user_time on public.checkin_comments (user_id, created_at desc);
create index if not exists idx_checkin_share_invites_invited_status on public.checkin_share_invites (invited_user_id, status, created_at desc);
create index if not exists idx_checkin_share_invites_inviter_time on public.checkin_share_invites (inviter_id, created_at desc);

alter table public.checkin_comments enable row level security;
alter table public.checkin_share_invites enable row level security;

drop policy if exists checkin_comments_read on public.checkin_comments;
create policy checkin_comments_read on public.checkin_comments
for select using (
  exists (
    select 1
    from public.checkins c
    left join public.profiles p on p.user_id = c.user_id
    where c.id::text = checkin_comments.checkin_id
      and (
        auth.uid() = c.user_id
        or coalesce(p.is_public, false) = true
      )
  )
);

drop policy if exists checkin_comments_insert on public.checkin_comments;
create policy checkin_comments_insert on public.checkin_comments
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.checkins c
    left join public.profiles p on p.user_id = c.user_id
    where c.id::text = checkin_comments.checkin_id
      and (
        auth.uid() = c.user_id
        or coalesce(p.is_public, false) = true
      )
  )
);

drop policy if exists checkin_comments_owner_delete on public.checkin_comments;
create policy checkin_comments_owner_delete on public.checkin_comments
for delete using (auth.uid() = user_id);

drop policy if exists checkin_share_invites_select on public.checkin_share_invites;
create policy checkin_share_invites_select on public.checkin_share_invites
for select using (auth.uid() = inviter_id or auth.uid() = invited_user_id);

drop policy if exists checkin_share_invites_insert on public.checkin_share_invites;
create policy checkin_share_invites_insert on public.checkin_share_invites
for insert with check (
  auth.uid() = inviter_id
  and exists (
    select 1
    from public.checkins c
    where c.id::text = checkin_share_invites.source_checkin_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists checkin_share_invites_invited_update on public.checkin_share_invites;
create policy checkin_share_invites_invited_update on public.checkin_share_invites
for update using (auth.uid() = invited_user_id)
with check (auth.uid() = invited_user_id);

create or replace function public.accept_checkin_share_invite(p_invite_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.checkin_share_invites%rowtype;
  new_checkin_id text;
begin
  select *
    into inv
  from public.checkin_share_invites
  where id = p_invite_id
    and invited_user_id = auth.uid()
  for update;

  if not found or inv.status <> 'pending' then
    return false;
  end if;

  insert into public.checkins (
    user_id,
    beer_name,
    rating,
    created_at,
    country_code,
    city,
    district,
    location_text,
    price_try,
    note,
    latitude,
    longitude
  )
  select
    inv.invited_user_id,
    c.beer_name,
    c.rating,
    c.created_at,
    coalesce(c.country_code, 'TR'),
    coalesce(c.city, ''),
    coalesce(c.district, ''),
    coalesce(c.location_text, ''),
    c.price_try,
    coalesce(c.note, ''),
    c.latitude,
    c.longitude
  from public.checkins c
  where c.id::text = inv.source_checkin_id
    and c.user_id = inv.inviter_id
  returning id::text into new_checkin_id;

  if new_checkin_id is null then
    return false;
  end if;

  update public.checkin_share_invites
  set status = 'accepted',
      accepted_checkin_id = new_checkin_id,
      responded_at = now()
  where id = inv.id;

  return true;
end;
$$;

revoke all on function public.accept_checkin_share_invite(bigint) from public;
grant execute on function public.accept_checkin_share_invite(bigint) to authenticated;

create table if not exists public.checkin_comment_likes (
  comment_id bigint not null references public.checkin_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.checkin_likes (
  checkin_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete cascade,
  type text not null,
  ref_id text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('comment', 'mention', 'comment_like', 'checkin_like', 'follow'))
);

create index if not exists idx_checkin_comment_likes_user_time on public.checkin_comment_likes (user_id, created_at desc);
create index if not exists idx_checkin_likes_user_time on public.checkin_likes (user_id, created_at desc);
create index if not exists idx_checkin_likes_checkin_time on public.checkin_likes (checkin_id, created_at desc);
create index if not exists idx_notifications_user_read_time on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_time on public.notifications (user_id, created_at desc);

alter table public.checkin_comment_likes enable row level security;
alter table public.checkin_likes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists checkin_comment_likes_read on public.checkin_comment_likes;
create policy checkin_comment_likes_read on public.checkin_comment_likes
for select using (
  exists (
    select 1
    from public.checkin_comments cc
    join public.checkins c on c.id::text = cc.checkin_id
    left join public.profiles p on p.user_id = c.user_id
    where cc.id = checkin_comment_likes.comment_id
      and (
        auth.uid() = c.user_id
        or coalesce(p.is_public, false) = true
      )
  )
);

drop policy if exists checkin_comment_likes_insert on public.checkin_comment_likes;
create policy checkin_comment_likes_insert on public.checkin_comment_likes
for insert with check (auth.uid() = user_id);

drop policy if exists checkin_comment_likes_delete on public.checkin_comment_likes;
create policy checkin_comment_likes_delete on public.checkin_comment_likes
for delete using (auth.uid() = user_id);

drop policy if exists checkin_likes_read on public.checkin_likes;
create policy checkin_likes_read on public.checkin_likes
for select using (
  exists (
    select 1
    from public.checkins c
    left join public.profiles p on p.user_id = c.user_id
    where c.id::text = checkin_likes.checkin_id
      and (
        auth.uid() = c.user_id
        or coalesce(p.is_public, false) = true
      )
  )
);

drop policy if exists checkin_likes_insert on public.checkin_likes;
create policy checkin_likes_insert on public.checkin_likes
for insert with check (auth.uid() = user_id);

drop policy if exists checkin_likes_delete on public.checkin_likes;
create policy checkin_likes_delete on public.checkin_likes
for delete using (auth.uid() = user_id);

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists notifications_insert_actor on public.notifications;
create policy notifications_insert_actor on public.notifications
for insert with check (
  auth.uid() = actor_id
  and user_id <> actor_id
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check check (type in ('comment', 'mention', 'comment_like', 'checkin_like', 'follow'));

alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists age_verified_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists commercial_consent_at timestamptz;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;

create index if not exists idx_profiles_birth_date on public.profiles (birth_date);
create index if not exists idx_profiles_marketing_opt_in on public.profiles (marketing_opt_in);

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
