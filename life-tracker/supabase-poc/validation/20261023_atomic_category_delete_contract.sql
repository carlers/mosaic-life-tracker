-- #857 disposable catalog gate. Real signed DML/race acceptance runs through
-- tests/e2e/supabase-core-app.spec.mjs using independent GoTrue sessions.
DO $validate$
BEGIN
  IF (
    SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.mosaic_candidate_categories'::regclass
      AND tgname IN ('mosaic_candidate_category_no_resurrection',
                     'mosaic_candidate_category_task_tombstone')
      AND NOT tgisinternal AND tgenabled = 'O'
  ) <> 2 OR (
    SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.mosaic_candidate_tasks'::regclass
      AND tgname = 'mosaic_candidate_task_live_category_guard'
      AND NOT tgisinternal AND tgenabled = 'O'
  ) <> 1 THEN
    RAISE EXCEPTION 'Atomic category delete/assignment guard triggers missing';
  END IF;
  IF has_table_privilege('authenticated','public.mosaic_candidate_categories','UPDATE') OR
     has_table_privilege('authenticated','public.mosaic_candidate_tasks','UPDATE') OR
     has_table_privilege('anon','public.mosaic_candidate_tasks','SELECT') THEN
    RAISE EXCEPTION 'Category delete must remain signed CAS-only';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mosaic_candidate_categories'
      AND column_name = 'retired_on'
  ) THEN
    RAISE EXCEPTION 'History-preserving retirement metadata missing';
  END IF;
END
$validate$;
