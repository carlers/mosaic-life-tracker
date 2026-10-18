-- Disposable feasibility table. NOT a production schema or migration target.
-- The synthetic owner UUID deliberately has NO FK to auth.users so tests may
-- impersonate claim subjects without provisioning real Supabase Auth users.
-- Public schema access is protected by auth.uid() RLS and explicit grants.
create table public.mosaic_poc_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 255),
  completed boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index mosaic_poc_items_owner_cursor_idx
  on public.mosaic_poc_items(owner_id, updated_at, id);
create function public.mosaic_poc_stamp()
returns trigger language plpgsql set search_path = ''
as $body$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  else
    if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
      raise exception 'mosaic_poc_items ownership and identity are immutable'
        using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end;
$body$;
create trigger mosaic_poc_items_stamp
  before insert or update on public.mosaic_poc_items
  for each row execute function public.mosaic_poc_stamp();
revoke all on table public.mosaic_poc_items from public, anon;
grant select,insert,update,delete on table public.mosaic_poc_items to authenticated;
revoke all on function public.mosaic_poc_stamp() from public, anon, authenticated;
alter table public.mosaic_poc_items enable row level security;
create policy mosaic_poc_owner_select on public.mosaic_poc_items
  for select to authenticated using (owner_id = (select auth.uid()));
create policy mosaic_poc_owner_insert on public.mosaic_poc_items
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy mosaic_poc_owner_update on public.mosaic_poc_items
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy mosaic_poc_owner_delete on public.mosaic_poc_items
  for delete to authenticated using (owner_id = (select auth.uid()));
