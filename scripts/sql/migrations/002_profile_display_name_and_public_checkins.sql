-- 002_profile_display_name_and_public_checkins.sql

alter table public.profiles add column if not exists display_name text not null default '';
create index if not exists idx_profiles_display_name on public.profiles (display_name);

alter table public.checkins enable row level security;

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

update public.profiles
set display_name = username
where coalesce(trim(display_name), '') = '';
