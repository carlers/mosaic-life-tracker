-- #967 isolated candidate only: follow-on hardening for disposable Supabase CLI.
-- Apply AFTER 20261019_candidate_atomic_cas_rpc.sql on a freshly created local
-- candidate, not to the already-initialized hosted mosaic-dev or Production.
-- Existing legacy created_at is supplied at INSERT to preserve preexisting dates.
-- It becomes immutable on UPDATE. Task reactions are server-owned: reject
-- authenticated owner INSERT with nonempty reactions and owner CAS mutations.
-- A future trusted reactions handler / controlled legacy import needs separate
-- access control, acceptance and authorisation. Do NOT install one here.

-- A table-specific check in the existing private trigger defends creation
-- timestamps from future DML grants and privileged operations, not just CAS.
CREATE OR REPLACE FUNCTION mosaic_candidate_private.stamp_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.id IS DISTINCT FROM OLD.id THEN
     RAISE EXCEPTION 'immutable row identity and ownership' USING errcode='42501';
   END IF;
   IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='mosaic_candidate_tasks' THEN
     IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'immutable task creation timestamp' USING errcode='42501';
     END IF;
   END IF;
 END IF;
 NEW.change_seq := mosaic_candidate_private.next_revision(NEW.owner_id);
 NEW.server_updated_at := clock_timestamp();
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION mosaic_candidate_private.stamp_row() FROM PUBLIC,anon,authenticated;

-- Existing policy was owner-only. Make initial client reactions empty without
-- changing owner-only SELECT, CAS update ownership or account erasure behavior.
DROP POLICY candidate_tasks_add ON public.mosaic_candidate_tasks;
CREATE POLICY candidate_tasks_add ON public.mosaic_candidate_tasks
FOR INSERT TO authenticated WITH CHECK (
  owner_id=(select auth.uid()) AND COALESCE(reactions,'')=''
);

-- Keep the privileged RPC's existing owner fence, exact revision fence, type
-- checks, fixed search path and narrow role EXECUTE grant. This replaces ONLY
-- the task CAS implementation; categories retain their previous CAS function.
CREATE OR REPLACE FUNCTION public.mosaic_candidate_cas_task(p_id text, p_expected_seq bigint, p_patch jsonb)
 RETURNS public.mosaic_candidate_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  principal uuid := auth.uid();
  result public.mosaic_candidate_tasks;
BEGIN
  IF principal IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING errcode='42501'; END IF;
  IF p_id IS NULL OR p_expected_seq IS NULL OR p_expected_seq<1
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch = '{}'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) AS key
      WHERE key NOT IN ('title','completed','category_id','order_index','tags','task_date',
        'memo','image','completed_at','updated_at','source','routine_id',
        'reminder_time','visibility','is_deleted'))
  THEN RAISE EXCEPTION 'Invalid task CAS request' USING errcode='22023'; END IF;

  UPDATE public.mosaic_candidate_tasks AS t
     SET title=CASE WHEN p_patch?'title' THEN p_patch->>'title' ELSE t.title END,
         completed=CASE WHEN p_patch?'completed' THEN (p_patch->>'completed')::boolean ELSE t.completed END,
         category_id=CASE WHEN p_patch?'category_id' THEN p_patch->>'category_id' ELSE t.category_id END,
         order_index=CASE WHEN p_patch?'order_index' THEN (p_patch->>'order_index')::integer ELSE t.order_index END,
         tags=CASE WHEN p_patch?'tags' THEN p_patch->>'tags' ELSE t.tags END,
         task_date=CASE WHEN p_patch?'task_date' THEN p_patch->>'task_date' ELSE t.task_date END,
         memo=CASE WHEN p_patch?'memo' THEN p_patch->>'memo' ELSE t.memo END,
         image=CASE WHEN p_patch?'image' THEN p_patch->>'image' ELSE t.image END,
         completed_at=CASE WHEN p_patch?'completed_at' THEN p_patch->>'completed_at' ELSE t.completed_at END,
         updated_at=CASE WHEN p_patch?'updated_at' THEN p_patch->>'updated_at' ELSE t.updated_at END,
         source=CASE WHEN p_patch?'source' THEN p_patch->>'source' ELSE t.source END,
         routine_id=CASE WHEN p_patch?'routine_id' THEN p_patch->>'routine_id' ELSE t.routine_id END,
         reminder_time=CASE WHEN p_patch?'reminder_time' THEN p_patch->>'reminder_time' ELSE t.reminder_time END,
         visibility=CASE WHEN p_patch?'visibility' THEN p_patch->>'visibility' ELSE t.visibility END,
         is_deleted=CASE WHEN p_patch?'is_deleted' THEN (p_patch->>'is_deleted')::boolean ELSE t.is_deleted END
   WHERE t.owner_id=principal AND t.id=p_id AND t.change_seq=p_expected_seq
  RETURNING t.* INTO result;
  RETURN result;
END
$function$;
REVOKE ALL ON FUNCTION public.mosaic_candidate_cas_task(text,bigint,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mosaic_candidate_cas_task(text,bigint,jsonb)
 TO authenticated;
