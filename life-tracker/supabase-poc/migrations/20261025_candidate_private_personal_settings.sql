-- #1027 isolated, UNAPPLIED owner-private personal settings candidate.
-- Requires signed two-owner RLS/CAS and full DR allowlist before hosted install.
CREATE TABLE public.mosaic_candidate_settings (
  owner_id uuid NOT NULL,
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  setting_key text NOT NULL CHECK (
    setting_key ~ '^[A-Za-z][A-Za-z0-9_]{0,127}$'
    AND setting_key NOT IN ('profileImageId', 'friend_carousel_prefs',
                            '__proto__', 'constructor', 'prototype')
  ),
  setting_value text NOT NULL DEFAULT '' CHECK (char_length(setting_value) <= 65536),
  updated_at text NOT NULL CHECK (char_length(updated_at) BETWEEN 1 AND 50),
  is_deleted boolean NOT NULL DEFAULT false,
  change_seq bigint NOT NULL DEFAULT 0,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, setting_key)
);
CREATE INDEX mosaic_candidate_settings_cursor_idx
  ON public.mosaic_candidate_settings(owner_id, change_seq);

REVOKE ALL ON TABLE public.mosaic_candidate_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.mosaic_candidate_settings TO authenticated;
ALTER TABLE public.mosaic_candidate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mosaic_settings_owner_read ON public.mosaic_candidate_settings
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY mosaic_settings_owner_insert ON public.mosaic_candidate_settings
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));

-- No direct UPDATE/DELETE; only revision-checked owner CAS and soft tombstones.
CREATE TRIGGER mosaic_candidate_settings_stamp
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_settings
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.stamp_row();
CREATE TRIGGER mosaic_core_settings_authority
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_settings
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.require_core_authority();

CREATE FUNCTION public.mosaic_candidate_cas_setting(
  p_id text, p_expected_seq bigint, p_patch jsonb
)
RETURNS public.mosaic_candidate_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $settings$
DECLARE
  principal uuid := auth.uid();
  changed public.mosaic_candidate_settings;
BEGIN
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode='42501';
  END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq < 1
     OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
     OR p_patch = '{}'::jsonb
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_patch) AS key
       WHERE key NOT IN ('setting_value', 'updated_at', 'is_deleted')
     )
     OR (p_patch ? 'setting_value' AND jsonb_typeof(p_patch->'setting_value') IS DISTINCT FROM 'string')
     OR (p_patch ? 'updated_at' AND jsonb_typeof(p_patch->'updated_at') IS DISTINCT FROM 'string')
     OR (p_patch ? 'is_deleted' AND jsonb_typeof(p_patch->'is_deleted') IS DISTINCT FROM 'boolean')
  THEN RAISE EXCEPTION 'Invalid Settings CAS patch' USING errcode='22023';
  END IF;

  UPDATE public.mosaic_candidate_settings AS s
    SET setting_value = CASE WHEN p_patch ? 'setting_value'
                          THEN p_patch->>'setting_value' ELSE s.setting_value END,
        updated_at = CASE WHEN p_patch ? 'updated_at'
                          THEN p_patch->>'updated_at' ELSE s.updated_at END,
        is_deleted = CASE WHEN p_patch ? 'is_deleted'
                          THEN (p_patch->>'is_deleted')::boolean ELSE s.is_deleted END
    WHERE s.owner_id = principal AND s.id = p_id AND s.change_seq = p_expected_seq
    RETURNING s.* INTO changed;
  RETURN changed;
END;
$settings$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_setting(text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_setting(text,bigint,jsonb)
  TO authenticated;
COMMENT ON TABLE public.mosaic_candidate_settings IS
  'ISOLATED UNAPPLIED owner-private personal settings, tombstoned CAS only; RLS/DR test gates pending.';
