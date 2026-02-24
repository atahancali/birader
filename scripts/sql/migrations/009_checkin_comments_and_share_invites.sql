-- 009_checkin_comments_and_share_invites.sql

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
