-- 011_profiles_legal_and_commercial_fields.sql

alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists age_verified_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists commercial_consent_at timestamptz;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;

create index if not exists idx_profiles_birth_date on public.profiles (birth_date);
create index if not exists idx_profiles_marketing_opt_in on public.profiles (marketing_opt_in);
