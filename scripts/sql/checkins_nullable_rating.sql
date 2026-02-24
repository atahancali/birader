-- Allow unrated check-ins
alter table public.checkins alter column rating drop not null;
