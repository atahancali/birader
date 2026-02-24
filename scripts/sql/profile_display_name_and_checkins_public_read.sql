-- Existing projects migration:
-- 1) Add mutable display_name next to immutable username(handle)
-- 2) Allow public profile checkins to be readable for profile heatmap/feed views

alter table public.profiles
  add column if not exists display_name text not null default '';

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
