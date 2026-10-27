-- Release, consent and provider authority apply to raw REST/CAS/Storage clients,
-- not just the current browser. Reading/exporting owned data remains possible.
alter table mosaic_candidate_private.mosaic_accounts
  add constraint personal_consent_complete check (
    history_state = 'unconfirmed' or
    (consent_version = 1 and consent_at is not null) is true
  );

create function mosaic_candidate_private.has_personal_write_authority()
returns boolean language plpgsql security definer set search_path='' as $$
declare principal uuid := auth.uid();
begin
  if principal is null then return false; end if;
  perform 1
    from mosaic_candidate_private.core_authorities a
    join mosaic_candidate_private.core_sessions s on s.owner_id=a.owner_id and s.epoch=a.epoch
    join mosaic_candidate_private.identity_installation i on i.singleton
    join mosaic_candidate_private.provider_accounts p
      on p.provider='supabase-cloud' and p.installation_id=i.installation_id
      and p.provider_user_id=a.owner_id::text and p.account_id=a.canonical_id
    join mosaic_candidate_private.mosaic_accounts m on m.account_id=p.account_id
    where a.owner_id=principal and a.backend='supabase-cloud'
      and a.provenance='fresh-supabase'
      and s.session_id=(auth.jwt()->>'session_id')::uuid and s.expires_at>clock_timestamp()
      and exists(select 1 from auth.sessions where id=s.session_id and user_id=principal)
      and i.personal_release_evidence is not null
      and p.claim_state='verified' and p.provenance='server-enrolled'
      and m.state='active' and m.history_state in ('fresh','recovery-pending')
      and m.consent_version=1 and m.consent_at is not null
    for share of a,s,i,p,m;
  return found;
end;
$$;
revoke all on function mosaic_candidate_private.has_personal_write_authority() from public, anon, authenticated;
-- Needed by stored Storage policies; the private schema is not a PostgREST API.
-- This no-argument function can answer only for the caller's signed session.
grant execute on function mosaic_candidate_private.has_personal_write_authority() to authenticated;

create or replace function mosaic_candidate_private.require_core_authority()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() or
     not mosaic_candidate_private.has_personal_write_authority() then
    raise exception 'Consented released personal writer authority required' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function mosaic_candidate_private.require_core_authority() from public, anon, authenticated;

-- Restrictive policies add to, never replace, exact private path ownership and
-- immutable object policies. Other buckets retain their own existing policies.
create policy mosaic_personal_photo_authority_insert on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'mosaic-personal-photos' or
    (select mosaic_candidate_private.has_personal_write_authority()));
create policy mosaic_personal_photo_authority_delete on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'mosaic-personal-photos' or
    (select mosaic_candidate_private.has_personal_write_authority()));
