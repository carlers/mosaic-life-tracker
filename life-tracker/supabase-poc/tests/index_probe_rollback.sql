-- A diagnostic for the indexed owner+commit-sequence pull. Run on mosaic-dev.
-- 6,000 rows are temporary; transactions intentionally ROLLBACK.
-- DB-only time excludes network, RxDB, Auth, policy overhead and long-term load.
begin;
insert into public.mosaic_poc_items(owner_id,title)
  select '11111111-1111-4111-8111-111111111111'::uuid, 'Alice benchmark '||n
  from generate_series(1,3000) n;
insert into public.mosaic_poc_items(owner_id,title)
  select '22222222-2222-4222-8222-222222222222'::uuid, 'Bob benchmark '||n
  from generate_series(1,3000) n;
analyze public.mosaic_poc_items;
explain (analyze,buffers,format json)
  select id,change_seq,title,is_deleted from public.mosaic_poc_items
  where owner_id='11111111-1111-4111-8111-111111111111'
    and change_seq>2500 order by change_seq limit 100;
rollback;
