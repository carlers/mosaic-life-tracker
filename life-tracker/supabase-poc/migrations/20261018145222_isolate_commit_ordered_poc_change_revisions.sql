-- Feasibility only: serialize changes per owner in transaction/commit order.
-- Never install on Appwrite, Production, or another Supabase project automatically.
create schema if not exists mosaic_poc_internal;
revoke all on schema mosaic_poc_internal from public, anon, authenticated;
create table mosaic_poc_internal.owner_revision (
  owner_id uuid primary key,
  last_revision bigint not null check (last_revision >= 0)
);
revoke all on mosaic_poc_internal.owner_revision from public, anon, authenticated;
alter table public.mosaic_poc_items
  add column change_seq bigint not null default 0
  check (change_seq >= 0);
create index mosaic_poc_items_owner_seq_idx
  on public.mosaic_poc_items(owner_id, change_seq);
create function mosaic_poc_internal.stamp_change_seq()
returns trigger language plpgsql security definer set search_path = ''
as $body$
declare next_revision bigint;
begin
  -- The ON CONFLICT row lock is held to transaction commit. All same-owner
  -- writers therefore serialize, so later commits cannot publish lower seqs.
  insert into mosaic_poc_internal.owner_revision(owner_id,last_revision)
    values(new.owner_id,1)
  on conflict (owner_id) do update
    set last_revision = mosaic_poc_internal.owner_revision.last_revision + 1
  returning last_revision into next_revision;
  new.change_seq := next_revision;
  return new;
end;
$body$;
revoke all on function mosaic_poc_internal.stamp_change_seq()
  from public, anon, authenticated;
create trigger mosaic_poc_items_revision
  before insert or update on public.mosaic_poc_items
  for each row execute function mosaic_poc_internal.stamp_change_seq();
-- Deletes would vanish from incremental pulls: require tombstones.
drop policy mosaic_poc_owner_delete on public.mosaic_poc_items;
revoke delete on public.mosaic_poc_items from authenticated;
