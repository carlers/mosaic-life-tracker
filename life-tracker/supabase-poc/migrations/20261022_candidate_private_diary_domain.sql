-- #1029: additive, isolated owner-private Diary domain for Supabase core+Diary.
-- No Appwrite/main/Production changes, no enabled client writer or public Diary reads.
-- Execute after fresh core authority + protected CAS migrations.
CREATE TABLE public.mosaic_candidate_diary (
  owner_id uuid NOT NULL,
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  entry_date text NOT NULL CHECK (entry_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 100000),
  emoji text NOT NULL DEFAULT '' CHECK (char_length(emoji) <= 32),
  -- Preserve legacy attachment references for backup/return, but do not
  -- enable Supabase image uploads or editing until Storage parity exists.
  photos text NOT NULL DEFAULT '[]' CHECK (char_length(photos) <= 8192),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  created_at text NOT NULL CHECK (char_length(created_at) BETWEEN 1 AND 50),
  updated_at text NOT NULL CHECK (char_length(updated_at) BETWEEN 1 AND 50),
  is_deleted boolean NOT NULL DEFAULT false,
  change_seq bigint NOT NULL DEFAULT 0,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, entry_date)
);

CREATE INDEX mosaic_candidate_diary_cursor_idx
  ON public.mosaic_candidate_diary (owner_id, change_seq);
CREATE INDEX mosaic_candidate_diary_dates_idx
  ON public.mosaic_candidate_diary (owner_id, entry_date)
  WHERE is_deleted = false;

-- Never grant DELETE/UPDATE directly; all edits require an exact-revision CAS.
REVOKE ALL ON TABLE public.mosaic_candidate_diary FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.mosaic_candidate_diary TO authenticated;
ALTER TABLE public.mosaic_candidate_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY mosaic_diary_owner_read ON public.mosaic_candidate_diary
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY mosaic_diary_owner_insert ON public.mosaic_candidate_diary
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));

-- Shared commit-ordered owner revision stream, including tombstones.
CREATE TRIGGER mosaic_candidate_diary_stamp
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_diary
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.stamp_row();
CREATE TRIGGER mosaic_core_diary_authority
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_diary
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.require_core_authority();

-- A follow-up will prove the full signed client CAS transport before any UI
-- routes or Diary capability are activated. Returned NULL is a conflict.
CREATE FUNCTION public.mosaic_candidate_cas_diary(
  p_id text, p_expected_seq bigint, p_patch jsonb
)
RETURNS public.mosaic_candidate_diary
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $diary$
DECLARE
  principal uuid := auth.uid();
  changed public.mosaic_candidate_diary;
BEGIN
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode='42501';
  END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq < 1
     OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
     OR p_patch = '{}'::jsonb
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_patch) AS key
       WHERE key NOT IN ('content', 'emoji', 'updated_at', 'is_deleted')
     )
     OR (p_patch ? 'content' AND jsonb_typeof(p_patch->'content') IS DISTINCT FROM 'string')
     OR (p_patch ? 'emoji' AND jsonb_typeof(p_patch->'emoji') IS DISTINCT FROM 'string')
     OR (p_patch ? 'updated_at' AND jsonb_typeof(p_patch->'updated_at') IS DISTINCT FROM 'string')
     OR (p_patch ? 'is_deleted' AND jsonb_typeof(p_patch->'is_deleted') IS DISTINCT FROM 'boolean')
  THEN RAISE EXCEPTION 'Invalid Diary CAS patch' USING errcode='22023';
  END IF;

  UPDATE public.mosaic_candidate_diary AS d
     SET content = CASE WHEN p_patch ? 'content' THEN p_patch->>'content' ELSE d.content END,
         emoji = CASE WHEN p_patch ? 'emoji' THEN p_patch->>'emoji' ELSE d.emoji END,
         updated_at = CASE WHEN p_patch ? 'updated_at' THEN p_patch->>'updated_at' ELSE d.updated_at END,
         is_deleted = CASE WHEN p_patch ? 'is_deleted' THEN (p_patch->>'is_deleted')::boolean ELSE d.is_deleted END
   WHERE d.owner_id = principal AND d.id = p_id AND d.change_seq = p_expected_seq
   RETURNING d.* INTO changed;
  RETURN changed;
END;
$diary$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_diary(text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_diary(text,bigint,jsonb)
  TO authenticated;

COMMENT ON TABLE public.mosaic_candidate_diary IS
  'ISOLATED SUPABASE CANDIDATE: owner-private Diary, no social reader or photo uploads. Release pending signed end-to-end tests.';
