-- 006_checkins_write_policies.sql

alter table public.checkins enable row level security;

drop policy if exists checkins_owner_insert on public.checkins;
create policy checkins_owner_insert on public.checkins
for insert with check (auth.uid() = user_id);

drop policy if exists checkins_owner_update on public.checkins;
create policy checkins_owner_update on public.checkins
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists checkins_owner_delete on public.checkins;
create policy checkins_owner_delete on public.checkins
for delete using (auth.uid() = user_id);
