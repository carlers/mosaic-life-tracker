-- Assert anonymous REST-role access to the disposable POC table is denied.
begin;
set local role anon;
do $probe$
declare rejected boolean := false; n integer;
begin
  begin
    select count(*) into n from public.mosaic_poc_items;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous SELECT unexpectedly allowed'; end if;
end
$probe$;
rollback;
