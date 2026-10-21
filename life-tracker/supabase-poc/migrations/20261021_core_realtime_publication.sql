-- #1187: Only isolated core candidate tables, no Appwrite or general publication.
-- Postgres Changes is strictly a wake hint. The authenticated REST pull remains
-- the sole source of truth. Do not subscribe to DELETE: Supabase cannot use
-- RLS for DELETE event payloads; Mosaic uses UPDATE tombstones.
DO $realtime$
DECLARE
  tbl name;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Realtime publication missing in isolated Supabase project';
  END IF;
  FOREACH tbl IN ARRAY ARRAY['mosaic_candidate_tasks','mosaic_candidate_categories']::name[] LOOP
    IF NOT EXISTS(
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=tbl AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Core realtime candidate table % must enforce RLS',tbl;
    END IF;
    IF has_table_privilege('anon',format('public.%I',tbl),'SELECT') OR
       NOT has_table_privilege('authenticated',format('public.%I',tbl),'SELECT') OR
       has_table_privilege('authenticated',format('public.%I',tbl),'UPDATE') THEN
      RAISE EXCEPTION 'Core candidate table % has unsafe direct table privileges',tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl AND cmd='SELECT'
        AND 'authenticated'=ANY(roles)
        AND qual LIKE '%owner_id%'
        AND qual LIKE '%uid()%'
    ) THEN
      RAISE EXCEPTION 'Owner SELECT policy missing for core candidate table %',tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tbl);
    END IF;
  END LOOP;
END
$realtime$;
