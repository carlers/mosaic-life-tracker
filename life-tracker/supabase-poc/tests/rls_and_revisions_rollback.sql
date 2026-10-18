-- Run ONLY against the isolated mosaic-dev project after the three migrations.
-- Simulates JWT subjects with SET LOCAL ROLE; NOT real HTTP/Auth-token proof.
-- All seed rows and private owner revisions are rolled back.
begin;
insert into public.mosaic_poc_items(id,owner_id,title)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Alice synthetic'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Bob synthetic');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $probe$
declare
  n integer;
  prior timestamptz;
  later timestamptz;
  initial_seq bigint;
  revised_seq bigint;
  denied boolean;
begin
  select count(*) into n from public.mosaic_poc_items;
  if n<>1 then raise exception 'Alice owner isolation failed: % rows visible',n; end if;
  select change_seq,updated_at into initial_seq,prior
    from public.mosaic_poc_items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if initial_seq<>1 then raise exception 'First owner revision was %',initial_seq; end if;
  update public.mosaic_poc_items
    set title='Alice revised',updated_at='2000-01-01',change_seq=0
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select change_seq,updated_at into revised_seq,later
    from public.mosaic_poc_items where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if revised_seq<>2 or later<=prior then
    raise exception 'Server-owned sequence/timestamp failed';
  end if;
  update public.mosaic_poc_items set title='Hijacked Bob'
    where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Cross-owner update wrote % rows',n; end if;
  denied:=false;
  begin
    insert into public.mosaic_poc_items(owner_id,title)
      values('22222222-2222-4222-8222-222222222222','Forged Bob row');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-owner INSERT was allowed'; end if;
  denied:=false;
  begin
    delete from public.mosaic_poc_items
      where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Physical DELETE was allowed'; end if;
  update public.mosaic_poc_items set is_deleted=true
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select change_seq into revised_seq from public.mosaic_poc_items
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if revised_seq<>3 then raise exception 'Tombstone sequence incorrect: %',revised_seq; end if;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  select count(*) into n from public.mosaic_poc_items;
  if n<>1 then raise exception 'Bob owner isolation failed: % rows visible',n; end if;
  select change_seq into revised_seq from public.mosaic_poc_items
    where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if revised_seq<>1 then raise exception 'Independent Bob sequence incorrect: %',revised_seq; end if;
end
$probe$;
rollback;
