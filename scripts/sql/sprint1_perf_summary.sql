-- sprint1_perf_summary.sql
-- Tek calistirmada Sprint 1'in 5 kritik sorgusunu olcer.
-- Cikti: query_key, execution_ms, has_seq_scan

set statement_timeout = '30s';

create temp table if not exists tmp_sprint1_perf_summary (
  query_key text primary key,
  execution_ms numeric,
  has_seq_scan boolean
);

truncate table tmp_sprint1_perf_summary;

do $$
declare
  v_plan jsonb;
begin
  -- Q1: feed all 24h
  execute $q1$
    explain (analyze, buffers, format json)
    with p as (
      select
        coalesce(
          auth.uid(),
          (select user_id from public.profiles order by created_at asc limit 1)
        ) as me,
        now() - interval '24 hours' as ts_from,
        25::int as lim
    )
    select
      c.id,
      c.user_id,
      c.beer_name,
      c.rating,
      c.created_at
    from public.checkins c
    left join public.profiles owner on owner.user_id = c.user_id
    cross join p
    where c.created_at >= p.ts_from
      and (
        c.user_id = p.me
        or coalesce(owner.is_public, false) = true
      )
    order by c.created_at desc
    limit (select lim from p)
  $q1$ into v_plan;

  insert into tmp_sprint1_perf_summary(query_key, execution_ms, has_seq_scan)
  values (
    'q1_feed_all_24h',
    coalesce((v_plan->0->>'Execution Time')::numeric, 0),
    (v_plan::text ilike '%Seq Scan%')
  );

  -- Q2: feed following 24h
  execute $q2$
    explain (analyze, buffers, format json)
    with p as (
      select
        coalesce(
          auth.uid(),
          (select follower_id from public.follows order by created_at asc limit 1),
          (select user_id from public.profiles order by created_at asc limit 1)
        ) as me,
        now() - interval '24 hours' as ts_from,
        25::int as lim
    )
    select
      c.id,
      c.user_id,
      c.beer_name,
      c.rating,
      c.created_at
    from public.checkins c
    join public.follows f on f.following_id = c.user_id
    cross join p
    where f.follower_id = p.me
      and c.created_at >= p.ts_from
    order by c.created_at desc
    limit (select lim from p)
  $q2$ into v_plan;

  insert into tmp_sprint1_perf_summary(query_key, execution_ms, has_seq_scan)
  values (
    'q2_feed_following_24h',
    coalesce((v_plan->0->>'Execution Time')::numeric, 0),
    (v_plan::text ilike '%Seq Scan%')
  );

  -- Q3: notifications + actor
  execute $q3$
    explain (analyze, buffers, format json)
    with p as (
      select
        coalesce(
          auth.uid(),
          (select user_id from public.notifications order by created_at desc limit 1),
          (select user_id from public.profiles order by created_at asc limit 1)
        ) as me,
        30::int as lim
    )
    select
      n.id,
      n.type,
      n.ref_id,
      n.is_read,
      n.created_at,
      actor.username,
      actor.display_name
    from public.notifications n
    left join public.profiles actor on actor.user_id = n.actor_id
    cross join p
    where n.user_id = p.me
    order by n.created_at desc
    limit (select lim from p)
  $q3$ into v_plan;

  insert into tmp_sprint1_perf_summary(query_key, execution_ms, has_seq_scan)
  values (
    'q3_notifications_actor',
    coalesce((v_plan->0->>'Execution Time')::numeric, 0),
    (v_plan::text ilike '%Seq Scan%')
  );

  -- Q4: discover rpc
  execute $q4$
    explain (analyze, buffers, format json)
    select * from public.get_discover_profiles(20)
  $q4$ into v_plan;

  insert into tmp_sprint1_perf_summary(query_key, execution_ms, has_seq_scan)
  values (
    'q4_discover_rpc',
    coalesce((v_plan->0->>'Execution Time')::numeric, 0),
    (v_plan::text ilike '%Seq Scan%')
  );

  -- Q5: leaderboard rpc
  execute $q5$
    explain (analyze, buffers, format json)
    select * from public.get_social_leaderboard('7d', 'all')
  $q5$ into v_plan;

  insert into tmp_sprint1_perf_summary(query_key, execution_ms, has_seq_scan)
  values (
    'q5_leaderboard_rpc',
    coalesce((v_plan->0->>'Execution Time')::numeric, 0),
    (v_plan::text ilike '%Seq Scan%')
  );
end;
$$;

select
  query_key,
  execution_ms,
  has_seq_scan
from tmp_sprint1_perf_summary
order by query_key;
