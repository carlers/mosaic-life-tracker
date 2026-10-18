-- Already applied on ISOLATED Supabase mosaic-dev only, as
-- create_mosaic_candidate_tasks_categories_owner_rls.
-- Never run in CI, on an existing target, or on Production. NOT a final schema.
-- Appwrite/RxDB IDs remain text; Auth principal is a Supabase UUID.
create schema if not exists mosaic_candidate_private;
revoke all on schema mosaic_candidate_private from public,anon,authenticated;
create table mosaic_candidate_private.owner_revisions (
  owner_id uuid primary key,
  last_revision bigint not null check (last_revision>=0)
);
revoke all on mosaic_candidate_private.owner_revisions from public,anon,authenticated;
create function mosaic_candidate_private.next_revision(p_owner uuid)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare v bigint;
begin
 insert into mosaic_candidate_private.owner_revisions(owner_id,last_revision)
 values(p_owner,1)
 on conflict(owner_id) do update
   set last_revision=mosaic_candidate_private.owner_revisions.last_revision+1
 returning last_revision into v;
 return v;
end
$fn$;
revoke all on function mosaic_candidate_private.next_revision(uuid)
 from public,anon,authenticated;
create function mosaic_candidate_private.stamp_row()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='UPDATE' then
   if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
     raise exception 'immutable row identity and ownership' using errcode='42501';
   end if;
 end if;
 new.change_seq := mosaic_candidate_private.next_revision(new.owner_id);
 new.server_updated_at := clock_timestamp();
 return new;
end
$fn$;
revoke all on function mosaic_candidate_private.stamp_row()
 from public,anon,authenticated;

create table public.mosaic_candidate_categories (
 owner_id uuid not null,
 id text not null check(char_length(id) between 1 and 255),
 name text not null check(char_length(name)<=255),
 color text not null check(char_length(color)<=50),
 order_index integer not null check(order_index between 0 and 999999),
 visibility text not null default 'private' check(visibility in ('private','public','followers')),
 icon text check(char_length(icon)<=1000),
 updated_at text not null default '',
 is_deleted boolean not null default false,
 change_seq bigint not null default 0,
 server_updated_at timestamptz not null default now(),
 primary key(owner_id,id)
);
create table public.mosaic_candidate_tasks (
 owner_id uuid not null,
 id text not null check(char_length(id) between 1 and 255),
 title text not null check(char_length(title)<=255),
 completed boolean not null default false,
 category_id text not null default '',
 order_index integer not null check(order_index between 0 and 999999),
 tags text,
 task_date text not null check(char_length(task_date)<=50),
 memo text,
 image text,
 created_at text not null,
 completed_at text,
 updated_at text not null,
 source text,
 routine_id text,
 reminder_time text,
 reactions text,
 visibility text not null default '' check(visibility in ('','private','public','followers')),
 is_deleted boolean not null default false,
 change_seq bigint not null default 0,
 server_updated_at timestamptz not null default now(),
 primary key(owner_id,id)
);
create index mosaic_candidate_task_day_idx on public.mosaic_candidate_tasks(owner_id,task_date) where is_deleted=false;
create index mosaic_candidate_task_category_idx on public.mosaic_candidate_tasks(owner_id,category_id) where is_deleted=false;
create index mosaic_candidate_tasks_cursor_idx on public.mosaic_candidate_tasks(owner_id,change_seq);
create index mosaic_candidate_categories_cursor_idx on public.mosaic_candidate_categories(owner_id,change_seq);
create trigger mosaic_candidate_task_stamp before insert or update
 on public.mosaic_candidate_tasks for each row
 execute function mosaic_candidate_private.stamp_row();
create trigger mosaic_candidate_category_stamp before insert or update
 on public.mosaic_candidate_categories for each row
 execute function mosaic_candidate_private.stamp_row();
alter table public.mosaic_candidate_tasks enable row level security;
alter table public.mosaic_candidate_categories enable row level security;
revoke all on table public.mosaic_candidate_tasks,public.mosaic_candidate_categories from public,anon;
-- NOTE: A DEFAULT GRANT in Supabase ALSO gave authenticated DELETE privilege.
-- The next migration explicitly REVOKES ALL before granting S/I/U.
grant select,insert,update on table public.mosaic_candidate_tasks,public.mosaic_candidate_categories to authenticated;
create policy candidate_tasks_read on public.mosaic_candidate_tasks
 for select to authenticated using(owner_id=(select auth.uid()));
create policy candidate_tasks_add on public.mosaic_candidate_tasks
 for insert to authenticated with check(owner_id=(select auth.uid()));
create policy candidate_tasks_update on public.mosaic_candidate_tasks
 for update to authenticated using(owner_id=(select auth.uid()))
 with check(owner_id=(select auth.uid()));
create policy candidate_categories_read on public.mosaic_candidate_categories
 for select to authenticated using(owner_id=(select auth.uid()));
create policy candidate_categories_add on public.mosaic_candidate_categories
 for insert to authenticated with check(owner_id=(select auth.uid()));
create policy candidate_categories_update on public.mosaic_candidate_categories
 for update to authenticated using(owner_id=(select auth.uid()))
 with check(owner_id=(select auth.uid()));
comment on table public.mosaic_candidate_tasks is
 'ISOLATED POC ONLY: tasks private to owner; visibility is stored metadata, NOT a social sharing policy.';
comment on table public.mosaic_candidate_categories is
 'ISOLATED POC ONLY: no social/friend visibility, auth migration, or media transfer.';
