-- #1027 disposable PostgreSQL ONLY: review catalog before signed GoTrue suite.
DO $verify$
DECLARE
  t regclass;
  kind text;
  policies integer;
BEGIN
  FOREACH kind IN ARRAY ARRAY['mosaic_candidate_buckets',
                               'mosaic_candidate_bucket_task_links'] LOOP
    t := to_regclass('public.' || kind);
    IF t IS NULL THEN RAISE EXCEPTION 'Missing private table %', kind; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t)
      THEN RAISE EXCEPTION 'Required RLS disabled: %', kind; END IF;
    IF has_table_privilege('anon',t,'SELECT')
      OR has_table_privilege('anon',t,'INSERT')
      OR has_table_privilege('authenticated',t,'UPDATE')
      OR has_table_privilege('authenticated',t,'DELETE')
      OR NOT has_table_privilege('authenticated',t,'SELECT')
      OR NOT has_table_privilege('authenticated',t,'INSERT')
      THEN RAISE EXCEPTION 'Unsafe table grants: %', kind; END IF;
    SELECT count(*) INTO policies
      FROM pg_policies
      WHERE schemaname='public' AND tablename=kind
        AND cmd IN ('SELECT','INSERT')
        AND 'authenticated'=ANY(roles)
        AND (position('owner_id' IN COALESCE(qual,with_check,''))>0)
        AND (position('uid()' IN COALESCE(qual,with_check,''))>0);
    IF policies<>2 OR (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename=kind)<>2
      THEN RAISE EXCEPTION 'Unexpected owner policies: %',kind; END IF;
    IF (SELECT count(*) FROM pg_trigger WHERE tgrelid=t AND NOT tgisinternal
          AND tgfoid IN (
            'mosaic_candidate_private.stamp_row()'::regprocedure,
            'mosaic_candidate_private.require_core_authority()'::regprocedure
          ))<>2
      THEN RAISE EXCEPTION 'Revision or authority trigger missing: %',kind; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.mosaic_candidate_bucket_task_links'::regclass
        AND contype='f'
        AND confrelid IN ('public.mosaic_candidate_buckets'::regclass,
                         'public.mosaic_candidate_tasks'::regclass))<>2
    THEN RAISE EXCEPTION 'Owner-linked bucket/task composite FKs missing'; END IF;
  IF has_function_privilege('anon','public.mosaic_candidate_cas_bucket(text,bigint,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.mosaic_candidate_cas_bucket_link(text,bigint,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.mosaic_candidate_cas_bucket(text,bigint,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.mosaic_candidate_cas_bucket_link(text,bigint,jsonb)','EXECUTE')
    THEN RAISE EXCEPTION 'Unsafe owner CAS RPC grants'; END IF;
END
$verify$;
