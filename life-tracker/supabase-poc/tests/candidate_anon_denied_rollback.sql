-- Confirm disposable candidate rows cannot be read by anonymous SDK role.
begin;
set local role anon;
do $test$
declare denied boolean:=false; n integer;
begin
 begin select count(*) into n from public.mosaic_candidate_tasks;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous candidate task SELECT permitted';end if;
 denied:=false;
 begin select count(*) into n from public.mosaic_candidate_categories;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous candidate category SELECT permitted';end if;
end
$test$;
rollback;
