-- #1027 Supabase isolated core+Diary photos; NEVER public or social media.
-- This is the reviewed source migration, NOT authorization for Production.
-- Use the exact signed hosted mosaic-dev rollout gate and independently prove RLS.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mosaic-personal-photos', 'mosaic-personal-photos', false, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $photo_bucket$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'mosaic-personal-photos' AND public = false
      AND file_size_limit = 5242880
      AND allowed_mime_types = ARRAY['image/webp']::text[]
  ) THEN RAISE EXCEPTION 'Private photo bucket configuration drift'; END IF;
END
$photo_bucket$;

-- Exact path: <signed Supabase Auth UUID>/<opaque Mosaic file ID>.webp.
-- Metadata is Storage-owned. Never permit a caller to choose another owner,
-- upload arbitrary MIME types, overwrite an existing blob, or bypass RLS.
CREATE POLICY mosaic_private_photo_read ON storage.objects
 FOR SELECT TO authenticated
 USING (
   bucket_id = 'mosaic-personal-photos'
   AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
   AND array_length(storage.foldername(name), 1) = 1
   AND storage.filename(name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,35}[.]webp$'
 );
CREATE POLICY mosaic_private_photo_insert ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (
   bucket_id = 'mosaic-personal-photos'
   AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
   AND array_length(storage.foldername(name), 1) = 1
   AND storage.filename(name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,35}[.]webp$'
 );
CREATE POLICY mosaic_private_photo_delete ON storage.objects
 FOR DELETE TO authenticated
 USING (
   bucket_id = 'mosaic-personal-photos'
   AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
   AND array_length(storage.foldername(name), 1) = 1
   AND storage.filename(name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,35}[.]webp$'
 );
-- Intentionally no UPDATE/upsert policy. Objects are immutable per file ID.
-- Files added by users require independent encrypted backup/restore coverage.

-- Diary's historical photo JSON field is already present, but its original
-- CAS forbade updating attachments. Keep date/visibility/owner/creation fenced.
CREATE OR REPLACE FUNCTION public.mosaic_candidate_cas_diary(
  p_id text, p_expected_seq bigint, p_patch jsonb
) RETURNS public.mosaic_candidate_diary
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
       WHERE key NOT IN ('content', 'emoji', 'photos', 'updated_at', 'is_deleted')
     )
     OR (p_patch ? 'content' AND jsonb_typeof(p_patch->'content') IS DISTINCT FROM 'string')
     OR (p_patch ? 'emoji' AND jsonb_typeof(p_patch->'emoji') IS DISTINCT FROM 'string')
     OR (p_patch ? 'photos' AND (jsonb_typeof(p_patch->'photos') IS DISTINCT FROM 'string'
         OR char_length(p_patch->>'photos') > 8192))
     OR (p_patch ? 'updated_at' AND jsonb_typeof(p_patch->'updated_at') IS DISTINCT FROM 'string')
     OR (p_patch ? 'is_deleted' AND jsonb_typeof(p_patch->'is_deleted') IS DISTINCT FROM 'boolean')
  THEN RAISE EXCEPTION 'Invalid Diary CAS patch' USING errcode='22023';
  END IF;
  UPDATE public.mosaic_candidate_diary AS d
     SET content = CASE WHEN p_patch ? 'content' THEN p_patch->>'content' ELSE d.content END,
         emoji = CASE WHEN p_patch ? 'emoji' THEN p_patch->>'emoji' ELSE d.emoji END,
         photos = CASE WHEN p_patch ? 'photos' THEN p_patch->>'photos' ELSE d.photos END,
         updated_at = CASE WHEN p_patch ? 'updated_at' THEN p_patch->>'updated_at' ELSE d.updated_at END,
         is_deleted = CASE WHEN p_patch ? 'is_deleted' THEN (p_patch->>'is_deleted')::boolean ELSE d.is_deleted END
   WHERE d.owner_id = principal AND d.id = p_id AND d.change_seq = p_expected_seq
   RETURNING d.* INTO changed;
  RETURN changed;
END;
$diary$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_diary(text,bigint,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_diary(text,bigint,jsonb)
  TO authenticated;
