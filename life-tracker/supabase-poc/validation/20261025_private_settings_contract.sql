-- Only disposable CI PostgreSQL; signed GoTrue HTTP test is independent.
DO $settings_verify$
DECLARE
  rt regclass := 'public.mosaic_candidate_settings'::regclass;
  read_qual text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=rt)
  THEN RAISE EXCEPTION 'Settings RLS is mandatory'; END IF;
  IF has_table_privilege('anon',rt,'SELECT')
      OR has_table_privilege('anon',rt,'INSERT')
      OR has_table_privilege('authenticated',rt,'UPDATE')
      OR has_table_privilege('authenticated',rt,'DELETE')
      OR NOT has_table_privilege('authenticated',rt,'SELECT')
      OR NOT has_table_privilege('authenticated',rt,'INSERT')
  THEN RAISE EXCEPTION 'Settings grants are unsafe'; END IF;
  SELECT p.qual INTO read_qual FROM pg_policies AS p
    WHERE p.schemaname='public' AND p.tablename='mosaic_candidate_settings'
      AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles);
  IF read_qual IS NULL OR position('owner_id' IN read_qual)=0
       OR position('uid()' IN read_qual)=0
  THEN RAISE EXCEPTION 'Private Settings owner SELECT missing'; END IF;
  IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='mosaic_candidate_settings')<>2
  THEN RAISE EXCEPTION 'Unexpected broad Settings RLS policies'; END IF;
  IF has_function_privilege('anon','public.mosaic_candidate_cas_setting(text,bigint,jsonb)','EXECUTE')
      OR NOT has_function_privilege('authenticated','public.mosaic_candidate_cas_setting(text,bigint,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Settings CAS grants unsafe'; END IF;
  IF (SELECT count(DISTINCT tgfoid) FROM pg_trigger WHERE tgrelid=rt AND NOT tgisinternal
      AND tgenabled IN ('O','A') AND (tgtype & 23)=23
      AND tgfoid IN ('mosaic_candidate_private.stamp_row()'::regprocedure,
                    'mosaic_candidate_private.require_core_authority()'::regprocedure))<>2
  THEN RAISE EXCEPTION 'Settings authority/revision triggers missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid=rt AND contype='u'
      AND pg_get_constraintdef(oid) LIKE '%owner_id, setting_key%'
  ) THEN RAISE EXCEPTION 'Owner-key uniqueness absent'; END IF;
END
$settings_verify$;
