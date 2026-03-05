-- N1-02 Minimum RLS policy fixes
-- Run in Supabase SQL Editor.
-- Safe to re-run. This script restores critical policies if missing/drifted.

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    execute 'drop policy if exists profiles_public_read on public.profiles';
    execute 'create policy profiles_public_read on public.profiles for select using (is_public = true or auth.uid() = user_id)';
    execute 'drop policy if exists profiles_owner_insert on public.profiles';
    execute 'create policy profiles_owner_insert on public.profiles for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists profiles_owner_update on public.profiles';
    execute 'create policy profiles_owner_update on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;

  if to_regclass('public.checkins') is not null then
    execute 'alter table public.checkins enable row level security';
    execute 'drop policy if exists checkins_public_read on public.checkins';
    execute $sql$
      create policy checkins_public_read on public.checkins
      for select using (
        deleted_at is null
        and (
          auth.uid() = user_id
          or exists (
            select 1
            from public.profiles p
            where p.user_id = checkins.user_id
              and p.is_public = true
          )
        )
      )
    $sql$;
    execute 'drop policy if exists checkins_owner_insert on public.checkins';
    execute 'create policy checkins_owner_insert on public.checkins for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists checkins_owner_update on public.checkins';
    execute 'create policy checkins_owner_update on public.checkins for update using (auth.uid() = user_id and deleted_at is null) with check (auth.uid() = user_id)';
    execute 'drop policy if exists checkins_owner_delete on public.checkins';
    execute 'create policy checkins_owner_delete on public.checkins for delete using (auth.uid() = user_id and deleted_at is null)';
  end if;

  if to_regclass('public.follows') is not null then
    execute 'alter table public.follows enable row level security';
    execute 'drop policy if exists follows_read_all on public.follows';
    execute 'create policy follows_read_all on public.follows for select using (true)';
    execute 'drop policy if exists follows_owner_insert on public.follows';
    execute 'create policy follows_owner_insert on public.follows for insert with check (auth.uid() = follower_id)';
    execute 'drop policy if exists follows_owner_delete on public.follows';
    execute 'create policy follows_owner_delete on public.follows for delete using (auth.uid() = follower_id)';
  end if;

  if to_regclass('public.favorite_beers') is not null then
    execute 'alter table public.favorite_beers enable row level security';
    execute 'drop policy if exists favorite_beers_public_read on public.favorite_beers';
    execute $sql$
      create policy favorite_beers_public_read on public.favorite_beers
      for select using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = favorite_beers.user_id
            and (p.is_public = true or p.user_id = auth.uid())
        )
      )
    $sql$;
    execute 'drop policy if exists favorite_beers_owner_insert on public.favorite_beers';
    execute 'create policy favorite_beers_owner_insert on public.favorite_beers for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists favorite_beers_owner_update on public.favorite_beers';
    execute 'create policy favorite_beers_owner_update on public.favorite_beers for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'drop policy if exists favorite_beers_owner_delete on public.favorite_beers';
    execute 'create policy favorite_beers_owner_delete on public.favorite_beers for delete using (auth.uid() = user_id)';
  end if;

  if to_regclass('public.checkin_comments') is not null then
    execute 'alter table public.checkin_comments enable row level security';
    execute 'drop policy if exists checkin_comments_read on public.checkin_comments';
    execute $sql$
      create policy checkin_comments_read on public.checkin_comments
      for select using (
        exists (
          select 1
          from public.checkins c
          left join public.profiles p on p.user_id = c.user_id
          where c.id::text = checkin_comments.checkin_id
            and c.deleted_at is null
            and (
              auth.uid() = c.user_id
              or coalesce(p.is_public, false) = true
            )
        )
      )
    $sql$;
    execute 'drop policy if exists checkin_comments_insert on public.checkin_comments';
    execute $sql$
      create policy checkin_comments_insert on public.checkin_comments
      for insert with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.checkins c
          left join public.profiles p on p.user_id = c.user_id
          where c.id::text = checkin_comments.checkin_id
            and c.deleted_at is null
            and (
              auth.uid() = c.user_id
              or coalesce(p.is_public, false) = true
            )
        )
      )
    $sql$;
    execute 'drop policy if exists checkin_comments_owner_delete on public.checkin_comments';
    execute 'create policy checkin_comments_owner_delete on public.checkin_comments for delete using (auth.uid() = user_id)';
  end if;

  if to_regclass('public.checkin_share_invites') is not null then
    execute 'alter table public.checkin_share_invites enable row level security';
    execute 'drop policy if exists checkin_share_invites_select on public.checkin_share_invites';
    execute 'create policy checkin_share_invites_select on public.checkin_share_invites for select using (auth.uid() = inviter_id or auth.uid() = invited_user_id)';
    execute 'drop policy if exists checkin_share_invites_insert on public.checkin_share_invites';
    execute $sql$
      create policy checkin_share_invites_insert on public.checkin_share_invites
      for insert with check (
        auth.uid() = inviter_id
        and exists (
          select 1
          from public.checkins c
          where c.id::text = checkin_share_invites.source_checkin_id
            and c.user_id = auth.uid()
            and c.deleted_at is null
        )
      )
    $sql$;
    execute 'drop policy if exists checkin_share_invites_invited_update on public.checkin_share_invites';
    execute 'create policy checkin_share_invites_invited_update on public.checkin_share_invites for update using (auth.uid() = invited_user_id) with check (auth.uid() = invited_user_id)';
  end if;

  if to_regclass('public.checkin_comment_likes') is not null then
    execute 'alter table public.checkin_comment_likes enable row level security';
    execute 'drop policy if exists checkin_comment_likes_read on public.checkin_comment_likes';
    execute $sql$
      create policy checkin_comment_likes_read on public.checkin_comment_likes
      for select using (
        exists (
          select 1
          from public.checkin_comments cc
          join public.checkins c on c.id::text = cc.checkin_id
          left join public.profiles p on p.user_id = c.user_id
          where cc.id = checkin_comment_likes.comment_id
            and c.deleted_at is null
            and (
              auth.uid() = c.user_id
              or coalesce(p.is_public, false) = true
            )
        )
      )
    $sql$;
    execute 'drop policy if exists checkin_comment_likes_insert on public.checkin_comment_likes';
    execute 'create policy checkin_comment_likes_insert on public.checkin_comment_likes for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists checkin_comment_likes_delete on public.checkin_comment_likes';
    execute 'create policy checkin_comment_likes_delete on public.checkin_comment_likes for delete using (auth.uid() = user_id)';
  end if;

  if to_regclass('public.checkin_likes') is not null then
    execute 'alter table public.checkin_likes enable row level security';
    execute 'drop policy if exists checkin_likes_read on public.checkin_likes';
    execute $sql$
      create policy checkin_likes_read on public.checkin_likes
      for select using (
        exists (
          select 1
          from public.checkins c
          left join public.profiles p on p.user_id = c.user_id
          where c.id::text = checkin_likes.checkin_id
            and c.deleted_at is null
            and (
              auth.uid() = c.user_id
              or coalesce(p.is_public, false) = true
            )
        )
      )
    $sql$;
    execute 'drop policy if exists checkin_likes_insert on public.checkin_likes';
    execute 'create policy checkin_likes_insert on public.checkin_likes for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists checkin_likes_delete on public.checkin_likes';
    execute 'create policy checkin_likes_delete on public.checkin_likes for delete using (auth.uid() = user_id)';
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'alter table public.notifications enable row level security';
    execute 'drop policy if exists notifications_read_own on public.notifications';
    execute 'create policy notifications_read_own on public.notifications for select using (auth.uid() = user_id)';
    execute 'drop policy if exists notifications_insert_actor on public.notifications';
    execute 'create policy notifications_insert_actor on public.notifications for insert with check ((auth.uid() = actor_id and user_id <> actor_id) or (auth.uid() = user_id and actor_id is null and type = ''system''))';
    execute 'drop policy if exists notifications_update_own on public.notifications';
    execute 'create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;

  if to_regclass('public.analytics_events') is not null then
    execute 'alter table public.analytics_events enable row level security';
    execute 'drop policy if exists analytics_insert_auth on public.analytics_events';
    execute 'create policy analytics_insert_auth on public.analytics_events for insert with check (auth.uid() is not null)';
  end if;
end;
$$;
