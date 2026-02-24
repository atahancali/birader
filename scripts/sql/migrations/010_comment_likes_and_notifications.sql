-- 010_comment_likes_and_notifications.sql

create table if not exists public.checkin_comment_likes (
  comment_id bigint not null references public.checkin_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete cascade,
  type text not null,
  ref_id text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('comment', 'mention', 'comment_like'))
);

create index if not exists idx_checkin_comment_likes_user_time on public.checkin_comment_likes (user_id, created_at desc);
create index if not exists idx_notifications_user_read_time on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_time on public.notifications (user_id, created_at desc);

alter table public.checkin_comment_likes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists checkin_comment_likes_read on public.checkin_comment_likes;
create policy checkin_comment_likes_read on public.checkin_comment_likes
for select using (
  exists (
    select 1
    from public.checkin_comments cc
    join public.checkins c on c.id::text = cc.checkin_id
    left join public.profiles p on p.user_id = c.user_id
    where cc.id = checkin_comment_likes.comment_id
      and (
        auth.uid() = c.user_id
        or coalesce(p.is_public, false) = true
      )
  )
);

drop policy if exists checkin_comment_likes_insert on public.checkin_comment_likes;
create policy checkin_comment_likes_insert on public.checkin_comment_likes
for insert with check (auth.uid() = user_id);

drop policy if exists checkin_comment_likes_delete on public.checkin_comment_likes;
create policy checkin_comment_likes_delete on public.checkin_comment_likes
for delete using (auth.uid() = user_id);

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists notifications_insert_actor on public.notifications;
create policy notifications_insert_actor on public.notifications
for insert with check (
  auth.uid() = actor_id
  and user_id <> actor_id
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);
