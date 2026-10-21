-- Disposable local Supabase only. Assertion contract for #1029 schema.
DO $verify$
DECLARE
  rt regclass := 'public.mosaic_candidate_diary'::regclass;
  read_qual text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid=rt AND relrowsecurity
  ) THEN RAISE EXCEPTION 'Diary table RLS is required'; END IF;
  IF has_table_privilege('anon',rt,'SELECT') OR
     has_table_privilege('anon',rt,'INSERT') OR
     has_table_privilege('authenticated',rt,'UPDATE') OR
     has_table_privilege('authenticated',rt,'DELETE') OR
     NOT has_table_privilege('authenticated',rt,'SELECT') OR
     NOT has_table_privilege('authenticated',rt,'INSERT') THEN
     RAISE EXCEPTION 'Diary grants violate owner-private contract';
  END IF;
  SELECT qual INTO read_qual FROM pg_policies
    WHERE schemaname='public' AND tablename='mosaic_candidate_diary'
      AND cmd='SELECT' AND 'authenticated'=ANY(roles);
  IF read_qual IS NULL OR position('owner_id' IN read_qual)=0 OR
     position('uid()' IN read_qual)=0 THEN
    RAISE EXCEPTION 'Diary owner SELECT policy missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='mosaic_candidate_diary') <> 2 THEN
    RAISE EXCEPTION 'Unexpected Diary RLS policy widening';
  END IF;
  IF has_function_privilege('anon','public.mosaic_candidate_cas_diary(text,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege('authenticated','public.mosaic_candidate_cas_diary(text,bigint,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Diary CAS RPC grants must be owner-only';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid=rt AND NOT tgisinternal
    AND tgname IN ('mosaic_candidate_diary_stamp','mosaic_core_diary_authority'))<>2
  THEN RAISE EXCEPTION 'Diary revision/authority triggers missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=rt AND contype='u'
    AND pg_get_constraintdef(oid) LIKE '%owner_id, entry_date%') THEN
    RAISE EXCEPTION 'One Diary entry per day/owner must be enforced';
  END IF;
END
$verify$;
