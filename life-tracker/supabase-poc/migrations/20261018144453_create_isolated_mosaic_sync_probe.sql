-- Experiment only, applied to Supabase mosaic-dev (not Appwrite).
-- This table retains a real Auth foreign key for later end-to-end Auth tests.
create table public.mosaic_sync_probe (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
create index mosaic_sync_probe_owner_updated_idx
  on public.mosaic_sync_probe(owner_id, updated_at, id);
alter table public.mosaic_sync_probe enable row level security;
create policy "owner_read" on public.mosaic_sync_probe
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owner_insert" on public.mosaic_sync_probe
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owner_update" on public.mosaic_sync_probe
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owner_delete" on public.mosaic_sync_probe
  for delete to authenticated using ((select auth.uid()) = owner_id);
revoke all on table public.mosaic_sync_probe from anon;
grant select,insert,update,delete on table public.mosaic_sync_probe to authenticated;
