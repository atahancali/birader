-- 003_checkins_nullable_rating.sql

alter table public.checkins alter column rating drop not null;
