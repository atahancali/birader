-- N1-02 RLS Audit
-- Run in Supabase SQL Editor.
-- This script is read-only (audit/report only).

with expected_tables(table_name) as (
  values
    ('profiles'),
    ('checkins'),
    ('follows'),
    ('favorite_beers'),
    ('analytics_events'),
    ('product_suggestions'),
    ('user_badges'),
    ('content_reports'),
    ('social_perf_events'),
    ('social_perf_daily'),
    ('beer_master'),
    ('beer_alias'),
    ('custom_beer_moderation_queue'),
    ('avatar_moderation_queue'),
    ('checkin_comments'),
    ('checkin_share_invites'),
    ('checkin_comment_likes'),
    ('checkin_likes'),
    ('notifications'),
    ('profile_identity_history'),
    ('app_action_logs'),
    ('user_daily_metrics')
),
table_status as (
  select
    e.table_name,
    c.oid as table_oid,
    c.relrowsecurity as rls_enabled,
    case
      when c.oid is null then 'missing_table'
      when c.relrowsecurity then 'ok'
      else 'missing_rls'
    end as status
  from expected_tables e
  left join pg_class c
    on c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and c.relname = e.table_name
)
select
  table_name,
  status,
  coalesce(rls_enabled, false) as rls_enabled
from table_status
order by table_name;

with expected_policies(table_name, policy_name) as (
  values
    ('profiles', 'profiles_public_read'),
    ('profiles', 'profiles_owner_insert'),
    ('profiles', 'profiles_owner_update'),
    ('checkins', 'checkins_public_read'),
    ('checkins', 'checkins_owner_insert'),
    ('checkins', 'checkins_owner_update'),
    ('checkins', 'checkins_owner_delete'),
    ('follows', 'follows_read_all'),
    ('follows', 'follows_owner_insert'),
    ('follows', 'follows_owner_delete'),
    ('favorite_beers', 'favorite_beers_public_read'),
    ('favorite_beers', 'favorite_beers_owner_insert'),
    ('favorite_beers', 'favorite_beers_owner_update'),
    ('favorite_beers', 'favorite_beers_owner_delete'),
    ('checkin_comments', 'checkin_comments_read'),
    ('checkin_comments', 'checkin_comments_insert'),
    ('checkin_comments', 'checkin_comments_owner_delete'),
    ('checkin_share_invites', 'checkin_share_invites_select'),
    ('checkin_share_invites', 'checkin_share_invites_insert'),
    ('checkin_share_invites', 'checkin_share_invites_invited_update'),
    ('checkin_comment_likes', 'checkin_comment_likes_read'),
    ('checkin_comment_likes', 'checkin_comment_likes_insert'),
    ('checkin_comment_likes', 'checkin_comment_likes_delete'),
    ('checkin_likes', 'checkin_likes_read'),
    ('checkin_likes', 'checkin_likes_insert'),
    ('checkin_likes', 'checkin_likes_delete'),
    ('notifications', 'notifications_read_own'),
    ('notifications', 'notifications_insert_actor'),
    ('notifications', 'notifications_update_own'),
    ('analytics_events', 'analytics_insert_auth'),
    ('product_suggestions', 'product_suggestions_insert_auth'),
    ('product_suggestions', 'product_suggestions_read_own_or_admin'),
    ('product_suggestions', 'product_suggestions_update_admin'),
    ('content_reports', 'content_reports_insert_auth'),
    ('content_reports', 'content_reports_read_admin'),
    ('content_reports', 'content_reports_update_admin'),
    ('user_badges', 'user_badges_read_public_or_owner'),
    ('user_badges', 'user_badges_admin_write')
),
policy_status as (
  select
    ep.table_name,
    ep.policy_name,
    case when p.oid is null then 'missing_policy' else 'ok' end as status
  from expected_policies ep
  left join pg_class c
    on c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and c.relname = ep.table_name
  left join pg_policy p
    on p.polrelid = c.oid
   and p.polname = ep.policy_name
)
select
  table_name,
  policy_name,
  status
from policy_status
order by table_name, policy_name;

