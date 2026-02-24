-- 008_product_suggestions.sql

create table if not exists public.product_suggestions (
  id bigserial primary key,
  user_id uuid null references auth.users(id) on delete set null,
  category text not null default 'general',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_product_suggestions_created_at on public.product_suggestions (created_at desc);

alter table public.product_suggestions enable row level security;

drop policy if exists product_suggestions_insert_auth on public.product_suggestions;
create policy product_suggestions_insert_auth on public.product_suggestions
for insert with check (auth.uid() = user_id);

revoke all on public.product_suggestions from anon;
revoke all on public.product_suggestions from authenticated;
grant insert on public.product_suggestions to authenticated;
