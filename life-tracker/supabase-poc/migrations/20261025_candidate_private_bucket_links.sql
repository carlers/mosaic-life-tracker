-- #1027 SOURCE ONLY. Never install on hosted Scratch/Production before
-- ten-table encrypted independent DR and signed two-owner authorization gates.
-- Requires existing candidate private stamp_row(), core authority, tasks table.
-- Historical unresolved/foreign/long task references remain in a quarantine
-- ledger, NOT silently inserted or rewritten into this ready-links table.

CREATE TABLE public.mosaic_candidate_buckets (
  owner_id uuid NOT NULL,
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  title text NOT NULL CHECK (char_length(title) <= 255),
  description text NOT NULL CHECK (char_length(description) <= 2000),
  achieved boolean NOT NULL DEFAULT false,
  achieved_at text NOT NULL DEFAULT '' CHECK (char_length(achieved_at) <= 50),
  created_at text NOT NULL CHECK (char_length(created_at) BETWEEN 1 AND 50),
  updated_at text NOT NULL CHECK (char_length(updated_at) BETWEEN 1 AND 50),
  is_deleted boolean NOT NULL DEFAULT false,
  change_seq bigint NOT NULL DEFAULT 0,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);
CREATE INDEX mosaic_candidate_buckets_cursor_idx
  ON public.mosaic_candidate_buckets(owner_id, change_seq);

REVOKE ALL ON TABLE public.mosaic_candidate_buckets
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.mosaic_candidate_buckets TO authenticated;
ALTER TABLE public.mosaic_candidate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY mosaic_buckets_owner_read ON public.mosaic_candidate_buckets
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY mosaic_buckets_owner_insert ON public.mosaic_candidate_buckets
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE TRIGGER mosaic_candidate_buckets_stamp
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_buckets
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.stamp_row();
CREATE TRIGGER mosaic_core_buckets_authority
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_buckets
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.require_core_authority();

