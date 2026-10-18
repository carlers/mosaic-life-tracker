-- Run ONLY on Supabase mosaic-dev after the two candidate migrations.
-- Simulated authenticated roles, NOT a real JWT/SDK/Realtime acceptance test.
-- Everything is rolled back, including internal revision counter rows.
begin;
insert into public.mosaic_candidate_categories(owner_id,id,name,color,order_index,visibility,updated_at)
values('11111111-1111-4111-8111-111111111111','category-A','A','#000',0,'public','2026-10-18'),
('22222222-2222-4222-8222-222222222222','category-B','B','#000',0,'public','2026-10-18');
insert into public.mosaic_candidate_tasks(owner_id,id,title,category_id,order_index,task_date,created_at,updated_at,visibility)
values('11111111-1111-4111-8111-111111111111','task-A','Alice','category-A',0,'2026-10-18','2026-10-18','2026-10-18','public'),
('22222222-2222-4222-8222-222222222222','task-B','Bob','category-B',0,'2026-10-18','2026-10-18','2026-10-18','public');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $test$
declare n int; s1 bigint; s2 bigint; denied boolean;
begin
 select count(*) into n from public.mosaic_candidate_tasks;
 if n<>1 then raise exception 'task owner SELECT leak'; end if;
 select count(*) into n from public.mosaic_candidate_categories;
 if n<>1 then raise exception 'category owner SELECT leak'; end if;
 select change_seq into s1 from public.mosaic_candidate_categories where id='category-A';
 select change_seq into s2 from public.mosaic_candidate_tasks where id='task-A';
 if s1<>1 or s2<>2 then raise exception 'initial sequence failed % %',s1,s2;end if;
 update public.mosaic_candidate_tasks
   set completed=true, change_seq=0, server_updated_at='2000-01-01'
   where id='task-A' and change_seq=2;
 get diagnostics n=row_count;if n<>1 then raise exception 'CAS update failed';end if;
 select change_seq into s2 from public.mosaic_candidate_tasks where id='task-A';
 if s2<>3 then raise exception 'server revision bypass %',s2;end if;
 update public.mosaic_candidate_tasks set title='stale' where id='task-A' and change_seq=2;
 get diagnostics n=row_count;if n<>0 then raise exception 'stale CAS update succeeded';end if;
 update public.mosaic_candidate_categories set name='A2' where id='category-A' and change_seq=1;
 select change_seq into s1 from public.mosaic_candidate_categories where id='category-A';
 if s1<>4 then raise exception 'shared sequence failed %',s1;end if;
 update public.mosaic_candidate_tasks set title='hijack' where id='task-B';
 get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner write succeeded';end if;
 denied:=false;
 begin
   insert into public.mosaic_candidate_tasks(owner_id,id,title,order_index,task_date,created_at,updated_at)
   values('22222222-2222-4222-8222-222222222222','forged','forged',0,'2026-10-18','x','x');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'cross-owner insert succeeded';end if;
 denied:=false;
 begin
   update public.mosaic_candidate_tasks set owner_id='22222222-2222-4222-8222-222222222222'
   where id='task-A';
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'owner mutation succeeded';end if;
 denied:=false;
 begin delete from public.mosaic_candidate_tasks where id='task-A';
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'hard DELETE still possible';end if;
 update public.mosaic_candidate_tasks set is_deleted=true where id='task-A' and change_seq=3;
 get diagnostics n=row_count;if n<>1 then raise exception 'tombstone failed';end if;
 select change_seq into s2 from public.mosaic_candidate_tasks where id='task-A';
 if s2<>5 then raise exception 'tombstone cursor failed %',s2;end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 select count(*) into n from public.mosaic_candidate_tasks;
 if n<>1 then raise exception 'Bob task isolation failed';end if;
end
$test$;
rollback;
