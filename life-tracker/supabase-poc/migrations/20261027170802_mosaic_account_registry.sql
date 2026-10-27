-- #1406: durable provider-neutral ownership, not email-based account linking.
-- Isolated migration candidate. No hosted installation or historical import.
create table mosaic_candidate_private.identity_installation (
  singleton boolean primary key default true check (singleton),
  installation_id uuid not null unique default gen_random_uuid()
);
insert into mosaic_candidate_private.identity_installation(singleton) values(true);

create table mosaic_candidate_private.mosaic_accounts (
  account_id text primary key check (account_id ~ '^[A-Za-z0-9][A-Za-z0-9_]{0,35}$'),
  version integer not null default 1 check (version = 1),
  state text not null default 'active' check (state in ('active', 'erased')),
  history_state text not null default 'unconfirmed'
    check (history_state in ('unconfirmed', 'fresh', 'recovery-pending', 'recovered')),
  consent_version integer,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((consent_version is null) = (consent_at is null)),
  check (history_state = 'unconfirmed' or consent_version = 1)
);
create table mosaic_candidate_private.provider_accounts (
  provider text not null check (provider in ('supabase-cloud', 'appwrite-cloud', 'appwrite-oracle')),
  installation_id uuid not null,
  provider_user_id text not null check (length(provider_user_id) between 1 and 255),
  account_id text not null references mosaic_candidate_private.mosaic_accounts(account_id),
  version integer not null default 1 check (version > 0),
  claim_state text not null check (claim_state in ('verified', 'revoked')),
  provenance text not null check (provenance in ('server-enrolled', 'verified-owner-escrow', 'verified-provider-session')),
  proof_sha256 text check (proof_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  primary key(provider, installation_id, provider_user_id),
  unique(account_id, provider, installation_id),
  check (provenance = 'server-enrolled' or proof_sha256 is not null),
  check (provenance <> 'server-enrolled' or provider = 'supabase-cloud')
);
create table mosaic_candidate_private.identity_audit (
  event_id bigint generated always as identity primary key,
  account_id text not null references mosaic_candidate_private.mosaic_accounts(account_id),
  event text not null check (event in ('server-enrolled', 'start-consented', 'recovery-pending', 'provider-revoked')),
  signed_session_id uuid,
  history_state text not null,
  created_at timestamptz not null default now()
);
create index identity_audit_account on mosaic_candidate_private.identity_audit(account_id, event_id);
alter table mosaic_candidate_private.identity_installation enable row level security;
alter table mosaic_candidate_private.mosaic_accounts enable row level security;
alter table mosaic_candidate_private.provider_accounts enable row level security;
alter table mosaic_candidate_private.identity_audit enable row level security;
revoke all on mosaic_candidate_private.identity_installation,
  mosaic_candidate_private.mosaic_accounts, mosaic_candidate_private.provider_accounts,
  mosaic_candidate_private.identity_audit from public, anon, authenticated;
revoke all on sequence mosaic_candidate_private.identity_audit_event_id_seq from public, anon, authenticated;

-- Preserve the exact already-issued Mosaic ID and existing data/checkpoints.
-- Only the existing server-owned fresh authority is evidence. Never auth email,
-- raw_user_meta_data, a ZIP userId, or a client-provided canonical owner.
insert into mosaic_candidate_private.mosaic_accounts(account_id)
  select canonical_id from mosaic_candidate_private.core_authorities where provenance='fresh-supabase';
insert into mosaic_candidate_private.provider_accounts(
  provider, installation_id, provider_user_id, account_id, claim_state, provenance)
  select 'supabase-cloud', i.installation_id, a.owner_id::text, a.canonical_id, 'verified', 'server-enrolled'
  from mosaic_candidate_private.core_authorities a
  cross join mosaic_candidate_private.identity_installation i where a.provenance='fresh-supabase';
insert into mosaic_candidate_private.identity_audit(account_id, event, history_state)
  select account_id, 'server-enrolled', history_state from mosaic_candidate_private.mosaic_accounts;

create function mosaic_candidate_private.register_core_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.provenance <> 'fresh-supabase' then
    raise exception 'Independent owner proof required' using errcode='42501';
  end if;
  insert into mosaic_candidate_private.mosaic_accounts(account_id) values(new.canonical_id);
  insert into mosaic_candidate_private.provider_accounts(
    provider, installation_id, provider_user_id, account_id, claim_state, provenance)
    select 'supabase-cloud', installation_id, new.owner_id::text, new.canonical_id, 'verified', 'server-enrolled'
    from mosaic_candidate_private.identity_installation;
  insert into mosaic_candidate_private.identity_audit(account_id,event,history_state)
    values(new.canonical_id,'server-enrolled','unconfirmed');
  return new;
end;
$$;
revoke all on function mosaic_candidate_private.register_core_identity() from public, anon, authenticated;
create trigger mosaic_register_core_identity after insert on mosaic_candidate_private.core_authorities
  for each row execute function mosaic_candidate_private.register_core_identity();

create function mosaic_candidate_private.revoke_core_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update mosaic_candidate_private.provider_accounts set claim_state='revoked', version=version+1
    where provider='supabase-cloud' and provider_user_id=old.owner_id::text
      and installation_id=(select installation_id from mosaic_candidate_private.identity_installation)
      and account_id=old.canonical_id;
  update mosaic_candidate_private.mosaic_accounts set state='erased' where account_id=old.canonical_id;
  insert into mosaic_candidate_private.identity_audit(account_id,event,history_state)
    select account_id,'provider-revoked',history_state from mosaic_candidate_private.mosaic_accounts
    where account_id=old.canonical_id;
  return old;
end;
$$;
revoke all on function mosaic_candidate_private.revoke_core_identity() from public, anon, authenticated;
create trigger mosaic_revoke_core_identity before delete on mosaic_candidate_private.core_authorities
  for each row execute function mosaic_candidate_private.revoke_core_identity();

-- Caller can read only their server association and consent to NEW data.
-- No API can nominate an old owner, supply proof, link, merge, or mark recovered.
create function public.mosaic_account_status(p_start_mode text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  principal uuid := auth.uid();
  signed_session uuid := (auth.jwt()->>'session_id')::uuid;
  binding mosaic_candidate_private.provider_accounts;
  account mosaic_candidate_private.mosaic_accounts;
begin
  if principal is null or signed_session is null or not exists(
    select 1 from auth.sessions where id=signed_session and user_id=principal
  ) then raise exception 'Signed session required' using errcode='42501'; end if;
  if p_start_mode is not null and p_start_mode not in ('fresh','recovery-pending') then
    raise exception 'Only new-data consent is permitted' using errcode='22023';
  end if;
  select p.* into binding from mosaic_candidate_private.provider_accounts p
    join mosaic_candidate_private.identity_installation i on i.installation_id=p.installation_id
    join mosaic_candidate_private.core_authorities a
      on a.owner_id=principal and a.canonical_id=p.account_id
    where p.provider='supabase-cloud' and p.provider_user_id=principal::text
      and p.claim_state='verified' and a.backend='supabase-cloud'
    for share of p, a;
  if not found then raise exception 'Verified account mapping required' using errcode='42501'; end if;
  select * into account from mosaic_candidate_private.mosaic_accounts
    where account_id=binding.account_id for update;
  if not found or account.state <> 'active' then
    raise exception 'Account unavailable' using errcode='42501';
  end if;
  if p_start_mode is not null and p_start_mode <> account.history_state then
    -- Repeated consent is idempotent. Pending history can never be hidden by
    -- selecting fresh later. Consent never claims or rewrites historical rows.
    if account.history_state <> 'unconfirmed' and
       not (account.history_state='fresh' and p_start_mode='recovery-pending') then
      raise exception 'Historical recovery state cannot be downgraded' using errcode='42501';
    end if;
    update mosaic_candidate_private.mosaic_accounts
      set history_state=p_start_mode, consent_version=1, consent_at=clock_timestamp()
      where account_id=account.account_id returning * into account;
    insert into mosaic_candidate_private.identity_audit(account_id,event,signed_session_id,history_state)
      values(account.account_id,case when p_start_mode='fresh' then 'start-consented' else 'recovery-pending' end,
        signed_session,p_start_mode);
  end if;
  return jsonb_build_object('version',1,'mosaicAccountId',account.account_id,
    'provider','supabase-cloud','providerUserId',principal,
    'installationId',binding.installation_id,'mappingVersion',binding.version,
    'provenance',binding.provenance,'historyState',account.history_state,
    'consentVersion',account.consent_version);
end;
$$;
revoke all on function public.mosaic_account_status(text) from public, anon, authenticated;
grant execute on function public.mosaic_account_status(text) to authenticated;
