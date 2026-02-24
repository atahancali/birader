-- 007_checkins_delete_rpc.sql

create or replace function public.delete_own_checkin(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int := 0;
begin
  delete from public.checkins
  where id::text = p_id
    and user_id = auth.uid();

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.delete_own_checkin(text) from public;
grant execute on function public.delete_own_checkin(text) to authenticated;