CREATE TABLE public.mosaic_candidate_bucket_task_links (
  owner_id uuid NOT NULL,
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  bucket_list_id text NOT NULL
    CHECK (bucket_list_id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  task_id text NOT NULL
    CHECK (task_id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  created_at text NOT NULL CHECK (char_length(created_at) BETWEEN 1 AND 50),
  updated_at text NOT NULL CHECK (char_length(updated_at) BETWEEN 1 AND 50),
  is_deleted boolean NOT NULL DEFAULT false,
  change_seq bigint NOT NULL DEFAULT 0,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  CONSTRAINT mosaic_bucket_links_owned_bucket
    FOREIGN KEY (owner_id, bucket_list_id)
    REFERENCES public.mosaic_candidate_buckets(owner_id, id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT mosaic_bucket_links_owned_task
    FOREIGN KEY (owner_id, task_id)
    REFERENCES public.mosaic_candidate_tasks(owner_id, id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX mosaic_bucket_task_links_cursor_idx
  ON public.mosaic_candidate_bucket_task_links(owner_id, change_seq);
CREATE INDEX mosaic_bucket_task_links_owned_bucket_idx
  ON public.mosaic_candidate_bucket_task_links(owner_id, bucket_list_id);

REVOKE ALL ON TABLE public.mosaic_candidate_bucket_task_links
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.mosaic_candidate_bucket_task_links
  TO authenticated;
ALTER TABLE public.mosaic_candidate_bucket_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY mosaic_bucket_links_owner_read
  ON public.mosaic_candidate_bucket_task_links
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY mosaic_bucket_links_owner_insert
  ON public.mosaic_candidate_bucket_task_links
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE TRIGGER mosaic_candidate_bucket_links_stamp
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_bucket_task_links
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.stamp_row();
CREATE TRIGGER mosaic_core_bucket_links_authority
  BEFORE INSERT OR UPDATE ON public.mosaic_candidate_bucket_task_links
  FOR EACH ROW EXECUTE FUNCTION mosaic_candidate_private.require_core_authority();

-- Definer RPCs are explicitly owner-fenced; authenticated has no direct UPDATE
-- or DELETE. Tombstones are logical and preserve legacy IDs / change stream.
CREATE FUNCTION public.mosaic_candidate_cas_bucket(
  p_id text, p_expected_seq bigint, p_patch jsonb
)
RETURNS public.mosaic_candidate_buckets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $bucket$
DECLARE
  principal uuid := auth.uid();
  changed public.mosaic_candidate_buckets;
BEGIN
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode='42501';
  END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq < 1
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch = '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) AS key
      WHERE key NOT IN ('title','description','achieved','achieved_at',
                        'updated_at','is_deleted'))
    OR (p_patch ? 'title' AND jsonb_typeof(p_patch->'title') IS DISTINCT FROM 'string')
    OR (p_patch ? 'description' AND jsonb_typeof(p_patch->'description') IS DISTINCT FROM 'string')
    OR (p_patch ? 'achieved' AND jsonb_typeof(p_patch->'achieved') IS DISTINCT FROM 'boolean')
    OR (p_patch ? 'achieved_at' AND jsonb_typeof(p_patch->'achieved_at') IS DISTINCT FROM 'string')
    OR (p_patch ? 'updated_at' AND jsonb_typeof(p_patch->'updated_at') IS DISTINCT FROM 'string')
    OR (p_patch ? 'is_deleted' AND jsonb_typeof(p_patch->'is_deleted') IS DISTINCT FROM 'boolean')
  THEN RAISE EXCEPTION 'Invalid Bucket CAS patch' USING errcode='22023'; END IF;

  UPDATE public.mosaic_candidate_buckets AS b
    SET title=CASE WHEN p_patch ? 'title' THEN p_patch->>'title' ELSE b.title END,
        description=CASE WHEN p_patch ? 'description'
                    THEN p_patch->>'description' ELSE b.description END,
        achieved=CASE WHEN p_patch ? 'achieved'
                    THEN (p_patch->>'achieved')::boolean ELSE b.achieved END,
        achieved_at=CASE WHEN p_patch ? 'achieved_at'
                    THEN p_patch->>'achieved_at' ELSE b.achieved_at END,
        updated_at=CASE WHEN p_patch ? 'updated_at'
                    THEN p_patch->>'updated_at' ELSE b.updated_at END,
        is_deleted=CASE WHEN p_patch ? 'is_deleted'
                    THEN (p_patch->>'is_deleted')::boolean ELSE b.is_deleted END
  WHERE b.owner_id=principal AND b.id=p_id AND b.change_seq=p_expected_seq
  RETURNING b.* INTO changed;
  RETURN changed;
END;
$bucket$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_bucket(text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_bucket(text,bigint,jsonb)
  TO authenticated;

-- Link references cannot be redirected by a CAS patch. A new legacy link
-- identity needs a separately reviewed CREATE, never an implicit rekey.
CREATE FUNCTION public.mosaic_candidate_cas_bucket_link(
  p_id text, p_expected_seq bigint, p_patch jsonb
)
RETURNS public.mosaic_candidate_bucket_task_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $bucket_link$
DECLARE
  principal uuid := auth.uid();
  changed public.mosaic_candidate_bucket_task_links;
BEGIN
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode='42501';
  END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq < 1
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch = '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) AS key
      WHERE key NOT IN ('updated_at','is_deleted'))
    OR (p_patch ? 'updated_at'
        AND jsonb_typeof(p_patch->'updated_at') IS DISTINCT FROM 'string')
    OR (p_patch ? 'is_deleted'
        AND jsonb_typeof(p_patch->'is_deleted') IS DISTINCT FROM 'boolean')
  THEN RAISE EXCEPTION 'Invalid Bucket link CAS patch' USING errcode='22023'; END IF;

  UPDATE public.mosaic_candidate_bucket_task_links AS l
    SET updated_at=CASE WHEN p_patch ? 'updated_at'
                   THEN p_patch->>'updated_at' ELSE l.updated_at END,
        is_deleted=CASE WHEN p_patch ? 'is_deleted'
                   THEN (p_patch->>'is_deleted')::boolean ELSE l.is_deleted END
  WHERE l.owner_id=principal AND l.id=p_id AND l.change_seq=p_expected_seq
  RETURNING l.* INTO changed;
  RETURN changed;
END;
$bucket_link$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_bucket_link(text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_bucket_link(text,bigint,jsonb)
  TO authenticated;
COMMENT ON TABLE public.mosaic_candidate_bucket_task_links IS
  'UNAPPLIED source contract: owner-private ready links only; unresolvable historical links require preserved quarantine outside this table.';
