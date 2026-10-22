-- #857: transactionally keep deleted categories and their tasks consistent.
-- Run only AFTER the date-effective retirement migration. Soft tombstones,
-- never physical deletion; existing historical/orphan data is left untouched.
--
-- A signed client may CAS is_deleted=true on the category. The AFTER trigger
-- tombstones all remaining live owner tasks in the SAME SQL transaction,
-- covering tasks another device created just before that category commit.
-- New assignments lock the category row FOR SHARE, serializing against its
-- deletion (UPDATE obtains a conflicting row lock). A failed task cascade
-- rolls back the category CAS; no partial committed deletion is possible.

CREATE FUNCTION mosaic_candidate_private.guard_category_retirement_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard_category$
BEGIN
  IF OLD.is_deleted AND NOT NEW.is_deleted THEN
    RAISE EXCEPTION 'A destructively deleted category cannot be resurrected'
      USING errcode='23514';
  END IF;
  RETURN NEW;
END
$guard_category$;
REVOKE ALL ON FUNCTION mosaic_candidate_private.guard_category_retirement_write()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mosaic_candidate_category_no_resurrection
  BEFORE UPDATE ON public.mosaic_candidate_categories
  FOR EACH ROW EXECUTE FUNCTION
  mosaic_candidate_private.guard_category_retirement_write();

CREATE FUNCTION mosaic_candidate_private.guard_live_category_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard_assignment$
BEGIN
  IF NEW.is_deleted OR NEW.category_id = '' THEN
    RETURN NEW;
  END IF;
  -- Keep historical/orphan rows editable when their association did not
  -- change, but never permit a new assignment or resurrection into a
  -- category another device already destructively deleted.
  IF TG_OP = 'UPDATE' AND
     NEW.category_id IS NOT DISTINCT FROM OLD.category_id AND
     NOT OLD.is_deleted THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.mosaic_candidate_categories c
    WHERE c.owner_id = NEW.owner_id AND c.id = NEW.category_id
      AND NOT c.is_deleted
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target category missing or deleted'
      USING errcode='23503';
  END IF;
  RETURN NEW;
END
$guard_assignment$;
REVOKE ALL ON FUNCTION mosaic_candidate_private.guard_live_category_assignment()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mosaic_candidate_task_live_category_guard
  BEFORE INSERT OR UPDATE OF category_id, is_deleted
  ON public.mosaic_candidate_tasks
  FOR EACH ROW EXECUTE FUNCTION
  mosaic_candidate_private.guard_live_category_assignment();

CREATE FUNCTION mosaic_candidate_private.cascade_category_tombstone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $cascade$
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    -- Authoritative commit-owned cascade, not a client enumeration.
    -- The revision stamp and owner lease triggers run for every task.
    UPDATE public.mosaic_candidate_tasks t
       SET is_deleted = true,
           updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     WHERE t.owner_id = NEW.owner_id AND t.category_id = NEW.id
       AND NOT t.is_deleted;
  END IF;
  RETURN NULL;
END
$cascade$;
REVOKE ALL ON FUNCTION mosaic_candidate_private.cascade_category_tombstone()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER mosaic_candidate_category_task_tombstone
  AFTER UPDATE OF is_deleted ON public.mosaic_candidate_categories
  FOR EACH ROW WHEN (OLD.is_deleted = false AND NEW.is_deleted = true)
  EXECUTE FUNCTION mosaic_candidate_private.cascade_category_tombstone();