with table_summary as (
  with expected_tables(table_name) as (
    values
      ('profiles'),
      ('checkins'),
      ('follows'),
      ('favorite_beers'),
      ('analytics_events'),
      ('product_suggestions'),
      ('user_badges'),
      ('content_reports'),
      ('social_perf_events'),
      ('social_perf_daily'),
      ('beer_master'),
      ('beer_alias'),
      ('custom_beer_moderation_queue'),
      ('avatar_moderation_queue'),
      ('checkin_comments'),
      ('checkin_share_invites'),
      ('checkin_comment_likes'),
      ('checkin_likes'),
      ('notifications'),
      ('profile_identity_history'),
      ('app_action_logs'),
      ('user_daily_metrics')
  )
  select
    count(*) filter (where c.oid is not null) as existing_tables,
    count(*) filter (where c.oid is null) as missing_tables,
    count(*) filter (where c.oid is not null and c.relrowsecurity = false) as rls_missing_tables
  from expected_tables e
  left join pg_class c
    on c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and c.relname = e.table_name
),
policy_summary as (
  with expected_policies(table_name, policy_name) as (
    values
      ('profiles', 'profiles_public_read'),
      ('profiles', 'profiles_owner_insert'),
      ('profiles', 'profiles_owner_update'),
      ('checkins', 'checkins_public_read'),
      ('checkins', 'checkins_owner_insert'),
      ('checkins', 'checkins_owner_update'),
      ('checkins', 'checkins_owner_delete'),
      ('follows', 'follows_read_all'),
      ('follows', 'follows_owner_insert'),
      ('follows', 'follows_owner_delete'),
      ('favorite_beers', 'favorite_beers_public_read'),
      ('favorite_beers', 'favorite_beers_owner_insert'),
      ('favorite_beers', 'favorite_beers_owner_update'),
      ('favorite_beers', 'favorite_beers_owner_delete'),
      ('checkin_comments', 'checkin_comments_read'),
      ('checkin_comments', 'checkin_comments_insert'),
      ('checkin_comments', 'checkin_comments_owner_delete'),
      ('checkin_share_invites', 'checkin_share_invites_select'),
      ('checkin_share_invites', 'checkin_share_invites_insert'),
      ('checkin_share_invites', 'checkin_share_invites_invited_update'),
      ('checkin_comment_likes', 'checkin_comment_likes_read'),
      ('checkin_comment_likes', 'checkin_comment_likes_insert'),
      ('checkin_comment_likes', 'checkin_comment_likes_delete'),
      ('checkin_likes', 'checkin_likes_read'),
      ('checkin_likes', 'checkin_likes_insert'),
      ('checkin_likes', 'checkin_likes_delete'),
      ('notifications', 'notifications_read_own'),
      ('notifications', 'notifications_insert_actor'),
      ('notifications', 'notifications_update_own'),
      ('analytics_events', 'analytics_insert_auth'),
      ('product_suggestions', 'product_suggestions_insert_auth'),
      ('product_suggestions', 'product_suggestions_read_own_or_admin'),
      ('product_suggestions', 'product_suggestions_update_admin'),
      ('content_reports', 'content_reports_insert_auth'),
      ('content_reports', 'content_reports_read_admin'),
      ('content_reports', 'content_reports_update_admin'),
      ('user_badges', 'user_badges_read_public_or_owner'),
      ('user_badges', 'user_badges_admin_write')
  )
  select
    count(*) as expected_policy_count,
    count(*) filter (where p.oid is not null) as existing_policy_count,
    count(*) filter (where p.oid is null) as missing_policy_count
  from expected_policies ep
  left join pg_class c
    on c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and c.relname = ep.table_name
  left join pg_policy p
    on p.polrelid = c.oid
   and p.polname = ep.policy_name
)
select
  ts.existing_tables,
  ts.missing_tables,
  ts.rls_missing_tables,
  ps.expected_policy_count,
  ps.existing_policy_count,
  ps.missing_policy_count,
  case
    when ts.missing_tables = 0 and ts.rls_missing_tables = 0 and ps.missing_policy_count = 0 then 'PASS'
    else 'FAIL'
  end as n1_rls_audit_result
from table_summary ts
cross join policy_summary ps;
