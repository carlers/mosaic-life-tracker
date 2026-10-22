-- #1029 disposable owner-private Diary Realtime catalog contract.
DO $contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename='mosaic_candidate_diary'
  ) THEN RAISE EXCEPTION 'Private Diary missing from realtime publication'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables t
    WHERE t.pubname='supabase_realtime'
      AND t.schemaname='public' AND t.tablename='mosaic_candidate_diary'
      AND (SELECT NOT c.relrowsecurity FROM pg_class c
           WHERE c.oid='public.mosaic_candidate_diary'::regclass)
  ) THEN RAISE EXCEPTION 'Private Diary publication RLS disabled'; END IF;
  IF has_table_privilege('anon','public.mosaic_candidate_diary','SELECT') OR
     has_table_privilege('authenticated','public.mosaic_candidate_diary','UPDATE') OR
     has_table_privilege('authenticated','public.mosaic_candidate_diary','DELETE') THEN
    RAISE EXCEPTION 'Private Diary realtime exposed unsafe privileges';
  END IF;
END
$contract$;
