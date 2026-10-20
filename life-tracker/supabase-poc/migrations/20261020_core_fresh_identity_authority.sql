-- Disposable core-app candidate only. No existing Auth account is enrolled.
-- Existing Appwrite identities require a separately verified migration; they
-- cannot claim a new canonical identity through a public RPC.
create table mosaic_candidate_private.core_authorities (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  canonical_id text not null unique,
  provenance text not null check (provenance = 'fresh-supabase'),
  backend text not null check (backend in ('supabase-cloud', 'frozen')),
  epoch bigint not null default 1 check (epoch > 0)
);
create table mosaic_candidate_private.core_sessions (
  session_id uuid primary key,
  owner_id uuid not null references mosaic_candidate_private.core_authorities(owner_id) on delete cascade,
  epoch bigint not null,
  expires_at timestamptz not null
);
revoke all on mosaic_candidate_private.core_authorities, mosaic_candidate_private.core_sessions
  from public, anon, authenticated;

create function mosaic_candidate_private.enroll_fresh_core_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into mosaic_candidate_private.core_authorities(owner_id, canonical_id, provenance, backend)
    values (new.id, 'sb_' || replace(new.id::text, '-', ''), 'fresh-supabase', 'supabase-cloud');
  return new;
end;
$$;
revoke all on function mosaic_candidate_private.enroll_fresh_core_owner() from public, anon, authenticated;
create trigger mosaic_enroll_fresh_core_owner after insert on auth.users
  for each row execute function mosaic_candidate_private.enroll_fresh_core_owner();

-- Multiple devices may write through the SAME authoritative backend. A lease
-- identifies a signed Auth session, not a second backend authority.
create function public.mosaic_core_session(p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  principal uuid := auth.uid();
  signed_session uuid := (auth.jwt()->>'session_id')::uuid;
  authority mosaic_candidate_private.core_authorities;
  expiry timestamptz := clock_timestamp() + interval '10 minutes';
begin
  if principal is null or signed_session is null or not exists (
    select 1 from auth.sessions where id=signed_session and user_id=principal
  ) then
    raise exception 'Signed session required' using errcode='42501';
  end if;
  if p_action = 'release' then
    delete from mosaic_candidate_private.core_sessions
      where session_id = signed_session and owner_id = principal;
    return jsonb_build_object('released', true);
  end if;
  if p_action <> 'acquire' or p_action is null then
    raise exception 'Invalid authority operation' using errcode='22023';
  end if;
  select * into authority from mosaic_candidate_private.core_authorities
    where owner_id = principal for share;
  if not found or authority.backend <> 'supabase-cloud' or authority.provenance <> 'fresh-supabase' then
    raise exception 'Fresh core authority required; migration not approved' using errcode='42501';
  end if;
  insert into mosaic_candidate_private.core_sessions(session_id, owner_id, epoch, expires_at)
    values(signed_session, principal, authority.epoch, expiry)
    on conflict(session_id) do update
      set expires_at=excluded.expires_at, epoch=excluded.epoch
      where mosaic_candidate_private.core_sessions.owner_id=excluded.owner_id;
  if not found then raise exception 'Session owner mismatch' using errcode='42501'; end if;
  return jsonb_build_object(
    'canonicalOwnerId', authority.canonical_id, 'ownerId', principal,
    'backend', authority.backend, 'provenance', authority.provenance,
    'epoch', authority.epoch, 'expiresAt', expiry);
end;
$$;
revoke all on function public.mosaic_core_session(text) from public, anon, authenticated;
grant execute on function public.mosaic_core_session(text) to authenticated;

-- Applied to INSERT and CAS UPDATE, including SECURITY DEFINER RPC writes.
-- Old candidate clients with no lease, expired leases and frozen authorities
-- are denied by the database even if they ignore every browser guard.
create function mosaic_candidate_private.require_core_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  authority mosaic_candidate_private.core_authorities;
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    raise exception 'Wrong signed owner' using errcode='42501';
  end if;
  select * into authority from mosaic_candidate_private.core_authorities
    where owner_id=new.owner_id for share;
  if not found or authority.backend <> 'supabase-cloud' or not exists(
    select 1 from mosaic_candidate_private.core_sessions
    where owner_id=new.owner_id and session_id=(auth.jwt()->>'session_id')::uuid
      and epoch=authority.epoch and expires_at>clock_timestamp()
      and exists(select 1 from auth.sessions
        where id=mosaic_candidate_private.core_sessions.session_id and user_id=new.owner_id)
  ) then raise exception 'Authoritative writer lease required' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function mosaic_candidate_private.require_core_authority() from public, anon, authenticated;
create trigger mosaic_core_tasks_authority before insert or update on public.mosaic_candidate_tasks
  for each row execute function mosaic_candidate_private.require_core_authority();
create trigger mosaic_core_categories_authority before insert or update on public.mosaic_candidate_categories
  for each row execute function mosaic_candidate_private.require_core_authority();
