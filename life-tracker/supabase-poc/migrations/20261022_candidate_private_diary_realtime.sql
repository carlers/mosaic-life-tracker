-- #1029: add owner-private Diary to disposable/isolated Supabase Realtime.
-- Postgres Changes only wakes an already signed owner-filtered incremental pull.
-- Browser must subscribe ONLY to INSERT/UPDATE; DELETE is not RLS-filtered.
-- Run after 20261022_candidate_private_diary_domain.sql.
DO $diary_realtime$
DECLARE
  target regclass := to_regclass('public.mosaic_candidate_diary');
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'Private Diary table is not installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Isolated Supabase realtime publication missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=target AND relrowsecurity) THEN
    RAISE EXCEPTION 'Diary Realtime requires RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='mosaic_candidate_diary'
      AND cmd='SELECT' AND 'authenticated'=ANY(roles)
      AND qual LIKE '%owner_id%' AND qual LIKE '%uid()%'
  ) THEN
    RAISE EXCEPTION 'Diary Realtime owner SELECT policy missing';
  END IF;
  IF has_table_privilege('anon',target,'SELECT') OR
     has_table_privilege('authenticated',target,'UPDATE') OR
     has_table_privilege('authenticated',target,'DELETE') OR
     NOT has_table_privilege('authenticated',target,'SELECT') THEN
    RAISE EXCEPTION 'Diary Realtime unsafe table grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename='mosaic_candidate_diary'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mosaic_candidate_diary;
  END IF;
END
$diary_realtime$;
