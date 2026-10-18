-- Isolated Supabase mosaic-dev migration source. Original hardening deployed as
-- candidate_owner_atomic_cas_rpc_only + fix_candidate_cas_jsonb_empty_object_guard.
-- This file is the introspected FINAL state of the two functions, suitable only
-- for a freshly initialized disposable candidate after its prior migrations.
-- Not wired to CI/app startup. Never apply to Production without separate approval.
-- Authenticated API callers cannot directly UPDATE or DELETE candidate rows;
-- the two reviewed SECURITY DEFINER RPCs are the only update entry points.
-- Security Advisor intentionally reports these callable elevated functions.
revoke all on public.mosaic_candidate_tasks,public.mosaic_candidate_categories from authenticated,anon,public;
grant select,insert on public.mosaic_candidate_tasks,public.mosaic_candidate_categories to authenticated;

CREATE OR REPLACE FUNCTION public.mosaic_candidate_cas_category(p_id text, p_expected_seq bigint, p_patch jsonb)
 RETURNS mosaic_candidate_categories
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  principal uuid := auth.uid();
  result public.mosaic_candidate_categories;
begin
  if principal is null then raise exception 'Unauthenticated' using errcode='42501'; end if;
  if p_id is null or p_expected_seq is null or p_expected_seq<1
    or jsonb_typeof(p_patch) is distinct from 'object'
    or p_patch = '{}'::jsonb
    or exists(select 1 from jsonb_object_keys(p_patch) as key
      where key not in ('name','color','order_index','visibility','icon','updated_at','is_deleted'))
  then raise exception 'Invalid category CAS request' using errcode='22023';end if;

  update public.mosaic_candidate_categories as c
     set name=case when p_patch?'name' then p_patch->>'name' else c.name end,
         color=case when p_patch?'color' then p_patch->>'color' else c.color end,
         order_index=case when p_patch?'order_index' then (p_patch->>'order_index')::integer else c.order_index end,
         visibility=case when p_patch?'visibility' then p_patch->>'visibility' else c.visibility end,
         icon=case when p_patch?'icon' then p_patch->>'icon' else c.icon end,
         updated_at=case when p_patch?'updated_at' then p_patch->>'updated_at' else c.updated_at end,
         is_deleted=case when p_patch?'is_deleted' then (p_patch->>'is_deleted')::boolean else c.is_deleted end
   where c.owner_id=principal and c.id=p_id and c.change_seq=p_expected_seq
  returning c.* into result;
  return result; -- NULL result means missing/foreign/stale. Caller then reads its own master.
end
$function$;

revoke all on function public.mosaic_candidate_cas_category(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.mosaic_candidate_cas_category(text,bigint,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.mosaic_candidate_cas_task(p_id text, p_expected_seq bigint, p_patch jsonb)
 RETURNS mosaic_candidate_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  principal uuid := auth.uid();
  result public.mosaic_candidate_tasks;
begin
  if principal is null then raise exception 'Unauthenticated' using errcode='42501'; end if;
  if p_id is null or p_expected_seq is null or p_expected_seq<1
    or jsonb_typeof(p_patch) is distinct from 'object'
    or p_patch = '{}'::jsonb
    or exists(select 1 from jsonb_object_keys(p_patch) as key
      where key not in ('title','completed','category_id','order_index','tags','task_date','memo',
        'image','created_at','completed_at','updated_at','source','routine_id','reminder_time',
        'reactions','visibility','is_deleted'))
  then raise exception 'Invalid task CAS request' using errcode='22023';end if;

  update public.mosaic_candidate_tasks as t
     set title=case when p_patch?'title' then p_patch->>'title' else t.title end,
         completed=case when p_patch?'completed' then (p_patch->>'completed')::boolean else t.completed end,
         category_id=case when p_patch?'category_id' then p_patch->>'category_id' else t.category_id end,
         order_index=case when p_patch?'order_index' then (p_patch->>'order_index')::integer else t.order_index end,
         tags=case when p_patch?'tags' then p_patch->>'tags' else t.tags end,
         task_date=case when p_patch?'task_date' then p_patch->>'task_date' else t.task_date end,
         memo=case when p_patch?'memo' then p_patch->>'memo' else t.memo end,
         image=case when p_patch?'image' then p_patch->>'image' else t.image end,
         created_at=case when p_patch?'created_at' then p_patch->>'created_at' else t.created_at end,
         completed_at=case when p_patch?'completed_at' then p_patch->>'completed_at' else t.completed_at end,
         updated_at=case when p_patch?'updated_at' then p_patch->>'updated_at' else t.updated_at end,
         source=case when p_patch?'source' then p_patch->>'source' else t.source end,
         routine_id=case when p_patch?'routine_id' then p_patch->>'routine_id' else t.routine_id end,
         reminder_time=case when p_patch?'reminder_time' then p_patch->>'reminder_time' else t.reminder_time end,
         reactions=case when p_patch?'reactions' then p_patch->>'reactions' else t.reactions end,
         visibility=case when p_patch?'visibility' then p_patch->>'visibility' else t.visibility end,
         is_deleted=case when p_patch?'is_deleted' then (p_patch->>'is_deleted')::boolean else t.is_deleted end
   where t.owner_id=principal and t.id=p_id and t.change_seq=p_expected_seq
  returning t.* into result;
  return result;
end
$function$;

revoke all on function public.mosaic_candidate_cas_task(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.mosaic_candidate_cas_task(text,bigint,jsonb) to authenticated;

