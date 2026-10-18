-- Already applied on isolated mosaic-dev as
-- deny_candidate_physical_deletion_default_grants.
-- Supabase creates default grants on public tables, even if we only grant
-- S/I/U. Without an explicit REVOKE on authenticated, physical DELETE worked.
revoke all on table public.mosaic_candidate_tasks,public.mosaic_candidate_categories
 from authenticated;
grant select,insert,update on table
 public.mosaic_candidate_tasks,public.mosaic_candidate_categories to authenticated;
revoke all on table public.mosaic_candidate_tasks,public.mosaic_candidate_categories
 from anon,public;
