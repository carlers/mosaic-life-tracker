-- Disposable mosaic-dev only; SECURITY DEFINER candidate CAS regression.
-- SQL simulates JWT claims under SET LOCAL ROLE. NOT real Auth SDK testing.
-- No real user information; all temporary rows and counters are rolled back.
begin;
insert into public.mosaic_candidate_categories(owner_id,id,name,color,order_index,updated_at)
values ('11111111-1111-4111-8111-111111111111','probe_cat_A','original','#abc',0,'start'),
       ('22222222-2222-4222-8222-222222222222','probe_cat_B','private','#def',0,'start');
insert into public.mosaic_candidate_tasks(owner_id,id,title,category_id,order_index,task_date,created_at,updated_at)
values ('11111111-1111-4111-8111-111111111111','probe_task_A','original','probe_cat_A',0,'2026-10-18','start','start'),
       ('22222222-2222-4222-8222-222222222222','probe_task_B','private','probe_cat_B',0,'2026-10-18','start','start');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $tests$
declare denied boolean; revision bigint; category_row public.mosaic_candidate_categories; task_row public.mosaic_candidate_tasks; count_rows int;
begin
  denied:=false;
  begin update public.mosaic_candidate_tasks set title='bypass' where id='probe_task_A';
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unconditional task UPDATE permitted'; end if;
  denied:=false;
  begin update public.mosaic_candidate_categories set name='bypass' where id='probe_cat_A';
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unconditional category UPDATE permitted'; end if;

  select change_seq into revision from public.mosaic_candidate_categories where id='probe_cat_A';
  select * into category_row from public.mosaic_candidate_cas_category('probe_cat_A',revision,'{"name":"updated"}'::jsonb);
  if category_row.id is distinct from 'probe_cat_A' or category_row.change_seq<=revision
    then raise exception 'Valid category CAS failed'; end if;

  select * into category_row from public.mosaic_candidate_cas_category('probe_cat_A',revision,'{"name":"stale"}'::jsonb);
  if category_row.id is not null then raise exception 'Stale category CAS succeeded'; end if;
  select * into category_row from public.mosaic_candidate_cas_category('probe_cat_B',1,'{"name":"hijacked"}'::jsonb);
  if category_row.id is not null then raise exception 'Foreign owner category CAS succeeded'; end if;

  select change_seq into revision from public.mosaic_candidate_tasks where id='probe_task_A';
  select * into task_row from public.mosaic_candidate_cas_task('probe_task_A',revision,'{"is_deleted":true}'::jsonb);
  if task_row.id is distinct from 'probe_task_A' or not task_row.is_deleted
    then raise exception 'Task tombstone CAS failed'; end if;
  select * into task_row from public.mosaic_candidate_cas_task('probe_task_A',revision,'{"title":"stale"}'::jsonb);
  if task_row.id is not null then raise exception 'Stale task CAS succeeded'; end if;
  select * into task_row from public.mosaic_candidate_cas_task('probe_task_B',1,'{"title":"hijack"}'::jsonb);
  if task_row.id is not null then raise exception 'Foreign owner task CAS succeeded'; end if;

  denied:=false;
  begin perform public.mosaic_candidate_cas_task('probe_task_A',1,'{"owner_id":"22222222-2222-4222-8222-222222222222"}'::jsonb);
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Owner field injection permitted'; end if;
  denied:=false;
  begin perform public.mosaic_candidate_cas_task('probe_task_A',1,'{}'::jsonb);
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Empty patch permitted'; end if;
  select count(*) into count_rows from public.mosaic_candidate_tasks;
  if count_rows<>1 then raise exception 'Cross-owner SELECT leaked'; end if;
end
$tests$;
set local role anon;
do $anon$
declare denied boolean := false;
begin
  begin
    perform public.mosaic_candidate_cas_category('probe_cat_A',1,'{"name":"hijack"}'::jsonb);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous CAS function EXECUTE permitted'; end if;
  denied:=false;
  begin
    perform public.mosaic_candidate_cas_task('probe_task_A',1,'{"title":"hijack"}'::jsonb);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous task CAS EXECUTE permitted'; end if;
end
$anon$;
rollback;
