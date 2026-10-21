-- #857: isolated Supabase category retirement; purely additive metadata.
-- Existing categories stay active. Never reinterpret ordinary retirement as a
-- deletion tombstone and never move historical tasks in this migration.
ALTER TABLE public.mosaic_candidate_categories
  ADD COLUMN retired_on text NOT NULL DEFAULT ''
  CONSTRAINT mosaic_candidate_retired_on_format
  CHECK (retired_on = '' OR retired_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Same exact-revision, owner-only SECURITY DEFINER CAS as original source,
-- extended by one strict text-only field. All table grants/RLS remain intact.
CREATE OR REPLACE FUNCTION public.mosaic_candidate_cas_category(
  p_id text, p_expected_seq bigint, p_patch jsonb
)
RETURNS public.mosaic_candidate_categories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $category$
DECLARE
  principal uuid := auth.uid();
  result public.mosaic_candidate_categories;
BEGIN
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING errcode='42501';
  END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq < 1
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch = '{}'::jsonb
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_patch) AS key
      WHERE key NOT IN (
        'name','color','order_index','visibility','icon','updated_at',
        'retired_on','is_deleted'
      )
    )
    OR (p_patch ? 'retired_on' AND
        (jsonb_typeof(p_patch->'retired_on') IS DISTINCT FROM 'string'
         OR char_length(p_patch->>'retired_on') > 10))
  THEN RAISE EXCEPTION 'Invalid category CAS request' USING errcode='22023';
  END IF;

  UPDATE public.mosaic_candidate_categories AS c
     SET name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE c.name END,
         color = CASE WHEN p_patch ? 'color' THEN p_patch->>'color' ELSE c.color END,
         order_index = CASE WHEN p_patch ? 'order_index'
           THEN (p_patch->>'order_index')::integer ELSE c.order_index END,
         visibility = CASE WHEN p_patch ? 'visibility'
           THEN p_patch->>'visibility' ELSE c.visibility END,
         icon = CASE WHEN p_patch ? 'icon' THEN p_patch->>'icon' ELSE c.icon END,
         retired_on = CASE WHEN p_patch ? 'retired_on'
           THEN p_patch->>'retired_on' ELSE c.retired_on END,
         updated_at = CASE WHEN p_patch ? 'updated_at'
           THEN p_patch->>'updated_at' ELSE c.updated_at END,
         is_deleted = CASE WHEN p_patch ? 'is_deleted'
           THEN (p_patch->>'is_deleted')::boolean ELSE c.is_deleted END
   WHERE c.owner_id = principal AND c.id = p_id
     AND c.change_seq = p_expected_seq
  RETURNING c.* INTO result;
  RETURN result;
END;
$category$;

REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_category(text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_category(text,bigint,jsonb)
  TO authenticated;
