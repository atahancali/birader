-- 005_checkins_city_district.sql

alter table public.checkins add column if not exists country_code text not null default 'TR';
alter table public.checkins add column if not exists city text not null default '';
alter table public.checkins add column if not exists district text not null default '';

create index if not exists idx_checkins_city_district on public.checkins (city, district);
