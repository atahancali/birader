-- Add optional rich check-in metadata
alter table public.checkins add column if not exists location_text text not null default '';
alter table public.checkins add column if not exists price_try numeric(10,2);
alter table public.checkins add column if not exists note text not null default '';
alter table public.checkins add column if not exists latitude double precision;
alter table public.checkins add column if not exists longitude double precision;

create index if not exists idx_checkins_location_text on public.checkins (location_text);
create index if not exists idx_checkins_geo on public.checkins (latitude, longitude);
