-- Run ONLY against the disposable CI Supabase database after exact source migrations.
-- The actual signed GoTrue Storage API test also runs; catalog checks are not
-- a substitute for authenticated two-owner upload/download denial.
DO $check$
DECLARE
  actual_policies integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'mosaic-personal-photos'
      AND public IS FALSE
      AND file_size_limit = 5242880
      AND allowed_mime_types = ARRAY['image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'Personal photo bucket is not privately configured';
  END IF;

  SELECT count(*) INTO actual_policies
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN (
      'mosaic_private_photo_read',
      'mosaic_private_photo_insert',
      'mosaic_private_photo_delete'
    ) AND roles = ARRAY['authenticated']::name[];
  IF actual_policies <> 3 THEN
    RAISE EXCEPTION 'Missing or excessively broad personal photo policies';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'mosaic_private_photo_%'
      AND cmd NOT IN ('SELECT', 'INSERT', 'DELETE')
  ) THEN RAISE EXCEPTION 'Private photo update/upsert is forbidden'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'Storage objects RLS must remain enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'mosaic_candidate_cas_diary'
      AND pg_get_functiondef(p.oid) LIKE '%photos%'
  ) THEN RAISE EXCEPTION 'Diary CAS photo field is not wired'; END IF;
END
$check$;
